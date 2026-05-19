const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { demarrerMines, revelerCase, cashout, getSession } = require('../games/mines');
const { getIo } = require('../socket/ioInstance');
const { grantXp } = require('../games/xp');
const { tryCompleteChallenge } = require('./challenge');
const { applyHappyHour, isHappyHour } = require('../utils/happyHour');

const router = express.Router();

// POST /start — démarre une partie
router.post('/start', authenticate, async (req, res) => {
  try {
    const { amount, mines } = req.body;
    const mise = parseFloat(amount);
    const minesCount = parseInt(mines);

    if (!mise || mise <= 0) return res.status(400).json({ error: 'Mise invalide' });
    if (!minesCount || minesCount < 1 || minesCount > 20) return res.status(400).json({ error: 'Nombre de mines invalide (1-20)' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.balance < mise) return res.status(400).json({ error: 'Solde insuffisant' });

    // Débiter la mise immédiatement
    await prisma.user.update({ where: { id: req.user.id }, data: { balance: { decrement: mise } } });

    demarrerMines(req.user.id, mise, minesCount);

    const updatedUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
    res.json({ ok: true, newBalance: updatedUser.balance });
  } catch (err) {
    console.error('Erreur mines start:', err);
    res.status(500).json({ error: 'Erreur démarrage' });
  }
});

// POST /reveal — révèle une case
router.post('/reveal', authenticate, async (req, res) => {
  try {
    const { index } = req.body;
    if (index === undefined) return res.status(400).json({ error: 'Index manquant' });

    // Récupérer la session AVANT de révéler (pour avoir la mise)
    const sessionBefore = getSession(req.user.id);
    const mise = sessionBefore?.mise ?? 0;

    const result = revelerCase(req.user.id, index);
    if (result.erreur) return res.status(400).json({ error: result.erreur });

    if (result.mine) {
      // Pari perdu — enregistrer
      await prisma.bet.create({
        data: {
          userId: req.user.id,
          game: 'SLOTS',
          amount: mise,
          multiplier: 0,
          result: 0,
          won: false,
          details: { game: 'MINES', mine: true, index },
        },
      });
      grantXp(req.user.id, mise).catch(() => {});
      const updatedUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
      return res.json({ ...result, newBalance: updatedUser.balance });
    }

    if (result.autoWin) {
      const gainFinal = applyHappyHour(mise, result.gainPotentiel);
      if (gainFinal > 0) {
        await prisma.$transaction([
          prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: gainFinal } } }),
          prisma.bet.create({
            data: {
              userId: req.user.id,
              game: 'SLOTS',
              amount: mise,
              multiplier: result.multiplicateur,
              result: gainFinal,
              won: true,
              details: { game: 'MINES', autoWin: true, multiplicateur: result.multiplicateur, happyHour: isHappyHour() },
            },
          }),
        ]);
      }
      const updatedUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
      return res.json({ ...result, gainPotentiel: gainFinal, happyHour: isHappyHour(), newBalance: updatedUser.balance });
    }

    res.json(result);
  } catch (err) {
    console.error('Erreur mines reveal:', err);
    res.status(500).json({ error: 'Erreur révélation' });
  }
});

// POST /cashout — encaisser les gains
router.post('/cashout', authenticate, async (req, res) => {
  try {
    // Récupérer la mise avant cashout
    const session = getSession(req.user.id);
    if (!session) return res.status(400).json({ error: 'Pas de partie active' });
    const mise = session.mise;

    const result = cashout(req.user.id);
    if (result.erreur) return res.status(400).json({ error: result.erreur });

    const gainFinal = applyHappyHour(mise, result.gain);

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: gainFinal } } }),
      prisma.bet.create({
        data: {
          userId: req.user.id,
          game: 'SLOTS',
          amount: mise,
          multiplier: result.multiplicateur,
          result: gainFinal,
          won: true,
          details: { game: 'MINES', mines: result.mines, multiplicateur: result.multiplicateur, happyHour: isHappyHour() },
        },
      }),
    ]);

    grantXp(req.user.id, mise).catch(() => {});
    const updatedUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true, pseudo: true } });

    if (gainFinal >= 300) {
      const io = getIo();
      if (io) io.emit('livefeed:event', {
        id: `mn-${Date.now()}`,
        pseudo: updatedUser.pseudo,
        emoji: gainFinal >= 2000 ? '💎' : '💣',
        message: `cashout ×${result.multiplicateur} aux Mines`,
        amount: gainFinal,
        positive: true,
      });
    }

    tryCompleteChallenge(req.user.id, 'mines_cashout', { revealed: result.revealed?.length ?? 0 }).catch(() => {});

    res.json({ ...result, gain: gainFinal, happyHour: isHappyHour(), newBalance: updatedUser.balance });
  } catch (err) {
    console.error('Erreur mines cashout:', err);
    res.status(500).json({ error: 'Erreur cashout' });
  }
});

// GET /state — état de la session active
router.get('/state', authenticate, (req, res) => {
  const s = getSession(req.user.id);
  if (!s) return res.json({ active: false });
  res.json({ active: true, safe: s.safe, minesCount: s.minesCount, mise: s.mise, revealed: [...s.revealed] });
});

module.exports = router;
