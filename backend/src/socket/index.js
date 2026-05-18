const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const CrashGame = require('../games/crash');
const { RouletteGame, calculateWin } = require('../games/roulette');

function initSocket(io) {
  // Authentification Socket.io
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

  // Instances des jeux
  const crashGame = new CrashGame(io);
  const rouletteGame = new RouletteGame(io);

  crashGame.start();
  rouletteGame.start();

  // Messages du chat (50 derniers)
  const chatHistory = [];

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`🎰 ${user.pseudo} connecté`);

    // Rejoindre les rooms
    socket.join('lobby');
    socket.join('crash');
    socket.join('roulette');

    // Envoi de l'état initial
    socket.emit('init', {
      user,
      chatHistory: chatHistory.slice(-50),
      crashState: crashGame.getState(),
      rouletteState: rouletteGame.getState(),
    });

    // Leaderboard initial
    const leaderboard = await getLeaderboard();
    socket.emit('leaderboard:update', leaderboard);

    // ─── CHAT ───────────────────────────────────────────────
    socket.on('chat:message', async (data) => {
      const { content } = data;
      if (!content || content.trim().length === 0 || content.length > 500) return;

      const sanitized = content.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
      const result = crashGame.cashOut(user.id);
      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { balance: { increment: result.winAmount } },
        }),
        prisma.bet.create({
          data: {
            userId: user.id,
            game: 'CRASH',
            amount: crashGame.bets.get(user.id)?.amount || 0,
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
    });

    socket.on('disconnect', () => {
      console.log(`👋 ${user.pseudo} déconnecté`);
    });
  });

  // Événements de fin de round Crash - enregistrement en BDD
  io.on('crash:crashed', async (data) => {
    if (!data.results) return;
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
        } catch {}
      }
    }
    broadcastLeaderboard();
  });

  // Événements de résultat Roulette - enregistrement en BDD
  io.on('roulette:result', async (data) => {
    if (!data.results) return;
    for (const result of data.results) {
      try {
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
            data: { balance: { increment: result.totalWin } },
          }),
        ]);
      } catch {}
    }
    broadcastLeaderboard();
  });

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
