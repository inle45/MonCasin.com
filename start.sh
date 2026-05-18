#!/bin/bash
set -e

echo "🎰 Démarrage de MonCasin.com..."

# Vérifier que PostgreSQL tourne
if ! pg_isready -h localhost -p 5432 -U casino_user -d moncasin > /dev/null 2>&1; then
  echo "⚡ Démarrage de PostgreSQL..."
  service postgresql start
  sleep 2
fi

# Migration et seed BDD
cd /home/user/MonCasin.com/backend
echo "📊 Synchronisation de la base de données..."
npx prisma db push --accept-data-loss > /dev/null 2>&1
node prisma/seed.js

# Démarrage du backend en arrière-plan
echo "🚀 Démarrage du backend (port 3001)..."
node src/server.js &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"
sleep 2

# Démarrage du frontend
cd /home/user/MonCasin.com/frontend
echo "🌐 Démarrage du frontend (port 3000)..."
npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ MonCasin.com est prêt !"
echo "  🌐 Frontend: http://localhost:3000"
echo "  🔌 Backend:  http://localhost:3001"
echo ""
echo "Comptes de test (mot de passe: Casino2024!):"
echo "  - Inlé       : inle@moncasin.com"
echo "  - Louis      : louis@moncasin.com"
echo "  - Amaury     : amaury@moncasin.com"
echo "  - Noah       : noah@moncasin.com"
echo "  - Matthieu   : matthieu@moncasin.com"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter"

# Attendre que les deux processus se terminent
wait $BACKEND_PID $FRONTEND_PID
