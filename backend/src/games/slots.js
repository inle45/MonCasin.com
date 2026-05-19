/**
 * Vegas Evolution — Moteur Machine à Sous 5×3
 * 20 lignes de paiement, bonus (Free Spins / Roue / Coffres)
 * TRJ calibré à ~86% — conforme à la loi française
 */

// ── Symboles ────────────────────────────────────────────────────────────────
const SYMBOLES = {
  TEN:     { id: 'TEN',     emoji: '🔟', weight: 22, paytable: { 3: 0.4, 4: 1.2, 5: 2.5  } },
  JACK:    { id: 'JACK',    emoji: '🎴', weight: 19, paytable: { 3: 0.5, 4: 1.5, 5: 3.0  } },
  QUEEN:   { id: 'QUEEN',   emoji: '♛',  weight: 16, paytable: { 3: 0.7, 4: 2.0, 5: 5.0  } },
  KING:    { id: 'KING',    emoji: '♚',  weight: 13, paytable: { 3: 0.9, 4: 2.5, 5: 7.0  } },
  ACE:     { id: 'ACE',     emoji: '🅰️', weight: 10, paytable: { 3: 1.2, 4: 4.0, 5: 12.0 } },
  CROWN:   { id: 'CROWN',   emoji: '👑', weight: 6,  paytable: { 3: 3.0, 4: 12.0,5: 35.0 } },
  DIAMOND: { id: 'DIAMOND', emoji: '💎', weight: 4,  paytable: { 3: 8.0, 4: 30.0,5: 90.0 } },
  WILD:    { id: 'WILD',    emoji: '🌟', weight: 2,  paytable: { 3: 15.0,4: 50.0,5: 200.0} },
  SCATTER: { id: 'SCATTER', emoji: '⭐', weight: 2,  paytable: {}                           },
};

// Pool pondéré pour la sélection aléatoire
const POOL = Object.values(SYMBOLES).flatMap(s => Array(s.weight).fill(s.id));
const TOTAL_POOL = POOL.length;

