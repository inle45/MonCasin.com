// Happy Hour : vendredi + samedi 19h-23h UTC (21h-01h Paris été)
function isHappyHour() {
  const now = new Date();
  const day = now.getUTCDay(); // 5=vendredi, 6=samedi
  const hour = now.getUTCHours();
  return (day === 5 || day === 6) && hour >= 19 && hour < 23;
}

function happyHourMultiplier() {
  return isHappyHour() ? 1.5 : 1.0;
}

// Applique le bonus Happy Hour sur le profit net (pas la mise)
function applyHappyHour(bet, payout) {
  if (!isHappyHour() || payout <= bet) return payout;
  const profit = payout - bet;
  return bet + profit * 1.5;
}

function getHappyHourStatus() {
  if (!isHappyHour()) {
    // Trouver le prochain Happy Hour
    const now = new Date();
    const next = new Date(now);
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    let daysUntil = 0;
    if (day < 5) daysUntil = 5 - day;
    else if (day === 5 && hour >= 23) daysUntil = 1;
    else if (day === 6 && hour >= 23) daysUntil = 6;
    else if (day === 0) daysUntil = 5;
    next.setUTCDate(now.getUTCDate() + daysUntil);
    next.setUTCHours(19, 0, 0, 0);
    return { active: false, nextAt: next.toISOString() };
  }
  const end = new Date();
  end.setUTCHours(23, 0, 0, 0);
  return { active: true, endsAt: end.toISOString(), multiplier: 1.5 };
}

module.exports = { isHappyHour, happyHourMultiplier, applyHappyHour, getHappyHourStatus };
