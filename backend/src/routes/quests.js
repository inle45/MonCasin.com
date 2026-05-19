const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const QUEST_POOL = [
  { key: 'play_5_any',       title: '🎯 Joueur du jour',  desc: 'Joue 5 parties sur n\'importe quel jeu', target: 5,    reward: 200, unit: 'parties'  },
  { key: 'win_3_any',        title: '🏆 En forme',        desc: 'Gagne 3 fois sur n\'importe quel jeu',  target: 3,    reward: 300, unit: 'victoires' },
  { key: 'win_5_any',        title: '🌟 Invincible',      desc: 'Gagne 5 fois dans la journée',          target: 5,    reward: 500, unit: 'victoires' },
  { key: 'play_3_crash',     title: '⚡ Accro au Crash',  desc: 'Joue 3 parties de Crash',               target: 3,    reward: 250, unit: 'parties'  },
  { key: 'cashout_2_crash',  title: '💰 Cashout malin',   desc: 'Cash out 2 fois au Crash',              target: 2,    reward: 400, unit: 'cashouts' },
  { key: 'crash_2x',        title: '🚀 Doubleur',         desc: 'Cash out à 2x ou plus au Crash',        target: 1,    reward: 200, unit: 'fois'     },
  { key: 'play_3_roulette',  title: '🎡 La roue tourne',  desc: 'Joue 3 fois à la Roulette',             target: 3,    reward: 250, unit: 'parties'  },
  { key: 'win_2_roulette',   title: '🎰 Roulettiste',     desc: 'Gagne 2 fois à la Roulette',            target: 2,    reward: 350, unit: 'victoires' },
  { key: 'big_bet',          title: '💸 Gros joueur',     desc: 'Mise au moins 500 F€ en une seule fois', target: 1,   reward: 300, unit: 'fois'     },
  { key: 'wagered_1000',     title: '🎲 Toujours là',     desc: 'Mise 1000 F€ au total aujourd\'hui',    target: 1000, reward: 150, unit: 'F€'       },
];

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getTodayQuests() {
  const today = getTodayKey();
  let s = parseInt(today.replace(/-/g, ''), 10);
  const indices = [];
  while (indices.length < 3) {
    s = Math.abs((Math.imul(s, 1664525) + 1013904223) | 0);
    const idx = Math.abs(s) % QUEST_POOL.length;
    if (!indices.includes(idx)) indices.push(idx);
  }
  return indices.map(i => QUEST_POOL[i]);
}

function computeProgress(questKey, bets) {
  switch (questKey) {
    case 'play_5_any':      return bets.length;
    case 'win_3_any':       return bets.filter(b => b.won).length;
    case 'win_5_any':       return bets.filter(b => b.won).length;
    case 'play_3_crash':    return bets.filter(b => b.game === 'CRASH').length;
    case 'cashout_2_crash': return bets.filter(b => b.game === 'CRASH' && b.won).length;
    case 'crash_2x':        return bets.filter(b => b.game === 'CRASH' && b.won && (b.multiplier || 0) >= 2).length;
    case 'play_3_roulette': return bets.filter(b => b.game === 'ROULETTE').length;
    case 'win_2_roulette':  return bets.filter(b => b.game === 'ROULETTE' && b.won).length;
    case 'big_bet':         return bets.filter(b => b.amount >= 500).length;
    case 'wagered_1000':    return Math.round(bets.reduce((s, b) => s + b.amount, 0));
    default: return 0;
  }
}

// GET /api/quests — quêtes du jour + progression
router.get('/', authenticate, async (req, res) => {
  try {
    const today = getTodayKey();
    const quests = getTodayQuests();

    const dayStart = new Date(today);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const [bets, claimed] = await Promise.all([
      prisma.bet.findMany({
        where: { userId: req.user.id, createdAt: { gte: dayStart, lt: dayEnd } },
        select: { game: true, amount: true, won: true, multiplier: true },
      }),
      prisma.userDailyQuest.findMany({
        where: { userId: req.user.id, day: today },
      }),
    ]);

    const claimedKeys = new Set(claimed.map(c => c.questKey));

    const result = quests.map(q => {
      const progress = computeProgress(q.key, bets);
      return {
        ...q,
        progress: Math.min(progress, q.target),
        completed: progress >= q.target,
        claimed: claimedKeys.has(q.key),
      };
    });

    res.json({ quests: result, day: today });
  } catch (err) {
    console.error('Erreur quêtes:', err);
    res.status(500).json({ error: 'Erreur quêtes' });
  }
});

// POST /api/quests/:key/claim — réclamer la récompense
router.post('/:key/claim', authenticate, async (req, res) => {
  try {
    const { key } = req.params;
    const today = getTodayKey();
    const quests = getTodayQuests();
    const quest = quests.find(q => q.key === key);

    if (!quest) return res.status(400).json({ error: 'Quête introuvable pour aujourd\'hui' });

    const already = await prisma.userDailyQuest.findUnique({
      where: { userId_questKey_day: { userId: req.user.id, questKey: key, day: today } },
    });
    if (already) return res.status(400).json({ error: 'Récompense déjà réclamée' });

    const dayStart = new Date(today);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const bets = await prisma.bet.findMany({
      where: { userId: req.user.id, createdAt: { gte: dayStart, lt: dayEnd } },
      select: { game: true, amount: true, won: true, multiplier: true },
    });

    const progress = computeProgress(key, bets);
    if (progress < quest.target) {
      return res.status(400).json({ error: 'Quête non complétée', progress, target: quest.target });
    }

    await prisma.$transaction([
      prisma.userDailyQuest.create({
        data: { userId: req.user.id, questKey: key, day: today, claimedAt: new Date() },
      }),
      prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: quest.reward } } }),
      prisma.transaction.create({
        data: { userId: req.user.id, type: 'BONUS', amount: quest.reward, description: `Quête : ${quest.title}` },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
    res.json({ ok: true, reward: quest.reward, newBalance: updatedUser.balance });
  } catch (err) {
    console.error('Erreur claim quête:', err);
    res.status(500).json({ error: 'Erreur réclamation' });
  }
});

module.exports = router;
