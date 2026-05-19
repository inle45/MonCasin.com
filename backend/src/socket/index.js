const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const CrashGame = require('../games/crash');
const { RouletteGame } = require('../games/roulette');
const { grantXp } = require('../games/xp');

function initSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Non authentifié'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true, pseudo: true, avatar: true, balance: true,
          grade: true, avatarBorder: true, pseudoColor: true,
        },
      });

      if (!user) return next(new Error('Utilisateur introuvable'));

      socket.user = user;
      next();
    } catch {
      next(new Error('Token invalide'));
    }
  });

  const crashGame = new CrashGame(io);
  const rouletteGame = new RouletteGame(io);

  crashGame.start();
  rouletteGame.start();

  // Charger les 100 derniers messages depuis la DB au démarrage
  const chatHistory = [];
  prisma.chatMessage.findMany({
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: { user: { select: { pseudo: true, avatar: true, grade: true, pseudoColor: true } } },
  }).then(msgs => {
    msgs.forEach(m => chatHistory.push({
      id: m.id,
      userId: m.userId,
      pseudo: m.user.pseudo,
      avatar: m.user.avatar,
      grade: m.user.grade,
      pseudoColor: m.user.pseudoColor,
      content: m.content,
      createdAt: m.createdAt,
    }));
  }).catch(() => {});

  // Track consecutive 1.00x crashes per user
  const consecutiveCrashOnes = new Map();

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`🎰 ${user.pseudo} connecté`);

    socket.join('lobby');
    socket.join('crash');
    socket.join('roulette');

    socket.emit('init', {
      user,
      chatHistory: chatHistory.slice(-50),
      crashState: crashGame.getState(),
      rouletteState: rouletteGame.getState(),
    });

    const leaderboard = await getLeaderboard();
    socket.emit('leaderboard:update', leaderboard);

    // ─── CHAT ───────────────────────────────────────────────
    socket.on('chat:message', async (data) => {
      const { content } = data;
      if (!content || content.trim().length === 0 || content.length > 500) return;

      const raw = content.trim();

      // /pay command
      if (raw.startsWith('/pay ')) {
        await handlePayCommand(socket, raw);
        return;
      }

      const sanitized = raw.replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const message = await prisma.chatMessage.create({
        data: { userId: user.id, content: sanitized },
      });

      const freshUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { pseudo: true, avatar: true, grade: true, avatarBorder: true, pseudoColor: true },
      });

      const chatMsg = {
        id: message.id,
        userId: user.id,
        pseudo: freshUser.pseudo,
        avatar: freshUser.avatar,
        grade: freshUser.grade,
        pseudoColor: freshUser.pseudoColor,
        content: sanitized,
        createdAt: message.createdAt,
      };

      chatHistory.push(chatMsg);
      if (chatHistory.length > 100) chatHistory.shift();

      io.to('lobby').emit('chat:message', chatMsg);
    });

    // ─── CRASH ──────────────────────────────────────────────
    socket.on('crash:bet', async (data) => {
      const { amount } = data;
      const betAmount = parseFloat(amount);
      if (!betAmount || betAmount <= 0) return;

      const freshUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (freshUser.balance < betAmount) {
        socket.emit('error', { message: 'Solde insuffisant' });
        return;
      }

      const result = crashGame.placeBet(user.id, user.pseudo, betAmount);
      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { balance: { decrement: betAmount } },
      });

      const newBalance = (await prisma.user.findUnique({
        where: { id: user.id }, select: { balance: true },
      })).balance;

      socket.emit('crash:bet_confirmed', { amount: betAmount, newBalance });
    });

    socket.on('crash:cashout', async () => {
      const betInfo = crashGame.bets.get(user.id);
      const result = crashGame.cashOut(user.id);
      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }

      let winAmount = result.winAmount;
      const betAmount = betInfo?.amount || 0;

      // Auto-remboursement de prêt
      const loanDeducted = await repayLoanFromWin(user.id, winAmount);
      if (loanDeducted > 0) {
        winAmount -= loanDeducted;
        socket.emit('loan:repaid', { deducted: loanDeducted });
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { balance: { increment: winAmount } },
        }),
        prisma.bet.create({
          data: {
            userId: user.id,
            game: 'CRASH',
            amount: betAmount,
            multiplier: result.multiplier,
            result: result.winAmount,
            won: true,
            details: { cashOutAt: result.multiplier },
          },
        }),
      ]);

      const newBalance = (await prisma.user.findUnique({
        where: { id: user.id }, select: { balance: true },
      })).balance;

      socket.emit('crash:cashout_confirmed', {
        winAmount: result.winAmount,
        multiplier: result.multiplier,
        newBalance,
      });

      // XP pour la mise
      grantXp(user.id, betAmount).catch(() => {});

      // Live feed — cashout notable (≥2x ou ≥500 F€)
      if (result.multiplier >= 2 || result.winAmount >= 500) {
        const emoji = result.multiplier >= 10 ? '🚀' : result.multiplier >= 5 ? '🔥' : '⚡';
        io.emit('livefeed:event', {
          id: `cf-${Date.now()}`,
          pseudo: user.pseudo,
          emoji,
          message: `cashout à ${result.multiplier.toFixed(2)}x au Crash`,
          amount: result.winAmount,
          positive: true,
        });
      }

      // Vérifier succès : Chasseur de Multiplicateurs (50x+)
      if (result.multiplier >= 50) {
        await grantAchievement(socket, user.id, 'chasseur-multiplicateurs', io);
      }

      // Vérifier succès : Premier Gain
      await checkFirstWinAchievement(socket, user.id, io);

      // Vérifier succès : Millionnaire
      if (newBalance >= 100000) {
        await grantAchievement(socket, user.id, 'riche-a-millions', io);
      }

      broadcastLeaderboard();
    });

    // ─── ROULETTE ───────────────────────────────────────────
    socket.on('roulette:bet', async (data) => {
      const { bets } = data;
      if (!bets || !Array.isArray(bets) || bets.length === 0) return;

      const totalBet = bets.reduce((s, b) => s + parseFloat(b.amount || 0), 0);
      if (totalBet <= 0) return;

      const freshUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (freshUser.balance < totalBet) {
        socket.emit('error', { message: 'Solde insuffisant' });
        return;
      }

      const result = rouletteGame.placeBet(user.id, user.pseudo, bets);
      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { balance: { decrement: totalBet } },
      });

      const newBalance = (await prisma.user.findUnique({
        where: { id: user.id }, select: { balance: true },
      })).balance;

      socket.emit('roulette:bet_confirmed', { totalBet, newBalance });
      grantXp(user.id, totalBet).catch(() => {});

      // Broadcast aux autres joueurs pour afficher les jetons sur le tapis
      io.to('roulette').emit('roulette:bet_placed', {
        userId: user.id,
        pseudo: user.pseudo,
        bets,
      });
    });

    // ─── RÉACTIONS CRASH ────────────────────────────────────
    socket.on('crash:reaction', (data) => {
      const ALLOWED = ['😱','🔥','💀','🚀','😂','💸','🎉','😤'];
      if (!ALLOWED.includes(data.emoji)) return;
      io.to('crash').emit('crash:reaction', {
        pseudo: user.pseudo,
        emoji: data.emoji,
        id: `${user.id}-${Date.now()}`,
      });
    });

    socket.on('disconnect', () => {
      console.log(`👋 ${user.pseudo} déconnecté`);
    });
  });

  // ─── CRASH CRASHED — enregistrement en BDD ──────────────
  io.on('crash:crashed', async (data) => {
    if (!data.results) return;

    const crashedAtOne = data.crashPoint <= 1.01;

    for (const result of data.results) {
      if (!result.cashedOut && result.amount > 0) {
        try {
          await prisma.bet.create({
            data: {
              userId: result.userId,
              game: 'CRASH',
              amount: result.amount,
              multiplier: 0,
              result: 0,
              won: false,
              details: { crashedAt: data.crashPoint },
            },
          });
          grantXp(result.userId, result.amount).catch(() => {});
        } catch {}
      }
    }

    // Succès Chat Noir : crash 1.00x trois fois de suite
    if (crashedAtOne) {
      const allSockets = await io.fetchSockets();
      for (const s of allSockets) {
        if (!s.user) continue;
        const uid = s.user.id;
        const count = (consecutiveCrashOnes.get(uid) || 0) + 1;
        consecutiveCrashOnes.set(uid, count);
        if (count >= 3) {
          consecutiveCrashOnes.set(uid, 0);
          await grantAchievementById(s, uid, 'chat-noir', io);
        }
      }
    } else {
      // Réinitialiser compteur pour tous si pas 1.00x
      consecutiveCrashOnes.clear();
    }

    broadcastLeaderboard();
  });

  // ─── ROULETTE RESULT — enregistrement en BDD ────────────
  io.on('roulette:result', async (data) => {
    if (!data.results) return;
    for (const result of data.results) {
      try {
        let winAmount = result.totalWin;

        const loanDeducted = await repayLoanFromWin(result.userId, winAmount);
        if (loanDeducted > 0) {
          winAmount -= loanDeducted;
          const userSocket = findUserSocket(io, result.userId);
          if (userSocket) userSocket.emit('loan:repaid', { deducted: loanDeducted });
        }

        await prisma.$transaction([
          prisma.bet.create({
            data: {
              userId: result.userId,
              game: 'ROULETTE',
              amount: result.totalBet,
              result: result.totalWin,
              won: result.totalWin > 0,
              details: { winningNumber: data.winningNumber, winColor: data.winColor },
            },
          }),
          prisma.user.update({
            where: { id: result.userId },
            data: { balance: { increment: winAmount } },
          }),
        ]);

        if (result.totalWin > 0) {
          // Live feed — gros gain roulette
          if (result.totalWin >= 500) {
            const rUser = await prisma.user.findUnique({ where: { id: result.userId }, select: { pseudo: true } });
            if (rUser) {
              io.emit('livefeed:event', {
                id: `rl-${Date.now()}-${result.userId}`,
                pseudo: rUser.pseudo,
                emoji: result.totalWin >= 5000 ? '💸' : '🎡',
                message: `a gagné à la Roulette`,
                amount: result.totalWin,
                positive: true,
              });
            }
          }

          const userSocket = findUserSocket(io, result.userId);
          if (userSocket) {
            await checkFirstWinAchievement(userSocket, result.userId, io);

            // Succès All-In Réussi : tout misé sur couleur et gagné
            const colorBets = result.bets?.filter(b => b.type === 'color') || [];
            if (colorBets.length > 0) {
              const freshUser = await prisma.user.findUnique({
                where: { id: result.userId }, select: { balance: true },
              });
              const totalColorBet = colorBets.reduce((s, b) => s + b.amount, 0);
              if (totalColorBet >= 10000 && totalColorBet >= (freshUser.balance - result.totalWin + totalColorBet) * 0.95) {
                await grantAchievement(userSocket, result.userId, 'all-in-reussi', io);
              }
            }

            const newBal = await prisma.user.findUnique({
              where: { id: result.userId }, select: { balance: true },
            });
            if (newBal.balance >= 100000) {
              await grantAchievement(userSocket, result.userId, 'riche-a-millions', io);
            }
          }
        }
      } catch {}
    }
    broadcastLeaderboard();
  });

  // ─── HELPERS ────────────────────────────────────────────

  async function handlePayCommand(socket, raw) {
    const parts = raw.split(' ');
    if (parts.length < 3) {
      socket.emit('error', { message: 'Syntaxe: /pay <pseudo> <montant>' });
      return;
    }

    const targetPseudo = parts[1];
    const amount = parseFloat(parts[2]);

    if (isNaN(amount) || amount <= 0) {
      socket.emit('error', { message: 'Montant invalide' });
      return;
    }

    const sender = await prisma.user.findUnique({ where: { id: socket.user.id } });
    if (sender.balance < amount) {
      socket.emit('error', { message: 'Solde insuffisant' });
      return;
    }

    const target = await prisma.user.findUnique({ where: { pseudo: targetPseudo } });
    if (!target) {
      socket.emit('error', { message: `Joueur "${targetPseudo}" introuvable` });
      return;
    }

    if (target.id === socket.user.id) {
      socket.emit('error', { message: 'Tu ne peux pas te payer toi-même' });
      return;
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: sender.id }, data: { balance: { decrement: amount } } }),
      prisma.user.update({ where: { id: target.id }, data: { balance: { increment: amount } } }),
      prisma.transaction.create({
        data: { userId: sender.id, type: 'TRANSFER', amount: -amount, description: `Transfert à ${target.pseudo}` },
      }),
      prisma.transaction.create({
        data: { userId: target.id, type: 'TRANSFER', amount, description: `Transfert de ${sender.pseudo}` },
      }),
    ]);

    const newBalance = (await prisma.user.findUnique({
      where: { id: sender.id }, select: { balance: true },
    })).balance;

    socket.emit('pay:confirmed', { to: targetPseudo, amount, newBalance });

    // Notifier le destinataire s'il est connecté
    const targetSocket = findUserSocket(io, target.id);
    if (targetSocket) {
      const targetBalance = (await prisma.user.findUnique({
        where: { id: target.id }, select: { balance: true },
      })).balance;
      targetSocket.emit('pay:received', { from: sender.pseudo, amount, newBalance: targetBalance });
    }

    // Message système dans le chat
    const sysMsg = {
      id: `pay-${Date.now()}`,
      userId: 'system',
      pseudo: '💸 Système',
      content: `${sender.pseudo} a envoyé ${amount.toLocaleString('fr-FR')} F€ à ${target.pseudo}`,
      createdAt: new Date(),
      isSystem: true,
    };
    chatHistory.push(sysMsg);
    io.to('lobby').emit('chat:message', sysMsg);
  }

  async function repayLoanFromWin(userId, winAmount) {
    if (winAmount <= 0) return 0;

    const loan = await prisma.loan.findFirst({
      where: { borrowerId: userId, repaid: false },
    });

    if (!loan) return 0;

    const deducted = Math.min(loan.amountDue, winAmount);
    const fullyRepaid = deducted >= loan.amountDue;

    await prisma.$transaction([
      fullyRepaid
        ? prisma.loan.update({ where: { id: loan.id }, data: { repaid: true, repaidAt: new Date() } })
        : prisma.loan.update({ where: { id: loan.id }, data: { amountDue: { decrement: deducted } } }),
      prisma.transaction.create({
        data: {
          userId,
          type: 'REPAYMENT',
          amount: deducted,
          description: fullyRepaid
            ? `Prêt remboursé intégralement`
            : `Remboursement partiel du prêt (reste: ${(loan.amountDue - deducted).toFixed(0)} F€)`,
        },
      }),
    ]);

    return deducted;
  }

  async function grantAchievement(socket, userId, achievementKey, io) {
    try {
      // Look up by key (unique), not by id
      const ach = await prisma.achievement.findUnique({ where: { key: achievementKey } });
      if (!ach) return;

      const already = await prisma.userAchievement.findUnique({
        where: { userId_achievementId: { userId, achievementId: ach.id } },
      });
      if (already) return;

      await prisma.userAchievement.create({ data: { userId, achievementId: ach.id } });

      if (ach.reward > 0) {
        await prisma.$transaction([
          prisma.user.update({ where: { id: userId }, data: { balance: { increment: ach.reward } } }),
          prisma.transaction.create({
            data: { userId, type: 'BONUS', amount: ach.reward, description: `Succès débloqué: ${ach.name}` },
          }),
        ]);
      }

      socket.emit('achievement:unlocked', {
        id: ach.id,
        name: ach.name,
        description: ach.description,
        icon: ach.icon,
        reward: ach.reward,
      });

      // Annonce globale dans le chat
      const sysMsg = {
        id: `ach-${Date.now()}`,
        userId: 'system',
        pseudo: '🏆 Succès',
        content: `${socket.user.pseudo} a débloqué le succès "${ach.name}" ${ach.icon} !`,
        createdAt: new Date(),
        isSystem: true,
      };
      chatHistory.push(sysMsg);
      io.to('lobby').emit('chat:message', sysMsg);
    } catch {}
  }

  async function grantAchievementById(socket, userId, achievementId, io) {
    await grantAchievement(socket, userId, achievementId, io);
  }

  async function checkFirstWinAchievement(socket, userId, io) {
    const winCount = await prisma.bet.count({ where: { userId, won: true } });
    if (winCount === 1) {
      await grantAchievement(socket, userId, 'premier-gain', io);
    }
  }

  function findUserSocket(io, userId) {
    for (const [, s] of io.sockets.sockets) {
      if (s.user?.id === userId) return s;
    }
    return null;
  }

  async function getLeaderboard() {
    return prisma.user.findMany({
      orderBy: { balance: 'desc' },
      take: 10,
      select: {
        id: true, pseudo: true, avatar: true, balance: true,
        grade: true, avatarBorder: true, pseudoColor: true,
      },
    });
  }

  async function broadcastLeaderboard() {
    const leaderboard = await getLeaderboard();
    io.emit('leaderboard:update', leaderboard);
  }

  setInterval(broadcastLeaderboard, 10000);
}

module.exports = { initSocket };
