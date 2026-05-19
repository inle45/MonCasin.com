const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getIo } = require('../socket/ioInstance');

const router = express.Router();

const TICKET_PRICE = 100;
const NO_WINNER_CHANCE = 0.25;

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

async function computeJackpot(day, ticketCount) {
  const lastDraw = await prisma.lotteryDraw.findFirst({ orderBy: { drawnAt: 'desc' } });
  const rollover = lastDraw?.noWinner ? lastDraw.jackpot : 0;
  return ticketCount * TICKET_PRICE + rollover;
}

async function runDraw(day) {
  const existing = await prisma.lotteryDraw.findFirst({ where: { day } });
  if (existing) return existing;

  const tickets = await prisma.lotteryTicket.findMany({
    where: { day },
    include: { user: { select: { id: true, pseudo: true } } },
  });

  const jackpot = await computeJackpot(day, tickets.length);

  if (tickets.length === 0) {
    return prisma.lotteryDraw.create({ data: { day, jackpot: 0, noWinner: true } });
  }

  const noWinner = Math.random() < NO_WINNER_CHANCE;

  if (noWinner) {
    await prisma.lotteryDraw.create({ data: { day, jackpot, noWinner: true } });
    const io = getIo();
    if (io) io.emit('lottery:result', { day, noWinner: true, jackpot });
    return;
  }

  const winner = tickets[Math.floor(Math.random() * tickets.length)];

  await prisma.$transaction([
    prisma.lotteryDraw.create({ data: { day, winnerId: winner.userId, winnerPseudo: winner.user.pseudo, jackpot, noWinner: false } }),
    prisma.user.update({ where: { id: winner.userId }, data: { balance: { increment: jackpot } } }),
    prisma.transaction.create({
      data: { userId: winner.userId, type: 'BONUS', amount: jackpot, description: `Gagnant loterie du ${day}` },
    }),
  ]);

  const io = getIo();
  if (io) io.emit('lottery:result', {
    day,
    noWinner: false,
    jackpot,
    winner: { id: winner.userId, pseudo: winner.user.pseudo },
  });

  return { day, winner: winner.user, jackpot };
}

// Vérifie et lance les tirages en attente (appelé au démarrage et toutes les heures)
async function checkPendingDraw() {
  const yesterday = getYesterdayKey();
  try {
    await runDraw(yesterday);
  } catch (err) {
    console.error('Erreur tirage loterie:', err);
  }
}

// GET /api/lottery — état actuel
router.get('/', authenticate, async (req, res) => {
  try {
    const today = getTodayKey();

    const [tickets, myTicket, recentDraws] = await Promise.all([
      prisma.lotteryTicket.findMany({
        where: { day: today },
        include: { user: { select: { pseudo: true, avatar: true, grade: true } } },
      }),
      prisma.lotteryTicket.findUnique({ where: { userId_day: { userId: req.user.id, day: today } } }),
      prisma.lotteryDraw.findMany({
        orderBy: { drawnAt: 'desc' },
        take: 10,
      }),
    ]);

    const jackpot = await computeJackpot(today, tickets.length);

    res.json({
      day: today,
      jackpot,
      ticketPrice: TICKET_PRICE,
      hasTicket: !!myTicket,
      participants: tickets.map(t => ({ pseudo: t.user.pseudo, avatar: t.user.avatar, grade: t.user.grade })),
      history: recentDraws,
    });
  } catch (err) {
    console.error('Erreur loterie GET:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// POST /api/lottery/ticket — acheter un ticket
router.post('/ticket', authenticate, async (req, res) => {
  try {
    const today = getTodayKey();

    const existing = await prisma.lotteryTicket.findUnique({
      where: { userId_day: { userId: req.user.id, day: today } },
    });
    if (existing) return res.status(400).json({ error: 'Tu as déjà un ticket aujourd\'hui' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
    if (user.balance < TICKET_PRICE) return res.status(400).json({ error: 'Solde insuffisant' });

    await prisma.$transaction([
      prisma.lotteryTicket.create({ data: { userId: req.user.id, day: today } }),
      prisma.user.update({ where: { id: req.user.id }, data: { balance: { decrement: TICKET_PRICE } } }),
    ]);

    const updated = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });

    // Notifier tous les joueurs du nouveau participant
    const freshUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { pseudo: true, avatar: true, grade: true },
    });
    const io = getIo();
    if (io) io.emit('lottery:joined', { pseudo: freshUser.pseudo, avatar: freshUser.avatar, grade: freshUser.grade });

    res.json({ ok: true, newBalance: updated.balance });
  } catch (err) {
    console.error('Erreur achat ticket:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = { router, checkPendingDraw };
