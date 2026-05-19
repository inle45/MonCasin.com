/**
 * Moteur du jeu Crash — Provably Fair
 * Chaque round utilise un serverSeed aléatoire + un nonce incrémental.
 * Le hash SHA-256 du serverSeed est publié avant le round (commitHash).
 * Après le crash, le serverSeed est révélé pour que les joueurs vérifient.
 * Formule : HMAC-SHA256(serverSeed, nonce) → entier 32 bits → crashPoint
 */

const crypto = require('crypto');
const HOUSE_EDGE = 0.04;

function generateServerSeed() {
  return crypto.randomBytes(32).toString('hex');
}

function hashSeed(seed) {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function crashPointFromHash(serverSeed, nonce) {
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(String(nonce));
  const hash = hmac.digest('hex');

  // Convertir les 8 premiers caractères en entier non signé 32 bits
  const h = parseInt(hash.slice(0, 8), 16);
  const e = 2 ** 32;

  // Si la maison gagne (4%), forcer le crash à 1.00
  if (h % 25 === 0) return 1.00;

  // Formule provably fair standard
  const result = Math.floor((100 * e - h) / (e - h)) / 100;
  return Math.max(1.00, Math.min(result, 1000));
}

class CrashGame {
  constructor(io) {
    this.io = io;
    this.state = 'waiting';
    this.multiplier = 1.0;
    this.crashPoint = null;
    this.bets = new Map();
    this.interval = null;
    this.startTime = null;
    this.waitTime = 8000;
    this.tickRate = 100;
    this.history = [];
    // Provably Fair
    this.serverSeed = generateServerSeed();
    this.nonce = 0;
    this.commitHash = hashSeed(this.serverSeed);
    this.lastServerSeed = null;
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

    // Préparer le prochain round (nouveau seed si nonce > 1000 pour rotation)
    if (this.nonce > 1000) {
      this.lastServerSeed = this.serverSeed;
      this.serverSeed = generateServerSeed();
      this.nonce = 0;
    }
    this.commitHash = hashSeed(this.serverSeed);

    this.io.to('crash').emit('crash:waiting', {
      waitTime: this.waitTime / 1000,
      history: this.history.slice(-10),
      commitHash: this.commitHash,
      lastServerSeed: this.lastServerSeed,
    });

    setTimeout(() => this.startRound(), this.waitTime);
  }

  startRound() {
    this.nonce++;
    this.crashPoint = crashPointFromHash(this.serverSeed, this.nonce);
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
      serverSeed: this.serverSeed,
      nonce: this.nonce,
      commitHash: this.commitHash,
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
module.exports.hashSeed = hashSeed;
module.exports.crashPointFromHash = crashPointFromHash;
