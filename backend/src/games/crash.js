/**
 * Moteur du jeu Crash
 * Logique entièrement serveur pour éviter la triche.
 * Le multiplicateur de crash est généré via une fonction de hasard provably fair.
 */

const HOUSE_EDGE = 0.04; // 4% d'avantage maison

function generateCrashPoint() {
  const r = Math.random();
  if (r < HOUSE_EDGE) return 1.0;
  const crash = Math.floor((1 / (1 - r)) * 100) / 100;
  return Math.max(1.0, Math.min(crash, 1000));
}

class CrashGame {
  constructor(io) {
    this.io = io;
    this.state = 'waiting';
    this.multiplier = 1.0;
    this.crashPoint = null;
    this.bets = new Map(); // userId -> { amount, cashedOut, cashOutAt }
    this.interval = null;
    this.startTime = null;
    this.waitTime = 8000;
    this.tickRate = 100;
    this.history = [];
  }

  start() {
    this.scheduleNextRound();
  }

  scheduleNextRound() {
    this.state = 'waiting';
    this.multiplier = 1.0;
    this.crashPoint = null;
    this.bets = new Map();
    this.startTime = null;

    this.io.to('crash').emit('crash:waiting', {
      waitTime: this.waitTime / 1000,
      history: this.history.slice(-10),
    });

    setTimeout(() => this.startRound(), this.waitTime);
  }

  startRound() {
    this.crashPoint = generateCrashPoint();
    this.state = 'running';
    this.startTime = Date.now();
    this.multiplier = 1.0;

    this.io.to('crash').emit('crash:started', {
      startTime: this.startTime,
    });

    this.interval = setInterval(() => this.tick(), this.tickRate);
  }

  tick() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.multiplier = Math.floor(Math.pow(Math.E, 0.08 * elapsed) * 100) / 100;

    if (this.multiplier >= this.crashPoint) {
      this.endRound();
      return;
    }

    this.io.to('crash').emit('crash:tick', { multiplier: this.multiplier });
  }

  placeBet(userId, pseudo, amount) {
    if (this.state !== 'waiting') return { success: false, error: 'Les mises sont fermées' };
    if (this.bets.has(userId)) return { success: false, error: 'Mise déjà placée' };
    if (amount <= 0) return { success: false, error: 'Montant invalide' };

    this.bets.set(userId, { amount, pseudo, cashedOut: false, cashOutAt: null });
    this.io.to('crash').emit('crash:bet_placed', { userId, pseudo, amount });
    return { success: true };
  }

  cashOut(userId) {
    if (this.state !== 'running') return { success: false, error: 'Jeu non en cours' };

    const bet = this.bets.get(userId);
    if (!bet) return { success: false, error: 'Aucune mise trouvée' };
    if (bet.cashedOut) return { success: false, error: 'Déjà retiré' };

    const cashOutMultiplier = this.multiplier;
    const winAmount = Math.floor(bet.amount * cashOutMultiplier * 100) / 100;

    bet.cashedOut = true;
    bet.cashOutAt = cashOutMultiplier;
    bet.winAmount = winAmount;

    this.io.to('crash').emit('crash:cashed_out', {
      userId,
      pseudo: bet.pseudo,
      multiplier: cashOutMultiplier,
      winAmount,
    });

    return { success: true, winAmount, multiplier: cashOutMultiplier };
  }

  endRound() {
    clearInterval(this.interval);
    this.state = 'crashed';
    const finalCrash = this.crashPoint;

    this.history.unshift(finalCrash);
    if (this.history.length > 20) this.history.pop();

    const results = [];
    this.bets.forEach((bet, userId) => {
      results.push({
        userId,
        pseudo: bet.pseudo,
        amount: bet.amount,
        cashedOut: bet.cashedOut,
        cashOutAt: bet.cashOutAt || null,
        winAmount: bet.cashedOut ? bet.winAmount : 0,
      });
    });

    this.io.to('crash').emit('crash:crashed', {
      crashPoint: finalCrash,
      results,
    });

    setTimeout(() => this.scheduleNextRound(), 3000);

    return results;
  }

  getBets() {
    const bets = [];
    this.bets.forEach((bet, userId) => {
      bets.push({ userId, pseudo: bet.pseudo, amount: bet.amount, cashedOut: bet.cashedOut });
    });
    return bets;
  }

  getState() {
    return {
      state: this.state,
      multiplier: this.multiplier,
      bets: this.getBets(),
      history: this.history.slice(-10),
    };
  }
}

module.exports = CrashGame;
