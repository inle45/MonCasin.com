const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { grantXp } = require('../games/xp');
const { getIo } = require('../socket/ioInstance');

const router = express.Router();

const SEGMENTS = [
  { label: '×0.5', multiplier: 0.5, color: '#ef4444', weight: 20 },
  { label: '×1.5', multiplier: 1.5, color: '#22c55e', weight: 25 },
  { label: '×2',   multiplier: 2,   color: '#3b82f6', weight: 18 },
  { label: '×3',   multiplier: 3,   color: '#f59e0b', weight: 13 },
  { label: '×0',   multiplier: 0,   color: '#6b7280', weight: 10 },
  { label: '×5',   multiplier: 5,   color: '#8b5cf6', weight: 7  },
  { label: '×10',  multiplier: 10,  color: '#ec4899', weight: 4  },
  { label: '×25',  multiplier: 25,  color: '#f59e0b', weight: 2  },
  { label: '×0.5', multiplier: 0.5, color: '#ef4444', weight: 10 },
  { label: '×1',   multiplier: 1,   color: '#64748b', weight: 15 },
  { label: '×2',   multiplier: 2,   color: '#3b82f6', weight: 12 },
  { label: '×50',  multiplier: 50,  color: '#fbbf24', weight: 1  },
];

function spin() {
  const total = SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SEGMENTS.length; i++) {
    r -= SEGMENTS[i].weight;
    if (r <= 0) return { segment: SEGMENTS[i], index: i };
  }
  return { segment: SEGMENTS[0], index: 0 };
}

router.get('/segments', (req, res) => res.json({ segments: SEGMENTS }));

router.post('/spin', authenticate, async (req, res) => {
  try {
    const bet = parseFloat(req.body.bet);
    if (!bet || bet <= 0) return res.status(400).json({ error: 'Mise invalide' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.balance < bet) return res.status(400).json({ error: 'Solde insuffisant' });

    const { segment, index } = spin();
    const payout = parseFloat((bet * segment.multiplier).toFixed(2));
    const profit = payout - bet;

    await prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: profit } } });
    await prisma.transaction.create({
      data: {
        userId: req.user.id,
        type: profit > 0 ? 'WIN' : profit < 0 ? 'LOSS' : 'BONUS',
        amount: profit,
        description: `Roue de la Richesse — ${segment.label}`,
      },
    });

    const newBalance = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } })).balance;
    grantXp(req.user.id, bet).catch(() => {});

    if (payout >= 1000) {
      const io = getIo();
      if (io) io.emit('livefeed:event', {
        id: `wheel-${Date.now()}`,
        pseudo: user.pseudo,
        emoji: segment.multiplier >= 25 ? '🎡' : '💰',
        message: `a gagné ${segment.label} à la Roue de la Richesse`,
        amount: payout,
        positive: true,
      });
    }

    res.json({ segment, index, payout, profit, newBalance });
  } catch (err) {
    console.error('Erreur roue:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = router;
