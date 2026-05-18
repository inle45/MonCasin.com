const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const users = [
  { pseudo: 'Inlé', email: 'inle@moncasin.com', balance: 50000 },
  { pseudo: 'Louis', email: 'louis@moncasin.com', balance: 50000 },
  { pseudo: 'Amaury', email: 'amaury@moncasin.com', balance: 50000 },
  { pseudo: 'Noah', email: 'noah@moncasin.com', balance: 50000 },
  { pseudo: 'Matthieu', email: 'matthieu@moncasin.com', balance: 50000 },
];

const shopItems = [
  {
    name: 'Grade Silver',
    description: 'Obtenez le grade Silver et un badge exclusif sur votre profil',
    type: 'GRADE',
    value: 'SILVER',
    price: 5000,
  },
  {
    name: 'Grade Gold',
    description: 'Obtenez le grade Gold et un badge doré sur votre profil',
    type: 'GRADE',
    value: 'GOLD',
    price: 15000,
  },
  {
    name: 'Grade Platinum',
    description: 'Obtenez le grade Platinum et des avantages exclusifs',
    type: 'GRADE',
    value: 'PLATINUM',
    price: 50000,
  },
  {
    name: 'Grade Diamond',
    description: 'Le grade ultime, réservé aux meilleurs joueurs',
    type: 'GRADE',
    value: 'DIAMOND',
    price: 150000,
  },
  {
    name: 'Bordure Flamme',
    description: 'Une bordure animée de flammes pour votre avatar',
    type: 'AVATAR_BORDER',
    value: 'flame',
    price: 3000,
  },
  {
    name: 'Bordure Néon',
    description: 'Une bordure néon colorée pour votre avatar',
    type: 'AVATAR_BORDER',
    value: 'neon',
    price: 2000,
  },
  {
    name: 'Bordure Diamant',
    description: 'Une bordure scintillante de diamants',
    type: 'AVATAR_BORDER',
    value: 'diamond',
    price: 8000,
  },
  {
    name: 'Pseudo Rouge',
    description: 'Affichez votre pseudo en rouge dans le chat',
    type: 'PSEUDO_COLOR',
    value: '#ef4444',
    price: 1500,
  },
  {
    name: 'Pseudo Doré',
    description: 'Affichez votre pseudo en doré dans le chat',
    type: 'PSEUDO_COLOR',
    value: '#f59e0b',
    price: 2500,
  },
  {
    name: 'Pseudo Violet',
    description: 'Affichez votre pseudo en violet dans le chat',
    type: 'PSEUDO_COLOR',
    value: '#8b5cf6',
    price: 2000,
  },
  {
    name: 'Pseudo Arc-en-ciel',
    description: 'Un pseudo avec des couleurs changeantes',
    type: 'PSEUDO_COLOR',
    value: 'rainbow',
    price: 10000,
  },
];

const achievements = [
  {
    id: 'chasseur-multiplicateurs',
    key: 'chasseur_multiplicateurs',
    name: '👨‍🚀 Astronaute',
    description: 'Cash out au Crash à 50x ou plus',
    icon: '🚀',
    reward: 0,
  },
  {
    id: 'all-in-reussi',
    key: 'all_in_reussi',
    name: '🎯 All-In Réussi',
    description: 'Miser tout ton solde (min 10 000 F€) sur rouge/noir à la roulette et gagner',
    icon: '🎯',
    reward: 0,
  },
  {
    id: 'chat-noir',
    key: 'chat_noir',
    name: '🐱 Chat Noir',
    description: 'Crash arrive à 1.00x trois fois de suite',
    icon: '🐱‍👤',
    reward: 0,
  },
  {
    id: 'premier-gain',
    key: 'premier_gain',
    name: '🌟 Premier Gain',
    description: 'Gagner pour la première fois sur n\'importe quel jeu',
    icon: '⭐',
    reward: 500,
  },
  {
    id: 'riche-a-millions',
    key: 'riche_a_millions',
    name: '💎 Millionnaire',
    description: 'Atteindre un solde de 100 000 F€',
    icon: '💎',
    reward: 5000,
  },
];

async function main() {
  console.log('🎰 Démarrage du seed de la base de données...');

  const hashedPassword = await bcrypt.hash('Casino2024!', 10);

  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: { balance: userData.balance },
      create: {
        ...userData,
        password: hashedPassword,
        avatar: `/api/avatars/default-${Math.floor(Math.random() * 5) + 1}.png`,
      },
    });
    console.log(`✅ Utilisateur créé/mis à jour : ${user.pseudo} (${user.email}) - Solde: ${user.balance} F€`);
  }

  for (const itemData of shopItems) {
    const item = await prisma.shopItem.upsert({
      where: { id: itemData.value + '-' + itemData.type },
      update: {},
      create: {
        id: itemData.value + '-' + itemData.type,
        ...itemData,
      },
    });
    console.log(`🛒 Article de boutique créé : ${item.name} - ${item.price} F€`);
  }

  for (const ach of achievements) {
    await prisma.achievement.upsert({
      where: { id: ach.id },
      update: { name: ach.name, description: ach.description, icon: ach.icon },
      create: ach,
    });
    console.log(`🏆 Succès créé : ${ach.name}`);
  }

  console.log('✨ Seed terminé avec succès !');
  console.log('');
  console.log('Comptes de test (mot de passe : Casino2024!) :');
  users.forEach(u => console.log(`  - ${u.pseudo} : ${u.email}`));
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
