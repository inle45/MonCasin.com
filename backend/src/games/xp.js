const prisma = require('../config/database');
const { getIo } = require('../socket/ioInstance');

// level = floor(sqrt(xp / 50)) + 1
// Level 2 = 50 XP (~500 F€ wagered), Level 5 = 800 XP (~8k F€), Level 10 = 4500 XP (~45k F€)
function getLevelFromXp(xp) {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

function getXpForLevel(level) {
  return Math.pow(level - 1, 2) * 50;
}

const LEVEL_REWARDS = { 5: 500, 10: 2000, 15: 5000, 20: 15000, 25: 50000 };

async function grantXp(userId, betAmount) {
  const xpGain = Math.max(1, Math.floor(betAmount / 10));

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { xp: true, level: true } });
  if (!user) return;

  const newXp = user.xp + xpGain;
  const newLevel = getLevelFromXp(newXp);
  const leveledUp = newLevel > user.level;
  const reward = leveledUp ? (LEVEL_REWARDS[newLevel] || 0) : 0;

  const updates = { xp: newXp, level: newLevel };
  if (reward > 0) updates.balance = { increment: reward };

  await prisma.user.update({ where: { id: userId }, data: updates });

  if (leveledUp) {
    const io = getIo();
    if (io) io.to(userId).emit('xp:levelup', { level: newLevel, xp: newXp, reward });
    if (reward > 0) {
      await prisma.transaction.create({
        data: { userId, type: 'BONUS', amount: reward, description: `Passage niveau ${newLevel}` },
      });
    }
  }

  return { xpGain, newXp, newLevel, leveledUp, reward };
}

module.exports = { grantXp, getLevelFromXp, getXpForLevel };
