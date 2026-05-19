const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { startHilo, guessHilo, cashoutHilo, getHiloSession } = require('../games/hilo');
const { getIo } = require('../socket/ioInstance');
const { grantXp } = require('../games/xp');
const { tryCompleteChallenge } = require('./challenge');
const { applyHappyHour, isHappyHour } = require('../utils/happyHour');

const router = express.Router();

// POST /start
router.post('/start', authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    const mise = parseFloat(amount);
    if (!mise || mise <= 0) return res.status(400).json({ error: 'Mise invalide' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.balance < mise) return res.status(400).json({ error: 'Solde insuffisant' });

    await prisma.user.update({ where: { id: req.user.id }, data: { balance: { decrement: mise } } });

    const result = startHilo(req.user.id, mise);
    const updated = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
    res.json({ ...result, newBalance: updated.balance });
  } catch (err) {
    console.error('Erreur hilo start:', err);
    res.status(500).json({ error: 'Erreur démarrage' });
  }
});

// POST /guess
router.post('/guess', authenticate, async (req, res) => {
  try {
    const { direction } = req.body;
    const session = getHiloSession(req.user.id);
    const mise = session?.mise ?? 0;

    const result = guessHilo(req.user.id, direction);
    if (result.erreur) return res.status(400).json({ error: result.erreur });

    if (!result.correct) {
      await prisma.bet.create({
        data: {
          userId: req.user.id, game: 'SLOTS', amount: mise,
          multiplier: 0, result: 0, won: false,
          details: { game: 'HILO', direction },
        },
      });
      grantXp(req.user.id, mise).catch(() => {});
      const updated = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
      return res.json({ ...result, newBalance: updated.balance });
    }

    if (result.autoWin) {
      const gainFinal = applyHappyHour(mise, result.gainPotentiel);
      await prisma.$transaction([
        prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: gainFinal } } }),
        prisma.bet.create({
          data: {
            userId: req.user.id, game: 'SLOTS', amount: mise,
            multiplier: result.multiplier, result: gainFinal, won: true,
            details: { game: 'HILO', round: result.round, autoWin: true, happyHour: isHappyHour() },
          },
        }),
      ]);
      const updated = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
      return res.json({ ...result, gainPotentiel: gainFinal, happyHour: isHappyHour(), newBalance: updated.balance });
    }

    res.json(result);
  } catch (err) {
    console.error('Erreur hilo guess:', err);
    res.status(500).json({ error: 'Erreur révélation' });
  }
});

// POST /cashout
router.post('/cashout', authenticate, async (req, res) => {
  try {
    const session = getHiloSession(req.user.id);
    if (!session) return res.status(400).json({ error: 'Pas de partie active' });
    const mise = session.mise;

    const result = cashoutHilo(req.user.id);
    if (result.erreur) return res.status(400).json({ error: result.erreur });

    const gainFinal = applyHappyHour(mise, result.gain);

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: gainFinal } } }),
      prisma.bet.create({
        data: {
          userId: req.user.id, game: 'SLOTS', amount: mise,
          multiplier: result.multiplier, result: gainFinal, won: true,
          details: { game: 'HILO', multiplier: result.multiplier, happyHour: isHappyHour() },
        },
      }),
    ]);

    grantXp(req.user.id, mise).catch(() => {});
    const updated = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true, pseudo: true } });

    if (gainFinal >= 200) {
      const io = getIo();
      if (io) io.emit('livefeed:event', {
        id: `hl-${Date.now()}`,
        pseudo: updated.pseudo,
        emoji: result.multiplier >= 5 ? '🃏' : '🎴',
        message: `cashout ×${result.multiplier} au Hi-Lo`,
        amount: gainFinal,
        positive: true,
      });
    }

    tryCompleteChallenge(req.user.id, 'hilo_cashout', { wins: result.wins ?? 0 }).catch(() => {});

    res.json({ ...result, gain: gainFinal, happyHour: isHappyHour(), newBalance: updated.balance });
  } catch (err) {
    console.error('Erreur hilo cashout:', err);
    res.status(500).json({ error: 'Erreur cashout' });
  }
});

module.exports = router;
