const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { demarrerMines, revelerCase, cashout, getSession } = require('../games/mines');

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

    const result = revelerCase(req.user.id, index);
    if (result.erreur) return res.status(400).json({ error: result.erreur });

    // Si mine ou autoWin → enregistrer le bet
    if (result.mine || result.autoWin) {
      const session = result.mine
        ? { mise: 0, gain: 0, multiplicateur: 0 }
        : { gain: result.gainPotentiel, multiplicateur: result.multiplicateur };

      // Trouver la mise depuis le résultat ou chercher en DB
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });

      if (result.autoWin && result.gainPotentiel > 0) {
        await prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: result.gainPotentiel } } });
      }

      const updatedUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
      return res.json({ ...result, newBalance: updatedUser.balance });
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

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: result.gain } } }),
      prisma.bet.create({
        data: {
          userId: req.user.id,
          game: 'SLOTS',
          amount: mise,
          multiplier: result.multiplicateur,
          result: result.gain,
          won: true,
          details: { game: 'MINES', mines: result.mines, multiplicateur: result.multiplicateur },
        },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
    res.json({ ...result, newBalance: updatedUser.balance });
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
