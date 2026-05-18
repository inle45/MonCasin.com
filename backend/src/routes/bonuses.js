const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/bonuses/achievements — liste avec statut utilisateur
router.get('/achievements', authenticate, async (req, res) => {
  try {
    const [all, earned] = await Promise.all([
      prisma.achievement.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.userAchievement.findMany({
        where: { userId: req.user.id },
        include: { achievement: true },
      }),
    ]);

    const earnedIds = new Set(earned.map(e => e.achievementId));

    res.json({
      achievements: all.map(a => ({
        ...a,
        earned: earnedIds.has(a.id),
        earnedAt: earned.find(e => e.achievementId === a.id)?.earnedAt || null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// POST /api/bonuses/daily-spin — roue quotidienne
router.post('/daily-spin', authenticate, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.dailySpin.findFirst({
      where: { userId: req.user.id, spunAt: { gte: today } },
    });

    if (existing) {
      const next = new Date(today);
      next.setDate(next.getDate() + 1);
      return res.status(429).json({
        error: 'Tu as déjà tourné la roue aujourd\'hui',
        nextSpinAt: next.toISOString(),
      });
    }

    // Récompenses possibles avec probabilités
    const rewards = [
      { amount: 500, weight: 30 },
      { amount: 1000, weight: 25 },
      { amount: 1500, weight: 20 },
      { amount: 2000, weight: 12 },
      { amount: 3000, weight: 8 },
      { amount: 5000, weight: 5 },
    ];

    const total = rewards.reduce((s, r) => s + r.weight, 0);
    let rand = Math.random() * total;
    let reward = rewards[0];
    for (const r of rewards) {
      rand -= r.weight;
      if (rand <= 0) { reward = r; break; }
    }

    await prisma.$transaction([
      prisma.dailySpin.create({ data: { userId: req.user.id, reward: reward.amount } }),
      prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: reward.amount } } }),
      prisma.transaction.create({
        data: {
          userId: req.user.id,
          type: 'DAILY_SPIN',
          amount: reward.amount,
          description: `Roue de la Fortune quotidienne`,
        },
      }),
    ]);

    const updated = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { balance: true },
    });

    res.json({ reward: reward.amount, newBalance: updated.balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// GET /api/bonuses/daily-spin/status
router.get('/daily-spin/status', authenticate, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.dailySpin.findFirst({
      where: { userId: req.user.id, spunAt: { gte: today } },
    });

    const next = new Date(today);
    next.setDate(next.getDate() + 1);

    res.json({
      canSpin: !existing,
      nextSpinAt: existing ? next.toISOString() : null,
      lastReward: existing?.reward || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// POST /api/bonuses/bailout — aide d'urgence
router.post('/bailout', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (user.balance >= 100) {
      return res.status(400).json({ error: 'Ton solde est supérieur à 100 F€' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usages = await prisma.bailoutUsage.count({
      where: { userId: req.user.id, usedAt: { gte: today } },
    });

    if (usages >= 3) {
      return res.status(429).json({ error: 'Tu as déjà utilisé l\'aide 3 fois aujourd\'hui' });
    }

    await prisma.$transaction([
      prisma.bailoutUsage.create({ data: { userId: req.user.id, amount: 1000 } }),
      prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: 1000 } } }),
      prisma.transaction.create({
        data: {
          userId: req.user.id,
          type: 'BAILOUT',
          amount: 1000,
          description: `Aide d'urgence de l'État Fictif (${usages + 1}/3)`,
        },
      }),
    ]);

    const updated = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { balance: true },
    });

    res.json({
      amount: 1000,
      newBalance: updated.balance,
      usagesLeft: 2 - usages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// GET /api/bonuses/bailout/status
router.get('/bailout/status', authenticate, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const usages = await prisma.bailoutUsage.count({
      where: { userId: req.user.id, usedAt: { gte: today } },
    });
    res.json({ usagesLeft: 3 - usages });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// GET /api/bonuses/loans
router.get('/loans', authenticate, async (req, res) => {
  try {
    const loans = await prisma.loan.findMany({
      where: { borrowerId: req.user.id, repaid: false },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ loans });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// POST /api/bonuses/loans/request — emprunter 10 000 F€ à l'État
router.post('/loans/request', authenticate, async (req, res) => {
  try {
    const activeLoans = await prisma.loan.count({
      where: { borrowerId: req.user.id, repaid: false },
    });

    if (activeLoans > 0) {
      return res.status(400).json({ error: 'Tu as déjà un prêt en cours à rembourser' });
    }

    const LOAN_AMOUNT = 10000;
    const REPAYMENT = 12000;

    await prisma.$transaction([
      prisma.loan.create({
        data: {
          borrowerId: req.user.id,
          amount: LOAN_AMOUNT,
          amountDue: REPAYMENT,
          isStateLoan: true,
        },
      }),
      prisma.user.update({
        where: { id: req.user.id },
        data: { balance: { increment: LOAN_AMOUNT } },
      }),
      prisma.transaction.create({
        data: {
          userId: req.user.id,
          type: 'LOAN',
          amount: LOAN_AMOUNT,
          description: `Prêt de l'État Fictif (remboursement: 12 000 F€)`,
        },
      }),
    ]);

    const updated = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { balance: true },
    });

    res.json({ amount: LOAN_AMOUNT, amountDue: REPAYMENT, newBalance: updated.balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = router;
