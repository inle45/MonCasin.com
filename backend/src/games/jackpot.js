// Jackpot progressif partagé — Vegas Evolution
// Persisté en mémoire (reset au redémarrage serveur, acceptable pour usage entre amis)

const DEPART = 50000;       // Cagnotte de départ en F€
const INCREMENT_RATE = 0.01; // 1% de chaque mise perdante alimentent la cagnotte

let jackpot = DEPART;

function getJackpot() {
  return Math.floor(jackpot);
}

function incrementerJackpot(misePerdue) {
  jackpot += misePerdue * INCREMENT_RATE;
  return getJackpot();
}

function remporterJackpot() {
  const montant = getJackpot();
  jackpot = DEPART;
  return montant;
}

module.exports = { getJackpot, incrementerJackpot, remporterJackpot };
