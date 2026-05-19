const express = require('express');
const multer = require('multer');
const path = require('path');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont acceptées'));
    }
  },
});

router.get('/public/:pseudo', async (req, res) => {
  try {
    const [user, betStats, wonStats, gameGroups] = await Promise.all([
      prisma.user.findUnique({
        where: { pseudo: req.params.pseudo },
        select: {
          id: true,
          pseudo: true,
          avatar: true,
          grade: true,
          level: true,
          xp: true,
          streak: true,
          createdAt: true,
        },
      }),
      prisma.bet.aggregate({
        where: { user: { pseudo: req.params.pseudo } },
        _count: { id: true },
      }),
      prisma.bet.aggregate({
        where: { user: { pseudo: req.params.pseudo }, won: true },
        _count: { id: true },
        _max: { result: true, multiplier: true },
      }),
      prisma.bet.groupBy({
        by: ['game'],
        where: { user: { pseudo: req.params.pseudo } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 1,
      }),
    ]);

    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    res.json({
      pseudo: user.pseudo,
      avatar: user.avatar,
      grade: user.grade,
      level: user.level,
      xp: user.xp,
      streak: user.streak,
      createdAt: user.createdAt,
      stats: {
        totalBets: betStats._count.id,
        totalWon: wonStats._count.id,
        biggestWin: wonStats._max.result ?? 0,
        bestMultiplier: wonStats._max.multiplier ?? 0,
        favoriteGame: gameGroups[0]?.game ?? null,
      },
    });
  } catch (err) {
    console.error('Erreur public profile:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { balance: 'desc' },
      take: 20,
      select: {
        id: true,
        pseudo: true,
        avatar: true,
        balance: true,
        grade: true,
        avatarBorder: true,
        pseudoColor: true,
      },
    });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement du classement' });
  }
});

router.get('/profile/:id', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        pseudo: true,
        avatar: true,
        balance: true,
        grade: true,
        avatarBorder: true,
        pseudoColor: true,
        createdAt: true,
        _count: { select: { bets: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

router.post('/avatar', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const avatarUrl = `/api/uploads/${req.file.filename}`;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: avatarUrl },
      select: { id: true, avatar: true },
    });

    res.json({ avatar: user.avatar });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du téléchargement' });
  }
});

router.get('/history', authenticate, async (req, res) => {
  try {
    const bets = await prisma.bet.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ bets });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement de l\'historique' });
  }
});

router.get('/me/transactions', authenticate, async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement des transactions' });
  }
});

const GRADE_DAILY_INCOME = { NONE: 0, SILVER: 100, GOLD: 250, PLATINUM: 500, DIAMOND: 1000 };

router.post('/grade-income', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { grade: true } });
    const income = GRADE_DAILY_INCOME[user.grade] || 0;
    if (income === 0) return res.status(400).json({ error: 'Votre grade ne génère pas de revenu passif' });

    const today = new Date().toISOString().split('T')[0];
    const dayStart = new Date(today);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const existing = await prisma.transaction.findFirst({
      where: {
        userId: req.user.id,
        type: 'BONUS',
        description: 'Revenu quotidien grade',
        createdAt: { gte: dayStart, lt: dayEnd },
      },
    });
    if (existing) return res.status(400).json({ error: 'Revenu déjà réclamé aujourd\'hui' });

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: income } } }),
      prisma.transaction.create({
        data: { userId: req.user.id, type: 'BONUS', amount: income, description: 'Revenu quotidien grade' },
      }),
    ]);

    const updated = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
    res.json({ ok: true, income, newBalance: updated.balance });
  } catch (err) {
    console.error('Erreur grade-income:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = router;
