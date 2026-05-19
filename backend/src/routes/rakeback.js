const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

router.get('/', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { rakeback: true } });

    const lastClaim = await prisma.transaction.findFirst({
      where: { userId: req.user.id, description: 'Rakeback réclamé' },
      orderBy: { createdAt: 'desc' },
    });

    const canClaim = !lastClaim || (Date.now() - new Date(lastClaim.createdAt).getTime()) >= COOLDOWN_MS;
    const nextClaimAt = lastClaim ? new Date(new Date(lastClaim.createdAt).getTime() + COOLDOWN_MS) : null;

    res.json({ rakeback: user.rakeback, canClaim, nextClaimAt });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

router.post('/claim', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { rakeback: true } });

    if (user.rakeback < 1) return res.status(400).json({ error: 'Aucun rakeback disponible (minimum 1 F€)' });

    const lastClaim = await prisma.transaction.findFirst({
      where: { userId: req.user.id, description: 'Rakeback réclamé' },
      orderBy: { createdAt: 'desc' },
    });

    if (lastClaim && (Date.now() - new Date(lastClaim.createdAt).getTime()) < COOLDOWN_MS) {
      const next = new Date(new Date(lastClaim.createdAt).getTime() + COOLDOWN_MS);
      return res.status(400).json({ error: `Rakeback déjà réclamé. Prochain à ${next.toLocaleTimeString('fr-FR')}` });
    }

    const amount = Math.floor(user.rakeback);

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: amount }, rakeback: 0 } }),
      prisma.transaction.create({
        data: { userId: req.user.id, type: 'BONUS', amount, description: 'Rakeback réclamé' },
      }),
    ]);

    const newBalance = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } })).balance;

    res.json({ ok: true, amount, newBalance });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = router;
