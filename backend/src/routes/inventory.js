const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const CATALOGUE = {
  TICKET_ROUE:       { name: 'Ticket Roue de la Fortune', emoji: '🎡', description: 'Lance la Roue de la Fortune gratuitement',           isConsumable: true  },
  PASS_FREE_SPINS:   { name: 'Pass Free Spins',           emoji: '🎰', description: '10 tours gratuits sur Vegas Evolution',               isConsumable: true  },
  ASSURANCE_CRASH:   { name: 'Assurance Crash',           emoji: '🛡️', description: 'Rembourse 50% de ta mise si tu crash',               isConsumable: true  },
  FUMIGENE_ROULETTE: { name: 'Fumigène de Roulette',      emoji: '💨', description: 'Masque tes mises aux autres 15 secondes',            isConsumable: true  },
  CONTRE_RACKET:     { name: 'Contre-Racket',             emoji: '⚔️', description: 'Immunité + punition contre le prochain racket',      isConsumable: true  },
  DOUBLE_DAILY:      { name: 'Double Daily',              emoji: '⚡', description: 'Double ton prochain bonus quotidien',                isConsumable: true  },
  EMOTE_VIP:         { name: 'Émote VIP 👑',              emoji: '👑', description: 'Émote exclusive dans le chat',                       isConsumable: false },
  SOUNDBITE:         { name: 'Soundbite Casino',          emoji: '🔊', description: 'Déclenche un son chez tout le monde',                isConsumable: false },
};

// GET / — list current user's inventory items ordered by newest first
router.get('/', authenticate, async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich each item with catalogue metadata
    const enriched = items.map((item) => {
      const meta = CATALOGUE[item.type] ?? null;
      return { ...item, meta };
    });

    res.json({ items: enriched });
  } catch (err) {
    console.error('Erreur inventaire GET /', err);
    res.status(500).json({ error: 'Erreur lors du chargement de l\'inventaire' });
  }
});

// POST /:id/use — consume an item
router.post('/:id/use', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const item = await prisma.inventoryItem.findUnique({ where: { id } });

    if (!item) {
      return res.status(404).json({ error: 'Objet introuvable dans l\'inventaire' });
    }

    // Ownership check
    if (item.userId !== req.user.id) {
      return res.status(403).json({ error: 'Cet objet ne vous appartient pas' });
    }

    const meta = CATALOGUE[item.type];

    // Consumability check
    if (meta && !meta.isConsumable) {
      return res.status(400).json({
        error: `${meta.name} ne peut pas être utilisé — c'est un objet permanent`,
      });
    }

    const now = new Date();
    let updatedItem;

    if (item.quantity > 1) {
      // Decrement quantity, stamp usedAt
      updatedItem = await prisma.inventoryItem.update({
        where: { id },
        data: {
          quantity: { decrement: 1 },
          usedAt: now,
        },
      });
    } else {
      // Last copy — stamp usedAt first so we can return it, then delete
      updatedItem = await prisma.inventoryItem.update({
        where: { id },
        data: { usedAt: now },
      });
      await prisma.inventoryItem.delete({ where: { id } });
    }

    const itemName = meta ? `${meta.emoji} ${meta.name}` : item.type;

    res.json({
      success: true,
      item: { ...updatedItem, meta: meta ?? null },
      message: `${itemName} utilisé avec succès !`,
    });
  } catch (err) {
    console.error('Erreur inventaire POST /:id/use', err);
    res.status(500).json({ error: 'Erreur lors de l\'utilisation de l\'objet' });
  }
});

module.exports = { router, CATALOGUE };
