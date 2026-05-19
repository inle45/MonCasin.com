const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['♠','♥','♦','♣'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ rank, suit });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardValue(rank) {
  if (['J','Q','K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank);
}

function handTotal(hand) {
  let total = hand.reduce((s, c) => s + cardValue(c.rank), 0);
  let aces = hand.filter(c => c.rank === 'A').length;
  while (total > 21 && aces-- > 0) total -= 10;
  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && handTotal(hand) === 21;
}

const sessions = new Map();

function startGame(userId, bet) {
  const deck = createDeck();
  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];
  const session = { bet, deck, playerHand, dealerHand, status: 'playing', doubled: false };
  sessions.set(userId, session);
  return session;
}

function getSession(userId) { return sessions.get(userId); }
function clearSession(userId) { sessions.delete(userId); }

function hit(userId) {
  const s = sessions.get(userId);
  if (!s || s.status !== 'playing') return null;
  s.playerHand.push(s.deck.pop());
  if (handTotal(s.playerHand) > 21) s.status = 'bust';
  return s;
}

function stand(userId) {
  const s = sessions.get(userId);
  if (!s || s.status !== 'playing') return null;
  // Dealer joue : tire jusqu'à 17+
  while (handTotal(s.dealerHand) < 17) s.dealerHand.push(s.deck.pop());
  const p = handTotal(s.playerHand);
  const d = handTotal(s.dealerHand);
  if (d > 21 || p > d) s.status = 'win';
  else if (p === d) s.status = 'push';
  else s.status = 'lose';
  return s;
}

function double(userId) {
  const s = sessions.get(userId);
  if (!s || s.status !== 'playing' || s.playerHand.length !== 2) return null;
  s.bet *= 2;
  s.doubled = true;
  s.playerHand.push(s.deck.pop());
  if (handTotal(s.playerHand) > 21) { s.status = 'bust'; return s; }
  return stand(userId);
}

function resolveResult(session) {
  const { status, bet } = session;
  const playerBJ = isBlackjack(session.playerHand);
  const dealerBJ = isBlackjack(session.dealerHand);
  if (playerBJ && dealerBJ) return { status: 'push', payout: bet };
  if (playerBJ) return { status: 'blackjack', payout: Math.floor(bet * 2.5) };
  if (status === 'win') return { status: 'win', payout: bet * 2 };
  if (status === 'push') return { status: 'push', payout: bet };
  return { status: 'lose', payout: 0 };
}

module.exports = { startGame, getSession, clearSession, hit, stand, double, resolveResult, handTotal, isBlackjack };
