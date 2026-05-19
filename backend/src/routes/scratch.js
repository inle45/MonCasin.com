const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const SYMBOLS = ['🍒', '🍋', '🍊', '💎', '⭐', '🎰', '🎲', '💰', '🃏'];
const PRIZES = {
  '🍒🍒🍒': 500,
  '🍋🍋🍋': 1000,
  '🍊🍊🍊': 2000,
  '⭐⭐⭐': 5000,
  '🎲🎲🎲': 3000,
  '🃏🃏🃏': 4000,
  '🎰🎰🎰': 10000,
  '💰💰💰': 25000,
  '💎💎💎': 50000,
};

function generateGrid() {
  // 3x3 = 9 cells. Rigged lightly: 15% chance of a winning row
  const cells = Array.from({ length: 9 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);

  if (Math.random() < 0.15) {
    // Force a winning row
    const row = Math.floor(Math.random() * 3);
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    cells[row * 3] = sym;
    cells[row * 3 + 1] = sym;
    cells[row * 3 + 2] = sym;
  }

  return cells;
}

function calcPrize(cells) {
  let total = 0;
  for (let row = 0; row < 3; row++) {
    const trio = cells[row * 3] + cells[row * 3 + 1] + cells[row * 3 + 2];
    total += PRIZES[trio] ?? 0;
  }
  return total;
}

// GET /api/scratch/state — a-t-on déjà gratté aujourd'hui ?
router.get('/state', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const existing = await prisma.inventoryItem.findFirst({
      where: { userId: req.user.id, type: 'TICKET_ROUE', usedAt: { not: null } },
    });

    // On utilise un champ dédié via transaction, mais on va utiliser un système simple :
    // vérifier si l'utilisateur a déjà eu une transaction BONUS "Carte à gratter" aujourd'hui
    const alreadyScratched = await prisma.transaction.findFirst({
      where: {
        userId: req.user.id,
        type: 'BONUS',
        description: { startsWith: 'Carte à gratter' },
        createdAt: { gte: new Date(today) },
      },
    });

    res.json({ alreadyScratched: !!alreadyScratched });
  } catch (err) {
    console.error('Erreur scratch state:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// POST /api/scratch/play — gratter la carte (1 fois par jour gratuit)
router.post('/play', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const alreadyScratched = await prisma.transaction.findFirst({
      where: {
        userId: req.user.id,
        type: 'BONUS',
        description: { startsWith: 'Carte à gratter' },
        createdAt: { gte: new Date(today) },
      },
    });

    if (alreadyScratched) {
      return res.status(400).json({ error: 'Déjà utilisé aujourd\'hui' });
    }

    const cells = generateGrid();
    const prize = calcPrize(cells);

    const txns = [
      prisma.transaction.create({
        data: {
          userId: req.user.id,
          type: 'BONUS',
          amount: prize,
          description: `Carte à gratter — ${prize > 0 ? `+${prize} F€` : 'rien'}`,
        },
      }),
    ];

    if (prize > 0) {
      txns.push(
        prisma.user.update({
          where: { id: req.user.id },
          data: { balance: { increment: prize } },
        })
      );
    }

    await prisma.$transaction(txns);

    const newBalance = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } })).balance;

    res.json({ cells, prize, newBalance });
  } catch (err) {
    console.error('Erreur scratch play:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = router;
