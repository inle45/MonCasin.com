const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

const SEASON_TIERS = [
  { tier: 1,  xp: 100,   reward: 500 },
  { tier: 2,  xp: 200,   reward: 800 },
  { tier: 3,  xp: 350,   reward: 1200 },
  { tier: 4,  xp: 500,   reward: 1500 },
  { tier: 5,  xp: 700,   reward: 2500 },
  { tier: 6,  xp: 950,   reward: 2000 },
  { tier: 7,  xp: 1250,  reward: 2500 },
  { tier: 8,  xp: 1600,  reward: 3000 },
  { tier: 9,  xp: 2000,  reward: 4000 },
  { tier: 10, xp: 2500,  reward: 10000 },
  { tier: 11, xp: 3100,  reward: 5000 },
  { tier: 12, xp: 3800,  reward: 6000 },
  { tier: 13, xp: 4600,  reward: 7000 },
  { tier: 14, xp: 5500,  reward: 8000 },
  { tier: 15, xp: 6500,  reward: 25000 },
  { tier: 16, xp: 7000,  reward: 10000 },
  { tier: 17, xp: 7500,  reward: 12000 },
  { tier: 18, xp: 8000,  reward: 14000 },
  { tier: 19, xp: 8500,  reward: 16000 },
  { tier: 20, xp: 9000,  reward: 50000 },
  { tier: 21, xp: 9200,  reward: 20000 },
  { tier: 22, xp: 9400,  reward: 25000 },
  { tier: 23, xp: 9600,  reward: 30000 },
  { tier: 24, xp: 9800,  reward: 40000 },
  { tier: 25, xp: 10000, reward: 100000 },
  { tier: 26, xp: 10500, reward: 50000 },
  { tier: 27, xp: 11000, reward: 60000 },
  { tier: 28, xp: 11500, reward: 75000 },
  { tier: 29, xp: 12000, reward: 100000 },
  { tier: 30, xp: 15000, reward: 200000 },
];

function getCurrentSeason() {
  return new Date().toISOString().slice(0, 7);
}

// GET /api/battlepass - current state
router.get('/', authenticate, async (req, res) => {
  try {
    const season = getCurrentSeason();
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { battlePassXp: true, battlePassSeason: true },
    });

    const bpXp = user.battlePassSeason === season ? user.battlePassXp : 0;

    const claims = await prisma.battlePassClaim.findMany({
      where: { userId: req.user.id, season },
      select: { tier: true },
    });
    const claimedTiers = claims.map(c => c.tier);

    res.json({ season, bpXp, tiers: SEASON_TIERS, claimedTiers });
  } catch (err) {
    console.error('BP GET:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// POST /api/battlepass/claim/:tier - claim a tier reward
router.post('/claim/:tier', authenticate, async (req, res) => {
  try {
    const tier = parseInt(req.params.tier);
    const tierDef = SEASON_TIERS.find(t => t.tier === tier);
    if (!tierDef) return res.status(400).json({ error: 'Palier invalide' });

    const season = getCurrentSeason();
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { battlePassXp: true, battlePassSeason: true },
    });

    const bpXp = user.battlePassSeason === season ? user.battlePassXp : 0;
    if (bpXp < tierDef.xp) return res.status(400).json({ error: 'XP insuffisant' });

    const alreadyClaimed = await prisma.battlePassClaim.findUnique({
      where: { userId_season_tier: { userId: req.user.id, season, tier } },
    });
    if (alreadyClaimed) return res.status(400).json({ error: 'Déjà réclamé' });

    await prisma.$transaction([
      prisma.battlePassClaim.create({
        data: { userId: req.user.id, season, tier },
      }),
      prisma.user.update({
        where: { id: req.user.id },
        data: { balance: { increment: tierDef.reward } },
      }),
      prisma.transaction.create({
        data: {
          userId: req.user.id,
          type: 'BONUS',
          amount: tierDef.reward,
          description: `Battle Pass S${season} — Palier ${tier}`,
        },
      }),
    ]);

    const newBalance = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } })).balance;
    res.json({ ok: true, reward: tierDef.reward, newBalance });
  } catch (err) {
    console.error('BP claim:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = { router, SEASON_TIERS };