// ── 20 Lignes de paiement (index de rangée par rouleau, grille 5×3) ────────
// grid[rouleau][rangée] — lignes définies comme [rangée_r0, rangée_r1, ..., rangée_r4]
const LIGNES_DE_PAIEMENT = [
  [1,1,1,1,1], // L1  : Milieu (ligne principale)
  [0,0,0,0,0], // L2  : Haut
  [2,2,2,2,2], // L3  : Bas
  [0,1,2,1,0], // L4  : V-forme
  [2,1,0,1,2], // L5  : Λ-forme inversée
  [0,0,1,2,2], // L6  : Diagonale ↘
  [2,2,1,0,0], // L7  : Diagonale ↗
  [1,0,0,0,1], // L8  : Chapeau haut de forme
  [1,2,2,2,1], // L9  : Bol renversé
  [0,1,0,1,0], // L10 : Zigzag haut
  [2,1,2,1,2], // L11 : Zigzag bas
  [1,0,1,0,1], // L12 : Zigzag alterné haut
  [1,2,1,2,1], // L13 : Zigzag alterné bas
  [0,0,0,1,2], // L14 : Descente finale
  [2,2,2,1,0], // L15 : Montée finale
  [0,1,1,1,2], // L16 : Arc descendant
  [2,1,1,1,0], // L17 : Arc montant
  [1,1,0,1,1], // L18 : Bosse centre-haut
  [1,1,2,1,1], // L19 : Bosse centre-bas
  [0,2,1,0,2], // L20 : Ondulation croisée
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function piocherSymbole() {
  return POOL[Math.floor(Math.random() * TOTAL_POOL)];
}

// Génère la grille 5×3 : grid[rouleau][rangée]
function genererGrille() {
  return Array.from({ length: 5 }, () => [
    piocherSymbole(),
    piocherSymbole(),
    piocherSymbole(),
  ]);
}

function compterScatters(grille) {
  let count = 0;
  for (let r = 0; r < 5; r++)
    for (let row = 0; row < 3; row++)
      if (grille[r][row] === 'SCATTER') count++;
  return count;
}

function verifierJackpot(grille) {
  // Jackpot : 5 WILD sur la ligne principale (milieu)
  return LIGNES_DE_PAIEMENT[0].every((rangee, rouleau) => grille[rouleau][rangee] === 'WILD');
}

function verifierLigne(grille, ligne) {
  const symboles = ligne.map((rangee, rouleau) => grille[rouleau][rangee]);
  let symboleBase = null;
  let count = 0;

  for (const sym of symboles) {
    if (sym === 'SCATTER') break;
    if (sym === 'WILD')    { count++; continue; }
    if (symboleBase === null) { symboleBase = sym; count++; }
    else if (sym === symboleBase) count++;
    else break;
  }

  const symboleEffectif = symboleBase || (count >= 3 ? 'WILD' : null);
  if (symboleEffectif && count >= 3) {
    const multiplicateur = SYMBOLES[symboleEffectif].paytable[count] || 0;
    if (multiplicateur > 0) return { gagne: true, count, symbole: symboleEffectif, multiplicateur };
  }
  return { gagne: false };
}

function calculerGains(grille, mise) {
  let multiplicateurTotal = 0;
  const lignesGagnantes = [];

  LIGNES_DE_PAIEMENT.forEach((ligne, idx) => {
    const res = verifierLigne(grille, ligne);
    if (res.gagne) {
      lignesGagnantes.push({ indexLigne: idx, ...res });
      multiplicateurTotal += res.multiplicateur;
    }
  });

  return {
    gainTotal: Math.round(mise * multiplicateurTotal * 100) / 100,
    lignesGagnantes,
    multiplicateurTotal,
  };
}

// ── Bonus ────────────────────────────────────────────────────────────────────

function choisirBonus() {
  const rand = Math.random();
  if (rand < 0.40) return { type: 'FREE_SPINS',        freespins: 10 };
  if (rand < 0.73) return { type: 'WHEEL_OF_FORTUNE' };
  return            { type: 'CHEST_GAME' };
}

// Roue de la Fortune : résolution immédiate côté serveur
function tournerRoue(mise) {
  const SEGMENTS = [
    { multiplicateur: 10,  poids: 25 },
    { multiplicateur: 15,  poids: 20 },
    { multiplicateur: 20,  poids: 18 },
    { multiplicateur: 25,  poids: 15 },
    { multiplicateur: 30,  poids: 10 },
    { multiplicateur: 40,  poids: 6  },
    { multiplicateur: 50,  poids: 3  },
    { multiplicateur: 75,  poids: 2  },
    { multiplicateur: 100, poids: 1  },
  ];
  const total = SEGMENTS.reduce((s, g) => s + g.poids, 0);
  let rand = Math.random() * total;
  let gagnant = SEGMENTS[0];
  for (const seg of SEGMENTS) { rand -= seg.poids; if (rand <= 0) { gagnant = seg; break; } }
  return { multiplicateur: gagnant.multiplicateur, gain: Math.round(mise * gagnant.multiplicateur) };
}

// Casse des Coffres : génère 12 coffres (10 gains/loots + 2 alarmes)
function genererCoffres(mise) {
  const { tirerLoot } = require('./lootTable');
  const VALEURS_GAIN = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 7, 10];
  const valeursShuffled = VALEURS_GAIN.sort(() => Math.random() - 0.5);

  const coffres = valeursShuffled.map((m) => {
    const loot = tirerLoot();
    if (loot) return { estAlarme: false, valeur: 0, item: loot, revele: false };
    return { estAlarme: false, valeur: Math.round(mise * m), item: null, revele: false };
  });

  // Insérer 2 alarmes à positions aléatoires
  const posAlarmes = new Set();
  while (posAlarmes.size < 2) posAlarmes.add(Math.floor(Math.random() * 12));
  posAlarmes.forEach(pos => { coffres[pos] = { estAlarme: true, valeur: 0, item: null, revele: false }; });

  return coffres;
}

// ── Sessions Bonus en mémoire ────────────────────────────────────────────────
const sessionsBonus = new Map(); // userId → état bonus

