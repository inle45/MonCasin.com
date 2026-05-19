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
const { initSocket } = require('./socket/index');
const { setIo } = require('./socket/ioInstance');

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
app.use('/api/games', gameRoutes);
app.use('/api/bonuses', bonusRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/games/dice', diceRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/ping', (req, res) => res.json({ pong: true }));

// Rendre l'instance io accessible depuis les routes HTTP (jackpot, chat sync)
setIo(io);

// Initialisation Socket.io
initSocket(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎰 MonCasin.com Backend démarré sur le port ${PORT}`);
  console.log(`🌐 CORS autorisé pour : ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

module.exports = { app, server, io };
