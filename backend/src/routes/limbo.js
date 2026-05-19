const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { grantXp } = require('../games/xp');
const { getIo } = require('../socket/ioInstance');

const router = express.Router();
const HOUSE_EDGE = 0.03;
const MAX_MULTIPLIER = 1000000;
const MIN_TARGET = 1.01;

function generateResult() {
  const r = Math.random();
  if (r === 0) return MAX_MULTIPLIER;
  return Math.min(MAX_MULTIPLIER, (1 - HOUSE_EDGE) / r);
}

router.post('/play', authenticate, async (req, res) => {
  try {
    const bet = parseFloat(req.body.bet);
    const target = parseFloat(req.body.target);

    if (!bet || bet <= 0) return res.status(400).json({ error: 'Mise invalide' });
    if (!target || target < MIN_TARGET) return res.status(400).json({ error: `Cible minimum ${MIN_TARGET}x` });

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
    if (user.balance < bet) return res.status(400).json({ error: 'Solde insuffisant' });

    const result = parseFloat(generateResult().toFixed(2));
    const won = result >= target;
    const payout = won ? bet * target : 0;
    const profit = payout - bet;

    const updates = { balance: { increment: profit } };
    if (!won) updates.rakeback = { increment: bet * 0.05 };

    await prisma.user.update({ where: { id: req.user.id }, data: updates });

    await prisma.transaction.create({
      data: {
        userId: req.user.id,
        type: won ? 'WIN' : 'LOSS',
        amount: won ? profit : -bet,
        description: `Limbo x${target} → résultat x${result}`,
      },
    });

    const newBalance = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } })).balance;

    grantXp(req.user.id, bet).catch(() => {});

    if (won && payout >= 500) {
      const freshUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { pseudo: true } });
      const io = getIo();
      if (io && freshUser) {
        io.emit('livefeed:event', {
          id: `limbo-${Date.now()}`,
          pseudo: freshUser.pseudo,
          emoji: target >= 100 ? '🌙' : target >= 10 ? '🚀' : '⚡',
          message: `a visé x${target} au Limbo`,
          amount: payout,
          positive: true,
        });
      }
    }

    res.json({ result, target, bet, won, payout, newBalance });
  } catch (err) {
    console.error('Erreur limbo:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = router;