function demarrerFreeSpins(userId, mise) {
  sessionsBonus.set(userId, { type: 'FREE_SPINS', spinsRestants: 10, multiplicateur: 1, mise, gainTotal: 0 });
}

function demarrerCoffreGame(userId, mise) {
  sessionsBonus.set(userId, { type: 'CHEST_GAME', coffres: genererCoffres(mise), mise, gainTotal: 0 });
}

function getSession(userId) { return sessionsBonus.get(userId) || null; }
function effacerSession(userId) { sessionsBonus.delete(userId); }

// ── Spin principal ────────────────────────────────────────────────────────────

function spin(mise, userId) {
  // Vérifier s'il y a des free spins en cours
  const session = sessionsBonus.get(userId);
  if (session?.type === 'FREE_SPINS') return _tourFreeSpins(userId, session);

  const grille = genererGrille();
  const { gainTotal, lignesGagnantes, multiplicateurTotal } = calculerGains(grille, mise);
  const scatters = compterScatters(grille);
  const jackpotWin = verifierJackpot(grille);

  let bonus = null;
  if (scatters >= 3) {
    bonus = choisirBonus();
    if (bonus.type === 'FREE_SPINS')  demarrerFreeSpins(userId, mise);
    if (bonus.type === 'CHEST_GAME')  demarrerCoffreGame(userId, mise);
  }

  return {
    grille,
    gainTotal: jackpotWin ? 0 : gainTotal, // jackpot géré séparément
    lignesGagnantes,
    multiplicateurTotal,
    scatters,
    bonus,
    jackpotWin,
    gagne: gainTotal > 0 || bonus !== null || jackpotWin,
    bigWin: multiplicateurTotal >= 20,
    estFreeSpin: false,
  };
}

function _tourFreeSpins(userId, session) {
  const grille = genererGrille();
  const { gainTotal, lignesGagnantes, multiplicateurTotal } = calculerGains(grille, session.mise);

  // Multiplicateur global qui monte à chaque gain
  if (multiplicateurTotal > 0) session.multiplicateur = Math.min(session.multiplicateur + 0.5, 5);
  const gainRound = Math.round(gainTotal * session.multiplicateur * 100) / 100;
  session.gainTotal += gainRound;
  session.spinsRestants--;

  const termine = session.spinsRestants <= 0;
  if (termine) effacerSession(userId);

  return {
    grille,
    gainTotal: gainRound,
    lignesGagnantes,
    multiplicateurTotal,
    scatters: compterScatters(grille),
    bonus: null,
    jackpotWin: false,
    gagne: gainRound > 0,
    bigWin: multiplicateurTotal * session.multiplicateur >= 20,
    estFreeSpin: true,
    spinsRestants: session.spinsRestants,
    multiplicateurFreeSpin: session.multiplicateur,
    gainTotalFreeSpins: session.gainTotal,
    freeSpinsTermines: termine,
  };
}

// Ouvrir un coffre
function ouvrirCoffre(userId, indexCoffre) {
  const session = sessionsBonus.get(userId);
  if (!session || session.type !== 'CHEST_GAME') return { erreur: 'Pas de session active' };
  const coffre = session.coffres[indexCoffre];
  if (!coffre || coffre.revele) return { erreur: 'Coffre déjà ouvert' };

  coffre.revele = true;

  if (coffre.estAlarme) {
    const gainTotal = session.gainTotal;
    effacerSession(userId);
    return { estAlarme: true, valeur: 0, indexCoffre, gainTotal, termine: true, coffres: session.coffres };
  }

  session.gainTotal += coffre.valeur;
  const ouverts = session.coffres.filter(c => c.revele && !c.estAlarme).length;
  const termine = ouverts >= 10;
  if (termine) effacerSession(userId);

  return {
    estAlarme: false,
    valeur: coffre.valeur,
    indexCoffre,
    gainTotal: session.gainTotal,
    termine,
    coffres: session.coffres.map((c, i) => (i === indexCoffre || c.revele) ? c : { revele: false }),
  };
}

module.exports = {
  spin,
  tournerRoue,
  ouvrirCoffre,
  getSession,
  effacerSession,
  SYMBOLES,
  LIGNES_DE_PAIEMENT,
};
