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

module.exports = router;
