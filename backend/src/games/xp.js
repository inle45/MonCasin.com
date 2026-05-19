const prisma = require('../config/database');
const { getIo } = require('../socket/ioInstance');

function getLevelFromXp(xp) {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

function getXpForLevel(level) {
  return Math.pow(level - 1, 2) * 50;
}

const LEVEL_REWARDS = { 5: 500, 10: 2000, 15: 5000, 20: 15000, 25: 50000 };

function getChestReward(level) {
  const base = level * level * 40;
  const bonus = Math.floor(Math.random() * base);
  return base + bonus;
}

async function grantXp(userId, betAmount) {
  const xpGain = Math.max(1, Math.floor(betAmount / 10));

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { xp: true, level: true } });
  if (!user) return;

  const newXp = user.xp + xpGain;
  const newLevel = getLevelFromXp(newXp);
  const leveledUp = newLevel > user.level;
  const levelReward = leveledUp ? (LEVEL_REWARDS[newLevel] || 0) : 0;
  const chestReward = leveledUp ? getChestReward(newLevel) : 0;
  const totalReward = levelReward + chestReward;

  const updates = { xp: newXp, level: newLevel };
  if (totalReward > 0) updates.balance = { increment: totalReward };

  await prisma.user.update({ where: { id: userId }, data: updates });

  if (leveledUp) {
    const io = getIo();
    if (io) io.to(userId).emit('xp:levelup', { level: newLevel, xp: newXp, reward: levelReward, chestReward });
    if (totalReward > 0) {
      await prisma.transaction.create({
        data: { userId, type: 'BONUS', amount: totalReward, description: `Niveau ${newLevel} + coffre` },
      });
    }
  }

  return { xpGain, newXp, newLevel, leveledUp, reward: levelReward, chestReward };
}

module.exports = { grantXp, getLevelFromXp, getXpForLevel };
