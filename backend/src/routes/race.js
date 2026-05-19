const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getIo } = require('../socket/ioInstance');

const router = express.Router();

const REWARDS = { 1: 10000, 2: 5000, 3: 2000 };

function getWeekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lundi
  return d.toISOString().split('T')[0];
}

function getWeekRange() {
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  return { monday, sunday };
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { monday, sunday } = getWeekRange();

    const bets = await prisma.bet.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: monday, lt: sunday } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    });

    const userIds = bets.map(b => b.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, pseudo: true, avatar: true, grade: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const leaderboard = bets.map((b, i) => ({
      rank: i + 1,
      userId: b.userId,
      pseudo: userMap[b.userId]?.pseudo ?? '?',
      avatar: userMap[b.userId]?.avatar ?? null,
      grade: userMap[b.userId]?.grade ?? 'NONE',
      wagered: b._sum.amount ?? 0,
      reward: REWARDS[i + 1] ?? 0,
    }));

    // Position du joueur courant
    const myBet = await prisma.bet.aggregate({
      where: { userId: req.user.id, createdAt: { gte: monday, lt: sunday } },
      _sum: { amount: true },
    });
    const myWagered = myBet._sum.amount ?? 0;
    const myRank = leaderboard.findIndex(e => e.userId === req.user.id) + 1;

    const weekStart = monday.toISOString().split('T')[0];
    const weekEnd = new Date(sunday.getTime() - 1).toISOString().split('T')[0];

    res.json({ leaderboard, myWagered, myRank: myRank || null, weekStart, weekEnd, rewards: REWARDS });
  } catch (err) {
    console.error('Erreur race:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Appelé chaque lundi pour distribuer les récompenses
async function distributeRaceRewards() {
  try {
    const lastWeekMonday = new Date();
    lastWeekMonday.setHours(0, 0, 0, 0);
    lastWeekMonday.setDate(lastWeekMonday.getDate() - ((lastWeekMonday.getDay() + 6) % 7) - 7);
    const lastWeekSunday = new Date(lastWeekMonday);
    lastWeekSunday.setDate(lastWeekMonday.getDate() + 7);
    const weekKey = getWeekKey(lastWeekMonday);
    const desc = `Wager Race semaine ${weekKey}`;

    const alreadyPaid = await prisma.transaction.findFirst({ where: { description: desc } });
    if (alreadyPaid) return;

    const bets = await prisma.bet.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: lastWeekMonday, lt: lastWeekSunday } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 3,
    });

    const io = getIo();
    for (let i = 0; i < bets.length; i++) {
      const reward = REWARDS[i + 1];
      if (!reward) continue;
      const uid = bets[i].userId;
      await prisma.$transaction([
        prisma.user.update({ where: { id: uid }, data: { balance: { increment: reward } } }),
        prisma.transaction.create({ data: { userId: uid, type: 'BONUS', amount: reward, description: desc } }),
      ]);
      const u = await prisma.user.findUnique({ where: { id: uid }, select: { pseudo: true } });
      if (io && u) {
        io.emit('livefeed:event', {
          id: `race-${Date.now()}-${i}`,
          pseudo: u.pseudo,
          emoji: ['🥇', '🥈', '🥉'][i],
          message: `remporte la Wager Race (Top ${i + 1})`,
          amount: reward,
          positive: true,
        });
      }
    }
    console.log(`✅ Wager Race récompenses distribuées pour ${weekKey}`);
  } catch (err) {
    console.error('Erreur distribution race:', err);
  }
}

module.exports = { router, distributeRaceRewards };
