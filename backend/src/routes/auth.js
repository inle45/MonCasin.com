const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, pseudo, password } = req.body;

    if (!email || !pseudo || !password) {
      return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    const existingPseudo = await prisma.user.findUnique({ where: { pseudo } });
    if (existingPseudo) {
      return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const avatarIndex = Math.floor(Math.random() * 5) + 1;

    const user = await prisma.user.create({
      data: {
        email,
        pseudo,
        password: hashedPassword,
        avatar: `/avatars/default-${avatarIndex}.svg`,
        balance: 10000,
      },
    });

    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'BONUS',
        amount: 10000,
        description: 'Bonus de bienvenue',
      },
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        pseudo: user.pseudo,
        avatar: user.avatar,
        balance: user.balance,
        role: user.role,
        grade: user.grade,
        xp: 0,
        level: 1,
      },
    });
  } catch (err) {
    console.error('Erreur inscription:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    // Mise à jour du streak de connexion
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let newStreak = user.streak || 0;
    let streakBonus = 0;

    if (user.lastLoginDate !== today) {
      newStreak = user.lastLoginDate === yesterday ? newStreak + 1 : 1;
      const STREAK_BONUSES = { 2:200, 3:300, 5:500, 7:1000, 10:2000, 14:3000, 21:5000, 30:10000 };
      streakBonus = STREAK_BONUSES[newStreak] || 0;
      const streakUpdates = { streak: newStreak, lastLoginDate: today };
      if (streakBonus > 0) streakUpdates.balance = { increment: streakBonus };
      await prisma.user.update({ where: { id: user.id }, data: streakUpdates });
      if (streakBonus > 0) {
        await prisma.transaction.create({
          data: { userId: user.id, type: 'BONUS', amount: streakBonus, description: `Streak jour ${newStreak}` },
        });
      }
    }

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });

    res.json({
      token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        pseudo: updatedUser.pseudo,
        avatar: updatedUser.avatar,
        balance: updatedUser.balance,
        role: updatedUser.role,
        grade: updatedUser.grade,
        avatarBorder: updatedUser.avatarBorder,
        pseudoColor: updatedUser.pseudoColor,
        xp: updatedUser.xp,
        level: updatedUser.level,
        streak: newStreak,
      },
      streakBonus,
    });
  } catch (err) {
    console.error('Erreur connexion:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

router.put('/profile', authenticate, async (req, res) => {
  try {
    const { pseudo } = req.body;

    if (pseudo && pseudo !== req.user.pseudo) {
      const existing = await prisma.user.findUnique({ where: { pseudo } });
      if (existing) {
        return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { pseudo: pseudo || req.user.pseudo },
      select: {
        id: true, email: true, pseudo: true, avatar: true,
        balance: true, role: true, grade: true, avatarBorder: true, pseudoColor: true,
      },
    });

    res.json({ user: updated });
  } catch (err) {
    console.error('Erreur mise à jour profil:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;
