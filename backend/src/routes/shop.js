const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/items', async (req, res) => {
  try {
    const items = await prisma.shopItem.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement de la boutique' });
  }
});

router.post('/buy/:itemId', authenticate, async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await prisma.shopItem.findUnique({ where: { id: itemId } });
    if (!item || !item.isActive) {
      return res.status(404).json({ error: 'Article introuvable' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.balance < item.price) {
      return res.status(400).json({ error: 'Solde insuffisant' });
    }

    const alreadyPurchased = await prisma.shopPurchase.findFirst({
      where: { userId: req.user.id, itemId },
    });
    if (alreadyPurchased) {
      return res.status(400).json({ error: 'Vous possédez déjà cet article' });
    }

    const updateData = {};
    if (item.type === 'GRADE') updateData.grade = item.value;
    if (item.type === 'AVATAR_BORDER') updateData.avatarBorder = item.value;
    if (item.type === 'PSEUDO_COLOR') updateData.pseudoColor = item.value;

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          balance: { decrement: item.price },
          ...updateData,
        },
        select: {
          id: true, pseudo: true, balance: true, grade: true,
          avatarBorder: true, pseudoColor: true,
        },
      }),
      prisma.shopPurchase.create({
        data: { userId: req.user.id, itemId },
      }),
      prisma.transaction.create({
        data: {
          userId: req.user.id,
          type: 'PURCHASE',
          amount: -item.price,
          description: `Achat : ${item.name}`,
        },
      }),
    ]);

    res.json({
      success: true,
      message: `${item.name} acheté avec succès !`,
      user: updatedUser,
    });
  } catch (err) {
    console.error('Erreur achat boutique:', err);
    res.status(500).json({ error: 'Erreur lors de l\'achat' });
  }
});

router.get('/my-purchases', authenticate, async (req, res) => {
  try {
    const purchases = await prisma.shopPurchase.findMany({
      where: { userId: req.user.id },
      include: { item: true },
    });
    res.json({ purchases });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement des achats' });
  }
});

module.exports = router;
