/**
 * Table de loot pour le système de coffres.
 *
 * Probabilité d'obtenir un objet : 40 %
 * Probabilité d'obtenir uniquement des pièces : 60 %
 *
 * Poids des types d'objets (sur 100 au total) :
 *   TICKET_ROUE       28
 *   PASS_FREE_SPINS   22
 *   DOUBLE_DAILY      18
 *   EMOTE_VIP         12
 *   SOUNDBITE         10
 *   ASSURANCE_CRASH    5
 *   FUMIGENE_ROULETTE  3
 *   CONTRE_RACKET      2
 */

const ITEM_TYPES = [
  'TICKET_ROUE',
  'PASS_FREE_SPINS',
  'ASSURANCE_CRASH',
  'FUMIGENE_ROULETTE',
  'CONTRE_RACKET',
  'DOUBLE_DAILY',
  'EMOTE_VIP',
  'SOUNDBITE',
];

// Weighted pool — order must match the weights array below
const WEIGHTED_POOL = [
  { type: 'TICKET_ROUE',       weight: 28 },
  { type: 'PASS_FREE_SPINS',   weight: 22 },
  { type: 'DOUBLE_DAILY',      weight: 18 },
  { type: 'EMOTE_VIP',         weight: 12 },
  { type: 'SOUNDBITE',         weight: 10 },
  { type: 'ASSURANCE_CRASH',   weight:  5 },
  { type: 'FUMIGENE_ROULETTE', weight:  3 },
  { type: 'CONTRE_RACKET',     weight:  2 },
];

const TOTAL_WEIGHT = WEIGHTED_POOL.reduce((sum, entry) => sum + entry.weight, 0); // 100

/**
 * Picks a random item type from the weighted pool.
 * @returns {string} one of the ITEM_TYPES strings
 */
function pickWeightedItem() {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const entry of WEIGHTED_POOL) {
    roll -= entry.weight;
    if (roll < 0) return entry.type;
  }
  // Fallback — should never be reached with a complete pool
  return WEIGHTED_POOL[WEIGHTED_POOL.length - 1].type;
}

/**
 * Draws a single loot result for a chest opening.
 *
 * @returns {string|null}  An ITEM_TYPES string if an item was won, or null for a
 *                         pure coin reward (60 % of draws).
 */
function tirerLoot() {
  // 40 % chance of an item, 60 % chance of coins only
  if (Math.random() >= 0.40) return null;
  return pickWeightedItem();
}

module.exports = { tirerLoot, ITEM_TYPES };
