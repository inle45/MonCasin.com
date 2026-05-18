/**
 * Moteur du jeu Roulette Européenne
 * 0 à 36, avantage maison via le 0
 */

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

function getColor(number) {
  if (number === 0) return 'green';
  if (RED_NUMBERS.includes(number)) return 'red';
  return 'black';
}

function calculateWin(bet, winningNumber) {
  const { type, value, amount } = bet;
  const color = getColor(winningNumber);

  switch (type) {
    case 'number':
      if (parseInt(value) === winningNumber) return amount * 35;
      return 0;
    case 'color':
      if (value === color) return amount * 1;
      return 0;
    case 'even_odd':
      if (winningNumber === 0) return 0;
      if (value === 'even' && winningNumber % 2 === 0) return amount * 1;
      if (value === 'odd' && winningNumber % 2 !== 0) return amount * 1;
      return 0;
    case 'dozen':
      if (winningNumber === 0) return 0;
      const dozen = Math.ceil(winningNumber / 12);
      if (parseInt(value) === dozen) return amount * 2;
      return 0;
    case 'half':
      if (winningNumber === 0) return 0;
      if (value === 'first' && winningNumber >= 1 && winningNumber <= 18) return amount * 1;
      if (value === 'second' && winningNumber >= 19 && winningNumber <= 36) return amount * 1;
      return 0;
    case 'column':
      if (winningNumber === 0) return 0;
      const col = winningNumber % 3;
      if (parseInt(value) === 1 && col === 1) return amount * 2;
      if (parseInt(value) === 2 && col === 2) return amount * 2;
      if (parseInt(value) === 3 && col === 0) return amount * 2;
      return 0;
    default:
      return 0;
  }
}

class RouletteGame {
  constructor(io) {
    this.io = io;
    this.state = 'betting';
    this.bets = new Map(); // userId -> [{ type, value, amount }]
    this.winningNumber = null;
    this.bettingTime = 15000;
    this.spinTime = 5000;
    this.history = [];
    this.timer = null;
    this.countdown = 15;
  }

  start() {
    this.startBettingPhase();
  }

  startBettingPhase() {
    this.state = 'betting';
    this.bets = new Map();
    this.winningNumber = null;
    this.countdown = 15;

    this.io.to('roulette').emit('roulette:betting', {
      countdown: this.countdown,
      history: this.history.slice(-10),
    });

    this.timer = setInterval(() => {
      this.countdown--;
      this.io.to('roulette').emit('roulette:countdown', { countdown: this.countdown });

      if (this.countdown <= 0) {
        clearInterval(this.timer);
        this.startSpin();
      }
    }, 1000);
  }

  placeBet(userId, pseudo, bets) {
    if (this.state !== 'betting') return { success: false, error: 'Les mises sont fermées' };

    const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);
    if (totalBet <= 0) return { success: false, error: 'Montant invalide' };

    this.bets.set(userId, { pseudo, bets });
    this.io.to('roulette').emit('roulette:bet_placed', {
      userId,
      pseudo,
      totalAmount: totalBet,
      bets,
    });

    return { success: true };
  }

  startSpin() {
    this.state = 'spinning';
    this.winningNumber = Math.floor(Math.random() * 37);

    this.io.to('roulette').emit('roulette:spinning', {
      winningNumber: this.winningNumber,
    });

    setTimeout(() => this.revealResult(), this.spinTime);
  }

  revealResult() {
    this.state = 'result';
    const winColor = getColor(this.winningNumber);

    this.history.unshift({ number: this.winningNumber, color: winColor });
    if (this.history.length > 20) this.history.pop();

    const results = [];
    this.bets.forEach((data, userId) => {
      let totalWin = 0;
      data.bets.forEach(bet => {
        totalWin += calculateWin(bet, this.winningNumber);
      });

      const totalBet = data.bets.reduce((s, b) => s + b.amount, 0);
      results.push({
        userId,
        pseudo: data.pseudo,
        totalBet,
        totalWin,
        profit: totalWin - totalBet,
      });
    });

    this.io.to('roulette').emit('roulette:result', {
      winningNumber: this.winningNumber,
      winColor,
      results,
    });

    setTimeout(() => this.startBettingPhase(), 5000);

    return results;
  }

  getBets() {
    const bets = [];
    this.bets.forEach((data, userId) => {
      bets.push({ userId, pseudo: data.pseudo, bets: data.bets });
    });
    return bets;
  }

  getState() {
    return {
      state: this.state,
      countdown: this.countdown,
      bets: this.getBets(),
      history: this.history.slice(-10),
    };
  }
}

module.exports = { RouletteGame, calculateWin, getColor };
