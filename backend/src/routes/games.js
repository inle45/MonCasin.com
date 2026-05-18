const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { spin } = require('../games/slots');

const router = express.Router();

router.post('/slots/spin', authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    const betAmount = parseFloat(amount);

    if (!betAmount || betAmount <= 0) {
      return res.status(400).json({ error: 'Montant de mise invalide' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.balance < betAmount) {
      return res.status(400).json({ error: 'Solde insuffisant' });
    }

    const result = spin(betAmount);

    const balanceChange = result.winAmount - betAmount;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { balance: { increment: balanceChange } },
      }),
      prisma.bet.create({
        data: {
          userId: req.user.id,
          game: 'SLOTS',
          amount: betAmount,
          multiplier: result.multiplier,
          result: result.winAmount,
          won: result.won,
          details: { reels: result.reels, winType: result.winType },
        },
      }),
      prisma.transaction.create({
        data: {
          userId: req.user.id,
          type: result.won ? 'WIN' : 'BET',
          amount: balanceChange,
          description: result.won
            ? `Gain Slots: ${result.multiplier}x (${result.winType})`
            : 'Mise Slots perdue',
        },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { balance: true },
    });

    res.json({
      ...result,
      newBalance: updatedUser.balance,
    });
  } catch (err) {
    console.error('Erreur slots:', err);
    res.status(500).json({ error: 'Erreur lors du spin' });
  }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await prisma.bet.groupBy({
      by: ['game'],
      where: { userId: req.user.id },
      _count: { id: true },
      _sum: { amount: true, result: true },
    });

    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement des statistiques' });
  }
});

module.exports = router;
