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
        avatar: `/api/avatars/default-${avatarIndex}.png`,
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
      expiresIn: process.env.JWT_EXPIRES_IN,
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
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        pseudo: user.pseudo,
        avatar: user.avatar,
        balance: user.balance,
        role: user.role,
        grade: user.grade,
        avatarBorder: user.avatarBorder,
        pseudoColor: user.pseudoColor,
      },
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
