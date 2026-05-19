// Hilo — paquet de 52 cartes, sessions en mémoire
const sessions = new Map();

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // J=11 Q=12 K=13 A=14
const RED_SUITS = new Set(['♥', '♦']);

function valueName(v) {
  if (v === 11) return 'J';
  if (v === 12) return 'Q';
  if (v === 13) return 'K';
  if (v === 14) return 'A';
  return String(v);
}

function createDeck() {
  const deck = [];
  for (const s of SUITS) for (const v of VALUES) deck.push({ v, s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function card(c) {
  return { v: c.v, s: c.s, name: valueName(c.v), red: RED_SUITS.has(c.s) };
}

function nextMults(currentValue, deck, cumulativeMult) {
  if (deck.length === 0) return { multHigh: null, multLow: null };
  const higher = deck.filter(c => c.v > currentValue).length;
  const lower  = deck.filter(c => c.v < currentValue).length;
  const pHigh = higher / deck.length;
  const pLow  = lower  / deck.length;
  return {
    multHigh: pHigh > 0 ? Math.round(cumulativeMult * 0.97 / pHigh * 100) / 100 : null,
    multLow:  pLow  > 0 ? Math.round(cumulativeMult * 0.97 / pLow  * 100) / 100 : null,
  };
}

function startHilo(userId, mise) {
  const deck = createDeck();
  const first = deck.shift();
  const mults = nextMults(first.v, deck, 1);

  sessions.set(userId, {
    deck,
    currentCard: first,
    mise,
    cumulativeMult: 1,
    round: 0,
    actif: true,
  });

  return { card: card(first), ...mults, gainPotentiel: mise };
}

function guessHilo(userId, direction) {
  const s = sessions.get(userId);
  if (!s || !s.actif) return { erreur: 'Pas de partie active' };
  if (direction !== 'high' && direction !== 'low') return { erreur: 'Direction invalide (high/low)' };

  const prev = s.currentCard;
  const favorable = direction === 'high'
    ? s.deck.filter(c => c.v > prev.v).length
    : s.deck.filter(c => c.v < prev.v).length;
  const prob = favorable / s.deck.length;

  const next = s.deck.shift();
  const correct = direction === 'high' ? next.v > prev.v : next.v < prev.v;

  if (!correct) {
    s.actif = false;
    sessions.delete(userId);
    return { correct: false, card: card(next), prevCard: card(prev), gain: 0 };
  }

  const stepMult = prob > 0 ? 0.97 / prob : 1;
  s.cumulativeMult = Math.round(s.cumulativeMult * stepMult * 100) / 100;
  s.round++;
  s.currentCard = next;

  const gainPotentiel = Math.round(s.mise * s.cumulativeMult * 100) / 100;
  const mults = nextMults(next.v, s.deck, s.cumulativeMult);
  const autoWin = s.deck.length === 0;

  if (autoWin) {
    s.actif = false;
    sessions.delete(userId);
  }

  return {
    correct: true,
    card: card(next),
    prevCard: card(prev),
    multiplier: s.cumulativeMult,
    gainPotentiel,
    round: s.round,
    ...mults,
    cardsLeft: s.deck.length,
    autoWin,
  };
}

function cashoutHilo(userId) {
  const s = sessions.get(userId);
  if (!s || !s.actif || s.round === 0) return { erreur: 'Impossible de cashout' };
  const gain = Math.round(s.mise * s.cumulativeMult * 100) / 100;
  const mult = s.cumulativeMult;
  sessions.delete(userId);
  return { gain, multiplier: mult };
}

function getHiloSession(userId) {
  return sessions.get(userId) || null;
}

module.exports = { startHilo, guessHilo, cashoutHilo, getHiloSession };
