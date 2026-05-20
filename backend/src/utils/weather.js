// Météo des gains — change chaque heure automatiquement
const WEATHERS = [
  { id: 'sunny',   emoji: '☀️',  name: 'Grande Chance',       desc: '+15% sur tous les gains',         bonusType: 'gains',   bonusValue: 1.15 },
  { id: 'cloudy',  emoji: '⛅',  name: 'Temps calme',          desc: 'Conditions normales',             bonusType: 'none',    bonusValue: 1.0  },
  { id: 'rain',    emoji: '🌧️', name: 'Pluie de Rakeback',    desc: 'Rakeback doublé ce soir',         bonusType: 'rakeback',bonusValue: 2.0  },
  { id: 'storm',   emoji: '⚡',  name: 'Tempête de Jackpot',   desc: 'Contributions jackpot ×2',        bonusType: 'jackpot', bonusValue: 2.0  },
  { id: 'rainbow', emoji: '🌈', name: 'Arc-en-ciel',           desc: '+25% sur les gains ≥5x',         bonusType: 'bigwin',  bonusValue: 1.25 },
  { id: 'fog',     emoji: '🌫️', name: 'Brouillard mystique',  desc: 'Multiplicateurs surprise cachés', bonusType: 'none',    bonusValue: 1.0  },
  { id: 'cloudy',  emoji: '⛅',  name: 'Temps calme',          desc: 'Conditions normales',             bonusType: 'none',    bonusValue: 1.0  },
  { id: 'sunny',   emoji: '☀️',  name: 'Grande Chance',       desc: '+15% sur tous les gains',         bonusType: 'gains',   bonusValue: 1.15 },
];

let currentWeather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
let weatherChangedAt = new Date();

function rotateWeather() {
  currentWeather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
  weatherChangedAt = new Date();
  return currentWeather;
}

function getWeather() {
  return { ...currentWeather, changedAt: weatherChangedAt.toISOString() };
}

function applyWeatherBonus(bet, payout, multiplier) {
  if (currentWeather.bonusType === 'gains') {
    const profit = payout - bet;
    if (profit > 0) return bet + profit * currentWeather.bonusValue;
  }
  if (currentWeather.bonusType === 'bigwin' && multiplier >= 5) {
    const profit = payout - bet;
    if (profit > 0) return bet + profit * currentWeather.bonusValue;
  }
  return payout;
}

function getWeatherRakebackMultiplier() {
  return currentWeather.bonusType === 'rakeback' ? currentWeather.bonusValue : 1;
}

function getWeatherJackpotMultiplier() {
  return currentWeather.bonusType === 'jackpot' ? currentWeather.bonusValue : 1;
}

module.exports = { getWeather, rotateWeather, applyWeatherBonus, getWeatherRakebackMultiplier, getWeatherJackpotMultiplier };
