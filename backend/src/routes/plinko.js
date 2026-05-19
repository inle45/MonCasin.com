const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { grantXp } = require('../games/xp');
const { getIo } = require('../socket/ioInstance');

const router = express.Router();

const MULTIPLIERS = {
  low: {
    8:  [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    12: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8:  [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    16: [110, 41, 10, 5, 3, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8:  [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [100, 41, 10, 5, 3, 1.5, 0.2, 1.5, 3, 5, 10, 41, 100],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

router.post('/play', authenticate, async (req, res) => {
  try {
    const bet = parseFloat(req.body.bet);
    const risk = req.body.risk || 'medium';
    const rows = parseInt(req.body.rows) || 8;

    if (!bet || bet <= 0) return res.status(400).json({ error: 'Mise invalide' });
    if (!['low', 'medium', 'high'].includes(risk)) return res.status(400).json({ error: 'Risque invalide' });
    if (![8, 12, 16].includes(rows)) return res.status(400).json({ error: 'Lignes invalides (8, 12, 16)' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
    if (user.balance < bet) return res.status(400).json({ error: 'Solde insuffisant' });

    // Générer le chemin de la balle
    const path = Array.from({ length: rows }, () => Math.random() < 0.5 ? 0 : 1);
    const bucket = path.reduce((a, b) => a + b, 0);
    const multiplier = MULTIPLIERS[risk][rows][bucket];
    const payout = parseFloat((bet * multiplier).toFixed(2));
    const won = multiplier >= 1;

    const profit = payout - bet;
    const updates = { balance: { increment: profit } };
    if (!won) updates.rakeback = { increment: bet * 0.05 };

    await prisma.user.update({ where: { id: req.user.id }, data: updates });

    await prisma.transaction.create({
      data: {
        userId: req.user.id,
        type: multiplier >= 1 ? 'WIN' : 'LOSS',
        amount: profit,
        description: `Plinko ${risk} x${multiplier} (${rows} lignes)`,
      },
    });

    const newBalance = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } })).balance;

    grantXp(req.user.id, bet).catch(() => {});

    if (payout >= 1000) {
      const freshUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { pseudo: true } });
      const io = getIo();
      if (io && freshUser) {
        io.emit('livefeed:event', {
          id: `plinko-${Date.now()}`,
          pseudo: freshUser.pseudo,
          emoji: multiplier >= 100 ? '💎' : multiplier >= 10 ? '🎯' : '🪙',
          message: `x${multiplier} au Plinko ${risk}`,
          amount: payout,
          positive: true,
        });
      }
    }

    res.json({ path, bucket, multiplier, payout, newBalance });
  } catch (err) {
    console.error('Erreur plinko:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = router;
