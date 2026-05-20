const TITLES = [
  { min: 76, title: '👑 Légende' },
  { min: 51, title: '⚔️ Maître' },
  { min: 31, title: '🛡️ Vétéran' },
  { min: 21, title: '🎯 Expert' },
  { min: 11, title: '🎲 Confirmé' },
  { min: 6,  title: '🃏 Joueur' },
  { min: 1,  title: '🌱 Novice' },
];

function getPlayerTitle(level) {
  for (const t of TITLES) {
    if ((level || 1) >= t.min) return t.title;
  }
  return '🌱 Novice';
}

module.exports = { getPlayerTitle };
