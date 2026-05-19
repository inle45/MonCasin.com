const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getIo } = require('../socket/ioInstance');

const router = express.Router();

// POST /api/duel/challenge
// body: { targetPseudo, amount }
router.post('/challenge', authenticate, async (req, res) => {
  try {
    const { targetPseudo, amount } = req.body;
    const mise = parseFloat(amount);

    if (!mise || mise <= 0) {
      return res.status(400).json({ error: 'Mise invalide' });
    }

    if (!targetPseudo || typeof targetPseudo !== 'string') {
      return res.status(400).json({ error: 'Pseudo cible requis' });
    }

    // Empêcher de se défier soi-même
    if (targetPseudo.toLowerCase() === req.user.pseudo.toLowerCase()) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous défier vous-même' });
    }

    // Vérifier que la cible existe
    const targetUser = await prisma.user.findUnique({
      where: { pseudo: targetPseudo },
      select: { id: true, pseudo: true },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Vérifier le solde du challenger
    const challenger = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, pseudo: true, balance: true },
    });

    if (challenger.balance < mise) {
      return res.status(400).json({ error: 'Solde insuffisant' });
    }

    // Débiter le challenger et créer le duel en une transaction
    const [, duel] = await prisma.$transaction([
      prisma.user.update({
        where: { id: challenger.id },
        data: { balance: { decrement: mise } },
      }),
      prisma.duel.create({
        data: {
          challengerId: challenger.id,
          challengerPseudo: challenger.pseudo,
          targetId: targetUser.id,
          targetPseudo: targetUser.pseudo,
          amount: mise,
          status: 'PENDING',
        },
      }),
    ]);

    // Notifier la cible via socket
    const io = getIo();
    if (io) {
      io.to(targetUser.id).emit('duel:incoming', {
        duelId: duel.id,
        challengerId: challenger.id,
        challengerPseudo: challenger.pseudo,
        targetId: targetUser.id,
        targetPseudo: targetUser.pseudo,
        amount: mise,
      });
    }

    return res.json({ duelId: duel.id, message: 'Défi envoyé' });
  } catch (err) {
    console.error('Erreur duel/challenge:', err);
    return res.status(500).json({ error: 'Erreur lors de la création du défi' });
  }
});

// POST /api/duel/respond
// body: { duelId, accept }
router.post('/respond', authenticate, async (req, res) => {
  try {
    const { duelId, accept } = req.body;

    if (!duelId) {
      return res.status(400).json({ error: 'duelId requis' });
    }

    const duel = await prisma.duel.findUnique({ where: { id: duelId } });

    if (!duel) {
      return res.status(404).json({ error: 'Duel introuvable' });
    }

    // Valider que c'est bien la cible qui répond
    if (duel.targetId !== req.user.id) {
      return res.status(403).json({ error: 'Vous n\'êtes pas la cible de ce défi' });
    }

    // Valider que le duel est toujours en attente
    if (duel.status !== 'PENDING') {
      return res.status(400).json({ error: 'Ce défi n\'est plus en attente' });
    }

    const io = getIo();

    // — Refus —
    if (!accept) {
      await prisma.$transaction([
        prisma.duel.update({
          where: { id: duelId },
          data: { status: 'DECLINED', resolvedAt: new Date() },
        }),
        // Rembourser le challenger
        prisma.user.update({
          where: { id: duel.challengerId },
          data: { balance: { increment: duel.amount } },
        }),
      ]);

      if (io) {
        io.to(duel.challengerId).emit('duel:declined', {
          duelId: duel.id,
          challengerPseudo: duel.challengerPseudo,
          targetPseudo: duel.targetPseudo,
          amount: duel.amount,
        });
      }

      return res.json({ accepted: false, message: 'Défi refusé' });
    }

    // — Acceptation —

    // Vérifier le solde de la cible
    const targetUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { balance: true },
    });

    if (targetUser.balance < duel.amount) {
      return res.status(400).json({ error: 'Solde insuffisant pour accepter le défi' });
    }

    // Lancer les dés (1-100) jusqu'à ce qu'il n'y ait pas d'égalité
    let challengerRoll, targetRoll;
    do {
      challengerRoll = Math.floor(Math.random() * 100) + 1;
      targetRoll = Math.floor(Math.random() * 100) + 1;
    } while (challengerRoll === targetRoll);

    const challengerWins = challengerRoll > targetRoll;
    const winnerId = challengerWins ? duel.challengerId : duel.targetId;
    const winnerPseudo = challengerWins ? duel.challengerPseudo : duel.targetPseudo;
    const loserId = challengerWins ? duel.targetId : duel.challengerId;

    const prize = Math.round(2 * duel.amount * 0.97 * 100) / 100;

    await prisma.$transaction([
      // Débiter la cible
      prisma.user.update({
        where: { id: duel.targetId },
        data: { balance: { decrement: duel.amount } },
      }),
      // Créditer le gagnant
      prisma.user.update({
        where: { id: winnerId },
        data: { balance: { increment: prize } },
      }),
      // Mettre à jour le duel
      prisma.duel.update({
        where: { id: duelId },
        data: {
          status: 'COMPLETED',
          winnerId,
          winnerPseudo,
          challengerRoll,
          targetRoll,
          resolvedAt: new Date(),
        },
      }),
      // Transaction pour le gagnant
      prisma.transaction.create({
        data: {
          userId: winnerId,
          type: 'WIN',
          amount: prize,
          description: `Duel gagné contre ${winnerId === duel.challengerId ? duel.targetPseudo : duel.challengerPseudo}`,
        },
      }),
      // Transaction pour le perdant
      prisma.transaction.create({
        data: {
          userId: loserId,
          type: 'LOSS',
          amount: duel.amount,
          description: `Duel perdu contre ${loserId === duel.challengerId ? duel.targetPseudo : duel.challengerPseudo}`,
        },
      }),
    ]);

    const resultPayload = {
      duelId: duel.id,
      challengerPseudo: duel.challengerPseudo,
      targetPseudo: duel.targetPseudo,
      amount: duel.amount,
      challengerRoll,
      targetRoll,
      winnerId,
      winnerPseudo,
      prize,
    };

    // Notifier les deux joueurs
    if (io) {
      io.to(duel.challengerId).emit('duel:result', resultPayload);
      io.to(duel.targetId).emit('duel:result', resultPayload);
    }

    return res.json({ accepted: true, result: resultPayload });
  } catch (err) {
    console.error('Erreur duel/respond:', err);
    return res.status(500).json({ error: 'Erreur lors de la réponse au défi' });
  }
});

// GET /api/duel/pending
// Retourne les duels en attente où req.user est challenger ou cible
router.get('/pending', authenticate, async (req, res) => {
  try {
    const duels = await prisma.duel.findMany({
      where: {
        status: 'PENDING',
        OR: [
          { challengerId: req.user.id },
          { targetId: req.user.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ duels });
  } catch (err) {
    console.error('Erreur duel/pending:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération des duels' });
  }
});

module.exports = router;
