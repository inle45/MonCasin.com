const CHALLENGES = [
  { key: 'crash_7x',       emoji: '⚡', description: 'Cashout au Crash entre x7.00 et x7.99',           reward: 25000 },
  { key: 'hilo_5streak',   emoji: '🃏', description: 'Gagner 5 fois de suite au Hi-Lo en une partie',   reward: 30000 },
  { key: 'blackjack_bj',   emoji: '🃏', description: 'Réussir un Blackjack naturel (21 sur 2 cartes)',   reward: 20000 },
  { key: 'limbo_100x',     emoji: '🌙', description: 'Viser et atteindre x100 ou plus au Limbo',        reward: 50000 },
  { key: 'roulette_zero',  emoji: '🎡', description: 'Miser sur le 0 à la Roulette et gagner',          reward: 40000 },
  { key: 'mines_10safe',   emoji: '💣', description: 'Révéler 10 cases sans mine dans une partie Mines', reward: 35000 },
  { key: 'plinko_edge',    emoji: '🪙', description: 'Atterrir sur la 1ère ou dernière case au Plinko (risque Élevé)', reward: 30000 },
  { key: 'crash_10x',      emoji: '🚀', description: 'Cashout au Crash à x10 ou plus',                  reward: 30000 },
  { key: 'dice_lucky',     emoji: '🎲', description: 'Gagner 3 fois de suite au Dice',                  reward: 25000 },
  { key: 'limbo_moon',     emoji: '🌙', description: 'Atteindre x1000 ou plus au Limbo',                reward: 100000 },
];

function getTodayChallenge() {
  const day = new Date().toISOString().split('T')[0];
  const idx = day.split('-').reduce((a, b) => parseInt(a) + parseInt(b), 0) % CHALLENGES.length;
  return { ...CHALLENGES[idx], day };
}

function checkChallenge(event, data) {
  const c = getTodayChallenge();
  switch (c.key) {
    case 'crash_7x':     return event === 'crash_cashout' && data.multiplier >= 7 && data.multiplier < 8;
    case 'hilo_5streak': return event === 'hilo_cashout' && (data.wins ?? 0) >= 5;
    case 'blackjack_bj': return event === 'blackjack_result' && data.status === 'blackjack';
    case 'limbo_100x':   return event === 'limbo_result' && data.won && data.target >= 100;
    case 'roulette_zero':return event === 'roulette_win' && data.winningNumber === 0;
    case 'mines_10safe': return event === 'mines_cashout' && (data.revealed ?? 0) >= 10;
    case 'plinko_edge':  return event === 'plinko_result' && data.risk === 'high' && (data.bucket === 0 || data.bucket === data.rows);
    case 'crash_10x':    return event === 'crash_cashout' && data.multiplier >= 10;
    case 'dice_lucky':   return event === 'dice_streak' && (data.streak ?? 0) >= 3;
    case 'limbo_moon':   return event === 'limbo_result' && data.won && data.target >= 1000;
    default: return false;
  }
}

module.exports = { getTodayChallenge, checkChallenge };
