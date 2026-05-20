const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { grantXp } = require('../games/xp');
const { applyHappyHour } = require('../utils/happyHour');
const { getIo } = require('../socket/ioInstance');

const router = express.Router();

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function newDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return deck.sort(() => Math.random() - 0.5);
}

function cardValue(card) {
  if (['10', 'J', 'Q', 'K'].includes(card.rank)) return 0;
  if (card.rank === 'A') return 1;
  return parseInt(card.rank);
}

function handTotal(cards) {
  return cards.reduce((s, c) => s + cardValue(c), 0) % 10;
}

function playBaccarat() {
  const deck = newDeck();
  let di = 0;
  const playerCards = [deck[di++], deck[di++]];
  const bankerCards = [deck[di++], deck[di++]];

  let playerTotal = handTotal(playerCards);
  let bankerTotal = handTotal(bankerCards);

  // Natural
  const natural = playerTotal >= 8 || bankerTotal >= 8;

  if (!natural) {
    // Player draws
    if (playerTotal <= 5) {
      playerCards.push(deck[di++]);
      playerTotal = handTotal(playerCards);
    }
    // Banker draws
    const playerThird = playerCards[2];
    if (!playerThird) {
      if (bankerTotal <= 5) { bankerCards.push(deck[di++]); bankerTotal = handTotal(bankerCards); }
    } else {
      const pv = cardValue(playerThird);
      const shouldDraw =
        bankerTotal <= 2 ||
        (bankerTotal === 3 && pv !== 8) ||
        (bankerTotal === 4 && [2,3,4,5,6,7].includes(pv)) ||
        (bankerTotal === 5 && [4,5,6,7].includes(pv)) ||
        (bankerTotal === 6 && [6,7].includes(pv));
      if (shouldDraw) { bankerCards.push(deck[di++]); bankerTotal = handTotal(bankerCards); }
    }
  }

  const winner = playerTotal > bankerTotal ? 'player' : bankerTotal > playerTotal ? 'banker' : 'tie';
  return { playerCards, bankerCards, playerTotal, bankerTotal, winner, natural };
}

router.post('/play', authenticate, async (req, res) => {
  try {
    const { bet, betOn } = req.body;
    const mise = parseFloat(bet);
    if (!mise || mise <= 0) return res.status(400).json({ error: 'Mise invalide' });
    if (!['player', 'banker', 'tie'].includes(betOn)) return res.status(400).json({ error: 'Pari invalide' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.balance < mise) return res.status(400).json({ error: 'Solde insuffisant' });

    const result = playBaccarat();
    let payout = 0;
    if (result.winner === betOn) {
      if (betOn === 'tie') payout = mise * 9;
      else if (betOn === 'banker') payout = mise + mise * 0.95;
      else payout = mise * 2;
    }
    payout = applyHappyHour(mise, payout);
    const profit = payout - mise;

    const updates = { balance: { increment: profit } };
    if (profit < 0) updates.rakeback = { increment: mise * 0.05 };

    await prisma.user.update({ where: { id: req.user.id }, data: updates });
    await prisma.transaction.create({
      data: {
        userId: req.user.id,
        type: profit > 0 ? 'WIN' : profit < 0 ? 'LOSS' : 'BONUS',
        amount: profit,
        description: `Baccarat — Misé sur ${betOn === 'player' ? 'Joueur' : betOn === 'banker' ? 'Banquier' : 'Égalité'}`,
      },
    });

    const newBalance = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } })).balance;
    grantXp(req.user.id, mise).catch(() => {});

    if (payout >= 2000) {
      const io = getIo();
      if (io) io.emit('livefeed:event', {
        id: `bac-${Date.now()}`,
        pseudo: user.pseudo,
        emoji: '🎴',
        message: `a gagné au Baccarat (${betOn})`,
        amount: payout,
        positive: true,
      });
    }

    res.json({ ...result, betOn, mise, payout, profit, newBalance });
  } catch (err) {
    console.error('Erreur baccarat:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = router;
