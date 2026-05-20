const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { grantXp } = require('../games/xp');
const { getIo } = require('../socket/ioInstance');

const router = express.Router();

const HORSES = [
  { id: 1, name: 'Tonnerre Doré',    emoji: '🏇', color: '#f59e0b', baseOdds: 2.5  },
  { id: 2, name: 'Éclair Noir',      emoji: '🐎', color: '#1f2937', baseOdds: 3.0  },
  { id: 3, name: 'Vent Fou',         emoji: '🏇', color: '#ef4444', baseOdds: 4.5  },
  { id: 4, name: 'Star du Nord',     emoji: '🐴', color: '#3b82f6', baseOdds: 6.0  },
  { id: 5, name: 'Fantôme Royal',    emoji: '🏇', color: '#8b5cf6', baseOdds: 8.0  },
  { id: 6, name: 'Miracle Express',  emoji: '🐎', color: '#10b981', baseOdds: 12.0 },
];

function generateOdds() {
  return HORSES.map(h => ({
    ...h,
    odds: parseFloat((h.baseOdds * (0.85 + Math.random() * 0.3)).toFixed(2)),
  }));
}

function pickWinner(horsesWithOdds) {
  // Inverse des cotes = probabilité
  const weights = horsesWithOdds.map(h => 1 / h.odds);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < horsesWithOdds.length; i++) {
    r -= weights[i];
    if (r <= 0) return horsesWithOdds[i];
  }
  return horsesWithOdds[horsesWithOdds.length - 1];
}

router.get('/odds', (req, res) => {
  res.json({ horses: generateOdds() });
});

router.post('/race', authenticate, async (req, res) => {
  try {
    const { horseId, bet } = req.body;
    const mise = parseFloat(bet);
    const hId = parseInt(horseId);

    if (!mise || mise <= 0) return res.status(400).json({ error: 'Mise invalide' });
    if (!hId || hId < 1 || hId > 6) return res.status(400).json({ error: 'Cheval invalide' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.balance < mise) return res.status(400).json({ error: 'Solde insuffisant' });

    const horsesWithOdds = generateOdds();
    const winner = pickWinner(horsesWithOdds);
    const chosenHorse = horsesWithOdds.find(h => h.id === hId);
    const won = winner.id === hId;
    const payout = won ? parseFloat((mise * chosenHorse.odds).toFixed(2)) : 0;
    const profit = payout - mise;

    // Génère les positions finales (ordre d'arrivée)
    const shuffled = [...horsesWithOdds].sort(() => Math.random() - 0.5);
    const winnerIdx = shuffled.findIndex(h => h.id === winner.id);
    if (winnerIdx !== 0) {
      [shuffled[0], shuffled[winnerIdx]] = [shuffled[winnerIdx], shuffled[0]];
    }
    const ranking = shuffled.map((h, i) => ({ ...h, position: i + 1 }));

    const updates = { balance: { increment: profit } };
    if (!won) updates.rakeback = { increment: mise * 0.05 };

    await prisma.user.update({ where: { id: req.user.id }, data: updates });
    await prisma.transaction.create({
      data: {
        userId: req.user.id,
        type: profit > 0 ? 'WIN' : 'LOSS',
        amount: profit,
        description: `Course Hippique — Misé sur ${chosenHorse?.name} (${won ? '🏆 Gagné' : '❌ Perdu'})`,
      },
    });

    const newBalance = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } })).balance;
    grantXp(req.user.id, mise).catch(() => {});

    if (payout >= 1000) {
      const io = getIo();
      if (io) io.emit('livefeed:event', {
        id: `horse-${Date.now()}`,
        pseudo: user.pseudo,
        emoji: '🏇',
        message: `a gagné la course hippique sur ${winner.name}`,
        amount: payout,
        positive: true,
      });
    }

    res.json({ winner, chosenHorse, ranking, won, payout, profit, mise, odds: chosenHorse?.odds, newBalance });
  } catch (err) {
    console.error('Erreur courses:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = router;
