require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const shopRoutes = require('./routes/shop');
const gameRoutes = require('./routes/games');
const bonusRoutes = require('./routes/bonuses');
const { router: inventoryRoutes } = require('./routes/inventory');
const diceRoutes = require('./routes/dice');
const minesRoutes = require('./routes/mines');
const tournamentRoutes = require('./routes/tournament');
const { distributeTournamentRewards } = tournamentRoutes;
const questRoutes = require('./routes/quests');
const hiloRoutes = require('./routes/hilo');
const { router: lotteryRoutes, checkPendingDraw } = require('./routes/lottery');
const limboRoutes = require('./routes/limbo');
const rakebackRoutes = require('./routes/rakeback');
const plinkoRoutes = require('./routes/plinko');
const { router: raceRoutes, distributeRaceRewards } = require('./routes/race');
const blackjackRoutes = require('./routes/blackjack');
const { router: challengeRoutes } = require('./routes/challenge');
const scratchRoutes = require('./routes/scratch');
const { router: battlePassRoutes } = require('./routes/battlepass');
const duelRoutes = require('./routes/duel');
const { getHappyHourStatus } = require('./utils/happyHour');
const { getWeather, rotateWeather } = require('./utils/weather');
const { initSocket } = require('./socket/index');
const { setIo } = require('./socket/ioInstance');
const wheelRoutes = require('./routes/wheel');
const baccaratRoutes = require('./routes/baccarat');
const horsesRoutes = require('./routes/horses');

const app = express();
const server = http.createServer(app);

const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  const allowed = [
    process.env.FRONTEND_URL,
    /\.vercel\.app$/,
    /localhost/,
  ];
  const ok = allowed.some(p => p instanceof RegExp ? p.test(origin) : p === origin);
  callback(ok ? null : new Error('CORS bloqué'), ok);
};

const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true },
});

app.use(cors({ origin: corsOrigin, credentials: true }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir les fichiers statiques (avatars uploadés)
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/avatars', express.static(path.join(__dirname, '../public/avatars')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shop', shopRoutes);
// Nouveaux jeux — montés AVANT /api/games pour éviter les conflits de préfixe
app.use('/api/games/wheel', wheelRoutes);
app.use('/api/games/baccarat', baccaratRoutes);
app.use('/api/games/horses', horsesRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/bonuses', bonusRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/games/dice', diceRoutes);
app.use('/api/games/mines', minesRoutes);
app.use('/api/tournament', tournamentRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/games/hilo', hiloRoutes);
app.use('/api/lottery', lotteryRoutes);
app.use('/api/games/limbo', limboRoutes);
app.use('/api/games/plinko', plinkoRoutes);
app.use('/api/games/blackjack', blackjackRoutes);
app.get('/api/happyhour', (req, res) => res.json(getHappyHourStatus()));
app.get('/api/weather', (req, res) => res.json(getWeather()));
app.use('/api/rakeback', rakebackRoutes);
app.use('/api/race', raceRoutes);
app.use('/api/challenge', challengeRoutes);
app.use('/api/scratch', scratchRoutes);
app.use('/api/battlepass', battlePassRoutes);
app.use('/api/duel', duelRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/ping', (req, res) => res.json({ pong: true }));

// Rendre l'instance io accessible depuis les routes HTTP (jackpot, chat sync)
setIo(io);

// Initialisation Socket.io
initSocket(io);

// Prévenir les crashes sur rejections non-catchées
process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Unhandled rejection:', reason);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎰 MonCasin.com Backend démarré sur le port ${PORT}`);
  console.log(`🌐 CORS autorisé pour : ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  // Vérifier les tirages en attente 5s après démarrage puis toutes les heures
  setTimeout(checkPendingDraw, 5000);
  setInterval(checkPendingDraw, 60 * 60 * 1000);
  // Wager Race + Tournoi : distribue les récompenses chaque lundi à 00h05
  setInterval(() => {
    const now = new Date();
    if (now.getDay() === 1 && now.getHours() === 0) {
      distributeRaceRewards();
      distributeTournamentRewards(io);
    }
  }, 60 * 60 * 1000);

  // Broadcast Happy Hour status toutes les minutes
  let lastHH = false;
  setInterval(() => {
    const status = getHappyHourStatus();
    if (status.active !== lastHH) {
      lastHH = status.active;
      io.emit('happyhour:update', status);
    }
  }, 60 * 1000);
  io.emit('happyhour:update', getHappyHourStatus());

  // Météo des gains — change toutes les heures
  setInterval(() => {
    const w = rotateWeather();
    io.emit('weather:update', w);
    console.log(`🌤️ Nouvelle météo : ${w.emoji} ${w.name}`);
  }, 60 * 60 * 1000);
  io.emit('weather:update', getWeather());
});

module.exports = { app, server, io };
