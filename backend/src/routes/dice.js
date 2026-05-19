const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { applyHappyHour, isHappyHour } = require('../utils/happyHour');

const router = express.Router();

// POST /api/games/dice/roll
// body: { amount, target, mode }
// mode: 'over' | 'under'
// target: 2-12 (valeur pivot)
// Probabilité: sur 36 combinaisons possibles avec 2 dés
router.post('/roll', authenticate, async (req, res) => {
  try {
    const { amount, target, mode } = req.body;
    const mise = parseFloat(amount);
    const pivot = parseInt(target);

    if (!mise || mise <= 0) return res.status(400).json({ error: 'Mise invalide' });
    if (!pivot || pivot < 3 || pivot > 11) return res.status(400).json({ error: 'Cible invalide (3–11)' });
    if (mode !== 'over' && mode !== 'under') return res.status(400).json({ error: 'Mode invalide' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.balance < mise) return res.status(400).json({ error: 'Solde insuffisant' });

    // Lancer les dés
    const de1 = Math.floor(Math.random() * 6) + 1;
    const de2 = Math.floor(Math.random() * 6) + 1;
    const total = de1 + de2;

    const gagne = mode === 'over' ? total > pivot : total < pivot;

    // Calculer le multiplicateur selon la probabilité réelle (36 combinaisons)
    const COMBOS = { 2:1,3:2,4:3,5:4,6:5,7:6,8:5,9:4,10:3,11:2,12:1 };
    let combosGagnantes = 0;
    for (let s = 2; s <= 12; s++) {
      if (mode === 'over' ? s > pivot : s < pivot) combosGagnantes += COMBOS[s];
    }
    const prob = combosGagnantes / 36;
    // Multiplicateur avec avantage maison de 3%
    const multiplicateur = prob > 0 ? Math.round((0.97 / prob) * 100) / 100 : 0;

    const gainBrut = gagne ? Math.round(mise * multiplicateur * 100) / 100 : 0;
    const gain = gagne ? applyHappyHour(mise, gainBrut) : 0;
    const balanceChange = gain - mise;

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: balanceChange } } }),
      prisma.bet.create({
        data: {
          userId: req.user.id,
          game: 'SLOTS', // pas de type DICE dans le schéma, on réutilise SLOTS
          amount: mise,
          multiplier: gagne ? multiplicateur : 0,
          result: gain,
          won: gagne,
          details: { de1, de2, total, target: pivot, mode, multiplicateur },
        },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
    res.json({ de1, de2, total, gagne, gain, multiplicateur, happyHour: isHappyHour(), newBalance: updatedUser.balance });
  } catch (err) {
    console.error('Erreur dice:', err);
    res.status(500).json({ error: 'Erreur lors du lancer' });
  }
});

module.exports = router;
