const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

async function distributeTournamentRewards(io) {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    const prevWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const bets = await prisma.bet.findMany({
      where: { createdAt: { gte: prevWeekStart, lt: weekStart } },
      select: { userId: true, amount: true, result: true },
    });

    if (bets.length === 0) return;

    const profits = new Map();
    for (const bet of bets) {
      const prev = profits.get(bet.userId) || 0;
      profits.set(bet.userId, prev + (bet.result ?? 0) - bet.amount);
    }

    const volume = bets.reduce((s, b) => s + b.amount, 0);
    const cagnotte = Math.round(volume * 0.05);
    if (cagnotte <= 0) return;

    const sorted = [...profits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const PARTS = [0.5, 0.3, 0.2];

    for (let i = 0; i < sorted.length; i++) {
      const [userId] = sorted[i];
      const prize = Math.round(cagnotte * PARTS[i]);
      if (prize <= 0) continue;

      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { balance: { increment: prize } } }),
        prisma.transaction.create({
          data: {
            userId,
            type: 'BONUS',
            amount: prize,
            description: `Tournoi hebdomadaire — ${i === 0 ? '🥇 1ère' : i === 1 ? '🥈 2ème' : '🥉 3ème'} place`,
          },
        }),
      ]);

      if (io) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { pseudo: true } });
        if (user) {
          const medals = ['🥇', '🥈', '🥉'];
          io.emit('livefeed:event', {
            id: `tournament-${Date.now()}-${i}`,
            pseudo: user.pseudo,
            emoji: medals[i],
            message: `remporte la ${i === 0 ? '1ère' : i === 1 ? '2ème' : '3ème'} place du tournoi hebdomadaire`,
            amount: prize,
            positive: true,
          });
        }
      }
    }

    console.log(`🏆 Tournoi hebdomadaire distribué — cagnotte: ${cagnotte} F€`);
  } catch (err) {
    console.error('Erreur distribution tournoi:', err);
  }
}

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
module.exports.distributeTournamentRewards = distributeTournamentRewards;
