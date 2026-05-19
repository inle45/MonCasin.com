const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getTodayChallenge, checkChallenge } = require('../utils/challenges');
const { getIo } = require('../socket/ioInstance');

const router = express.Router();

// GET /api/challenge — état du défi du jour
router.get('/', authenticate, async (req, res) => {
  try {
    const challenge = getTodayChallenge();
    const record = await prisma.dailyChallenge.findUnique({ where: { day: challenge.day } });
    res.json({
      ...challenge,
      completed: !!record?.winnerId,
      winnerId: record?.winnerId ?? null,
      winnerPseudo: record?.winnerPseudo ?? null,
      completedAt: record?.completedAt ?? null,
    });
  } catch (err) {
    console.error('Erreur challenge GET:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// POST /api/challenge/check — vérifie si un événement complète le défi
async function tryCompleteChallenge(userId, event, data) {
  try {
    const challenge = getTodayChallenge();
    if (!checkChallenge(event, data)) return;

    const existing = await prisma.dailyChallenge.findUnique({ where: { day: challenge.day } });
    if (existing?.winnerId) return; // déjà complété

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pseudo: true } });

    await prisma.$transaction([
      prisma.dailyChallenge.upsert({
        where: { day: challenge.day },
        create: {
          day: challenge.day,
          challengeKey: challenge.key,
          winnerId: userId,
          winnerPseudo: user.pseudo,
          completedAt: new Date(),
        },
        update: {
          winnerId: userId,
          winnerPseudo: user.pseudo,
          completedAt: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { balance: { increment: challenge.reward } },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: 'BONUS',
          amount: challenge.reward,
          description: `Défi du jour complété : ${challenge.description}`,
        },
      }),
    ]);

    const io = getIo();
    if (io) {
      io.emit('challenge:completed', {
        pseudo: user.pseudo,
        description: challenge.description,
        reward: challenge.reward,
        emoji: challenge.emoji,
      });
    }
  } catch (err) {
    console.error('Erreur tryCompleteChallenge:', err);
  }
}

module.exports = { router, tryCompleteChallenge };
