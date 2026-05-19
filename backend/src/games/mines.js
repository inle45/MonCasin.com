// Mines — grille 5×5, sessions en mémoire
const sessions = new Map(); // userId → session

const GRID_SIZE = 25;

// Multiplicateur après k révélations sûres avec m mines, house edge 3%
function calcMultiplier(m, k) {
  if (k === 0) return 1;
  let prob = 1;
  for (let i = 0; i < k; i++) {
    prob *= (GRID_SIZE - m - i) / (GRID_SIZE - i);
  }
  return prob > 0 ? Math.round((0.97 / prob) * 100) / 100 : 0;
}

function demarrerMines(userId, mise, minesCount) {
  // Placer les mines aléatoirement
  const positions = Array.from({ length: GRID_SIZE }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const mines = new Set(positions.slice(0, minesCount));

  sessions.set(userId, {
    mines,
    revealed: new Set(),
    minesCount,
    mise,
    safe: 0,
    actif: true,
  });

  return { ok: true, multiplicateur: 1 };
}

function revelerCase(userId, index) {
  const s = sessions.get(userId);
  if (!s || !s.actif) return { erreur: 'Pas de partie active' };
  if (s.revealed.has(index)) return { erreur: 'Case déjà révélée' };

  s.revealed.add(index);

  if (s.mines.has(index)) {
    // Mine touchée
    s.actif = false;
    const minesPositions = [...s.mines];
    sessions.delete(userId);
    return { mine: true, index, mines: minesPositions, gain: 0, multiplicateur: 0 };
  }

  s.safe++;
  const multiplicateur = calcMultiplier(s.minesCount, s.safe);
  const gainPotentiel = Math.round(s.mise * multiplicateur * 100) / 100;

  // Si toutes les cases sûres révélées → cashout auto
  const totalSafe = GRID_SIZE - s.minesCount;
  if (s.safe >= totalSafe) {
    s.actif = false;
    const minesPositions = [...s.mines];
    sessions.delete(userId);
    return { mine: false, index, safe: s.safe, multiplicateur, gainPotentiel, autoWin: true, mines: minesPositions };
  }

  return { mine: false, index, safe: s.safe, multiplicateur, gainPotentiel, autoWin: false };
}

function cashout(userId) {
  const s = sessions.get(userId);
  if (!s || !s.actif || s.safe === 0) return { erreur: 'Impossible de cashout' };
  const multiplicateur = calcMultiplier(s.minesCount, s.safe);
  const gain = Math.round(s.mise * multiplicateur * 100) / 100;
  const minesPositions = [...s.mines];
  sessions.delete(userId);
  return { gain, multiplicateur, mines: minesPositions };
}

function getSession(userId) { return sessions.get(userId) || null; }

module.exports = { demarrerMines, revelerCase, cashout, getSession, calcMultiplier };
