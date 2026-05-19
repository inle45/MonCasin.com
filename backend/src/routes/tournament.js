const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Début de la semaine (lundi 00:00)
function getWeekStart() {
  const now = new Date();
  const day = now.getDay(); // 0=dim, 1=lun...
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// GET /api/tournament — classement de la semaine
router.get('/', authenticate, async (req, res) => {
  try {
    const weekStart = getWeekStart();

    const bets = await prisma.bet.findMany({
      where: { createdAt: { gte: weekStart } },
      select: { userId: true, amount: true, result: true, won: true },
    });

    // Calculer profit net par joueur
    const profits = new Map();
    for (const bet of bets) {
      const prev = profits.get(bet.userId) || { profit: 0, bets: 0, wins: 0 };
      profits.set(bet.userId, {
        profit: prev.profit + (bet.result ?? 0) - bet.amount,
        bets: prev.bets + 1,
        wins: prev.wins + (bet.won ? 1 : 0),
      });
    }

    // Récupérer les infos des joueurs
    const userIds = [...profits.keys()];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, pseudo: true, avatar: true, grade: true, pseudoColor: true },
    });

    const classement = users
      .map(u => ({
        ...u,
        profit: Math.round((profits.get(u.id)?.profit ?? 0) * 100) / 100,
        bets: profits.get(u.id)?.bets ?? 0,
        wins: profits.get(u.id)?.wins ?? 0,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    // Cagnotte = 5% du volume total misé cette semaine
    const volume = bets.reduce((s, b) => s + b.amount, 0);
    const cagnotte = Math.round(volume * 0.05);

    const PRIX = [
      { place: 1, label: '🥇', pourcentage: 50 },
      { place: 2, label: '🥈', pourcentage: 30 },
      { place: 3, label: '🥉', pourcentage: 20 },
    ];

    res.json({
      classement,
      weekStart,
      weekEnd: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
      cagnotte,
      prix: PRIX.map(p => ({ ...p, montant: Math.round(cagnotte * p.pourcentage / 100) })),
      totalBets: bets.length,
      totalVolume: Math.round(volume),
    });
  } catch (err) {
    console.error('Erreur tournoi:', err);
    res.status(500).json({ error: 'Erreur tournoi' });
  }
});

module.exports = router;
