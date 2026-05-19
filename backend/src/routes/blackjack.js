const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { grantXp } = require('../games/xp');
const { applyHappyHour, isHappyHour } = require('../utils/happyHour');
const bj = require('../games/blackjack');

const router = express.Router();

function sessionView(session, hideDealer = true) {
  return {
    playerHand: session.playerHand,
    dealerHand: hideDealer ? [session.dealerHand[0], { rank: '?', suit: '?' }] : session.dealerHand,
    playerTotal: bj.handTotal(session.playerHand),
    dealerTotal: hideDealer ? bj.handTotal([session.dealerHand[0]]) : bj.handTotal(session.dealerHand),
    status: session.status,
    bet: session.bet,
    doubled: session.doubled,
    happyHour: isHappyHour(),
  };
}

router.get('/state', authenticate, (req, res) => {
  const session = bj.getSession(req.user.id);
  if (!session) return res.json({ session: null });
  const done = session.status !== 'playing';
  res.json({ session: sessionView(session, !done) });
});

router.post('/start', authenticate, async (req, res) => {
  try {
    const bet = parseFloat(req.body.bet);
    if (!bet || bet <= 0) return res.status(400).json({ error: 'Mise invalide' });

    const existing = bj.getSession(req.user.id);
    if (existing && existing.status === 'playing') return res.status(400).json({ error: 'Partie en cours' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
    if (user.balance < bet) return res.status(400).json({ error: 'Solde insuffisant' });

    await prisma.user.update({ where: { id: req.user.id }, data: { balance: { decrement: bet } } });
    const session = bj.startGame(req.user.id, bet);

    // Blackjack immédiat ?
    if (bj.isBlackjack(session.playerHand)) {
      const result = bj.resolveResult(session);
      let payout = applyHappyHour(bet, result.payout);
      const profit = payout - bet;
      bj.clearSession(req.user.id);

      if (payout > 0) await prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: payout } } });
      if (!bj.isBlackjack(session.dealerHand)) {
        await prisma.transaction.create({ data: { userId: req.user.id, type: 'WIN', amount: profit, description: 'Blackjack !' } });
      }
      const newBalance = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } })).balance;
      grantXp(req.user.id, bet).catch(() => {});
      return res.json({ session: sessionView(session, false), result: { ...result, payout }, newBalance });
    }

    const newBalance = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } })).balance;
    res.json({ session: sessionView(session, true), newBalance });
  } catch (err) {
    console.error('BJ start:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

router.post('/hit', authenticate, async (req, res) => {
  try {
    const session = bj.hit(req.user.id);
    if (!session) return res.status(400).json({ error: 'Pas de partie en cours' });

    const done = session.status !== 'playing';
    if (done && session.status === 'bust') {
      const bet = session.bet;
      bj.clearSession(req.user.id);
      await prisma.transaction.create({ data: { userId: req.user.id, type: 'LOSS', amount: -bet, description: 'Blackjack bustée' } });
      grantXp(req.user.id, bet).catch(() => {});
      const newBalance = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } })).balance;
      return res.json({ session: sessionView(session, false), result: { status: 'bust', payout: 0 }, newBalance });
    }

    res.json({ session: sessionView(session, !done) });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

router.post('/stand', authenticate, async (req, res) => {
  try {
    const session = bj.stand(req.user.id);
    if (!session) return res.status(400).json({ error: 'Pas de partie en cours' });
    await finishGame(req, res, session);
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

router.post('/double', authenticate, async (req, res) => {
  try {
    const existing = bj.getSession(req.user.id);
    if (!existing || existing.playerHand.length !== 2) return res.status(400).json({ error: 'Double impossible' });
    const extraBet = existing.bet; // bet will be doubled inside
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
    if (user.balance < extraBet) return res.status(400).json({ error: 'Solde insuffisant pour doubler' });
    await prisma.user.update({ where: { id: req.user.id }, data: { balance: { decrement: extraBet } } });
    const session = bj.double(req.user.id);
    if (!session) return res.status(400).json({ error: 'Erreur double' });
    await finishGame(req, res, session);
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

async function finishGame(req, res, session) {
  const result = bj.resolveResult(session);
  let payout = applyHappyHour(session.bet, result.payout);
  const profit = payout - session.bet;
  const bet = session.bet;
  bj.clearSession(req.user.id);

  if (payout > 0) await prisma.user.update({ where: { id: req.user.id }, data: { balance: { increment: payout } } });
  await prisma.transaction.create({
    data: {
      userId: req.user.id,
      type: profit > 0 ? 'WIN' : profit < 0 ? 'LOSS' : 'BONUS',
      amount: profit,
      description: `Blackjack: ${result.status}`,
    },
  });

  const newBalance = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } })).balance;
  grantXp(req.user.id, bet).catch(() => {});
  res.json({ session: sessionView(session, false), result: { ...result, payout }, newBalance });
}

module.exports = router;
