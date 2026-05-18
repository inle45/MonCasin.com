const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { spin, tournerRoue, ouvrirCoffre, LIGNES_DE_PAIEMENT } = require('../games/slots');
const { getJackpot, incrementerJackpot, remporterJackpot } = require('../games/jackpot');
const { getIo } = require('../socket/ioInstance');

const router = express.Router();

// ── Helper : message système dans le chat ─────────────────────────────────────
function emitChatSystem(contenu) {
  const io = getIo();
  if (!io) return;
  const msg = {
    id: `sys-slots-${Date.now()}`,
    userId: 'system',
    pseudo: '🎰 Vegas Evolution',
    content: contenu,
    createdAt: new Date(),
    isSystem: true,
  };
  io.to('lobby').emit('chat:message', msg);
}

function emitJackpot() {
  const io = getIo();
  if (io) io.emit('slots:jackpot', { jackpot: getJackpot() });
}

// ── POST /api/games/slots/spin ────────────────────────────────────────────────
router.post('/slots/spin', authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    const mise = parseFloat(amount);
    if (!mise || mise <= 0) return res.status(400).json({ error: 'Montant de mise invalide' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.balance < mise) return res.status(400).json({ error: 'Solde insuffisant' });

    const result = spin(mise, req.user.id);

    // Jackpot progressif
    let jackpotGagne = 0;
    if (result.jackpotWin) {
      jackpotGagne = remporterJackpot();
      result.gainTotal = jackpotGagne;
      emitChatSystem(`🚨 JACKPOT PROGRESSIF ! ${user.pseudo} remporte ${jackpotGagne.toLocaleString('fr-FR')} F€ !!`);
      emitJackpot();
    } else if (!result.gagne && !result.bonus) {
      // Alimenter la cagnotte avec 1% de la mise perdue
      incrementerJackpot(mise);
      emitJackpot();
    }

    const balanceChange = result.gainTotal - (result.estFreeSpin ? 0 : mise);

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: balanceChange } } }),
      prisma.bet.create({
        data: {
          userId: req.user.id,
          game: 'SLOTS',
          amount: result.estFreeSpin ? 0 : mise,
          multiplier: result.multiplicateurTotal || 0,
          result: result.gainTotal,
          won: result.gagne || result.bigWin,
          details: { lignesGagnantes: result.lignesGagnantes, bonus: result.bonus?.type, scatters: result.scatters },
        },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });

    // Annonce chat pour Big Win
    if (result.bigWin && !result.estFreeSpin) {
      emitChatSystem(`💥 BIG WIN ! ${user.pseudo} remporte ${result.gainTotal.toLocaleString('fr-FR')} F€ (×${result.multiplicateurTotal}) sur Vegas Evolution !`);
    }
    // Annonce chat pour bonus
    if (result.bonus) {
      const noms = { FREE_SPINS: '10 Free Spins', WHEEL_OF_FORTUNE: 'la Roue de la Fortune', CHEST_GAME: 'le Casse des Coffres' };
      emitChatSystem(`⭐ BONUS ! ${user.pseudo} déclenche ${noms[result.bonus.type]} !`);
    }

    res.json({ ...result, newBalance: updatedUser.balance, jackpot: getJackpot() });
  } catch (err) {
    console.error('Erreur slots:', err);
    res.status(500).json({ error: 'Erreur lors du spin' });
  }
});

// ── POST /api/games/slots/bonus/wheel ─────────────────────────────────────────
router.post('/slots/bonus/wheel', authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    const mise = parseFloat(amount);
    if (!mise || mise <= 0) return res.status(400).json({ error: 'Montant invalide' });

    const result = tournerRoue(mise);

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: result.gain } } }),
      prisma.transaction.create({
        data: { userId: req.user.id, type: 'WIN', amount: result.gain, description: `Roue de la Fortune — ×${result.multiplicateur}` },
      }),
    ]);

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true, pseudo: true } });

    if (result.multiplicateur >= 50) {
      emitChatSystem(`🎡 ${user.pseudo} remporte ×${result.multiplicateur} à la Roue de la Fortune — ${result.gain.toLocaleString('fr-FR')} F€ !`);
    }

    res.json({ ...result, newBalance: user.balance });
  } catch (err) {
    console.error('Erreur roue:', err);
    res.status(500).json({ error: 'Erreur roue' });
  }
});

// ── POST /api/games/slots/bonus/chest ─────────────────────────────────────────
router.post('/slots/bonus/chest', authenticate, async (req, res) => {
  try {
    const { indexCoffre } = req.body;
    if (indexCoffre === undefined) return res.status(400).json({ error: 'Index manquant' });

    const result = ouvrirCoffre(req.user.id, indexCoffre);
    if (result.erreur) return res.status(400).json({ error: result.erreur });

    if (!result.estAlarme && result.valeur > 0) {
      await prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: result.valeur } } });
    }

    if (result.termine && result.gainTotal > 0) {
      await prisma.transaction.create({
        data: { userId: req.user.id, type: 'WIN', amount: result.gainTotal, description: `Casse des Coffres — gain total` },
      });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
    res.json({ ...result, newBalance: user.balance });
  } catch (err) {
    console.error('Erreur coffre:', err);
    res.status(500).json({ error: 'Erreur coffre' });
  }
});

// ── GET /api/games/slots/jackpot ──────────────────────────────────────────────
router.get('/slots/jackpot', (req, res) => {
  res.json({ jackpot: getJackpot() });
});

// ── GET /api/games/stats ──────────────────────────────────────────────────────
router.get('/stats', authenticate, async (req, res) => {
  try {
    const [grouped, allBets] = await Promise.all([
      prisma.bet.groupBy({
        by: ['game'],
        where: { userId: req.user.id },
        _count: { id: true },
        _sum: { amount: true, result: true },
      }),
      prisma.bet.findMany({
        where: { userId: req.user.id },
        select: { game: true, amount: true, result: true, won: true, multiplier: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const bestBet = allBets.reduce((best, b) => {
      const profit = (b.result || 0) - b.amount;
      const bestProfit = (best?.result || 0) - (best?.amount || 0);
      return profit > bestProfit ? b : best;
    }, allBets[0] || null);

    let maxStreak = 0, currentStreak = 0;
    for (const b of allBets) {
      if (b.won === false) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak); }
      else currentStreak = 0;
    }

    const totalWagered = allBets.reduce((s, b) => s + b.amount, 0);
    const totalWins = allBets.filter(b => b.won).length;
    const totalGames = allBets.length;

    res.json({
      stats: grouped,
      advanced: {
        bestWin: bestBet ? { profit: (bestBet.result || 0) - bestBet.amount, game: bestBet.game, multiplier: bestBet.multiplier, date: bestBet.createdAt } : null,
        worstStreak: maxStreak,
        totalWagered,
        totalGames,
        winRate: totalGames > 0 ? (totalWins / totalGames * 100).toFixed(1) : '0',
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur statistiques' });
  }
});

module.exports = router;
