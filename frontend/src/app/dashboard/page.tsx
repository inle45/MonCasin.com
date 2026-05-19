'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Navbar from '@/components/layout/Navbar';
import ChatPanel from '@/components/chat/ChatPanel';
import Leaderboard from '@/components/leaderboard/Leaderboard';
import api, { formatBalance } from '@/lib/api';
import { Zap, ShoppingBag } from 'lucide-react';

const GAMES = [
  {
    href: '/games/crash',
    title: 'Crash Game',
    icon: '🚀',
    description: 'Multiplie tes gains avant le crash ! Jeu multijoueur en temps réel.',
    color: 'from-green-500/20 to-emerald-900/20',
    border: 'border-green-500/30',
    badge: 'MULTIJOUEUR',
    badgeColor: 'text-green-400 bg-green-400/10',
  },
  {
    href: '/games/roulette',
    title: 'Roulette',
    icon: '🎡',
    description: 'Roulette européenne classique. Place tes mises et tente ta chance !',
    color: 'from-red-500/20 to-rose-900/20',
    border: 'border-red-500/30',
    badge: 'MULTIJOUEUR',
    badgeColor: 'text-red-400 bg-red-400/10',
  },
  {
    href: '/games/slots',
    title: 'Machine à Sous',
    icon: '🎰',
    description: 'Faites tourner les rouleaux ! Jackpot progressif, bonus coffres et roue.',
    color: 'from-purple-500/20 to-violet-900/20',
    border: 'border-purple-500/30',
    badge: 'SOLO',
    badgeColor: 'text-purple-400 bg-purple-400/10',
  },
  {
    href: '/games/blackjack',
    title: 'Blackjack',
    icon: '🃏',
    description: 'Battez le croupier sans dépasser 21. Double, split et bonus Happy Hour !',
    color: 'from-yellow-500/20 to-amber-900/20',
    border: 'border-yellow-500/30',
    badge: 'SOLO',
    badgeColor: 'text-yellow-400 bg-yellow-400/10',
  },
  {
    href: '/games/mines',
    title: 'Mines',
    icon: '💣',
    description: 'Évite les mines et cashout quand tu veux. Plus tu révèles, plus tu gagnes !',
    color: 'from-orange-500/20 to-orange-900/20',
    border: 'border-orange-500/30',
    badge: 'SOLO',
    badgeColor: 'text-orange-400 bg-orange-400/10',
  },
  {
    href: '/games/plinko',
    title: 'Plinko',
    icon: '🪙',
    description: 'Lâche la bille et regarde-la rebondir vers des multiplicateurs fous !',
    color: 'from-pink-500/20 to-pink-900/20',
    border: 'border-pink-500/30',
    badge: 'SOLO',
    badgeColor: 'text-pink-400 bg-pink-400/10',
  },
  {
    href: '/games/dice',
    title: 'Dice',
    icon: '🎲',
    description: 'Lance 2 dés et parie sur le résultat. Multiplicateurs jusqu\'à ×17 !',
    color: 'from-blue-500/20 to-blue-900/20',
    border: 'border-blue-500/30',
    badge: 'SOLO',
    badgeColor: 'text-blue-400 bg-blue-400/10',
  },
  {
    href: '/games/hilo',
    title: 'Hi-Lo',
    icon: '🎴',
    description: 'Plus haut ou plus bas ? Enchaîne les bonnes prédictions pour multiplier !',
    color: 'from-cyan-500/20 to-cyan-900/20',
    border: 'border-cyan-500/30',
    badge: 'SOLO',
    badgeColor: 'text-cyan-400 bg-cyan-400/10',
  },
  {
    href: '/games/limbo',
    title: 'Limbo',
    icon: '🌙',
    description: 'Choisis ton multiplicateur cible et tente de l\'atteindre. Jusqu\'à ×1 000 000 !',
    color: 'from-indigo-500/20 to-indigo-900/20',
    border: 'border-indigo-500/30',
    badge: 'SOLO',
    badgeColor: 'text-indigo-400 bg-indigo-400/10',
  },
];

function FortuneGraph() {
  const [points, setPoints] = useState<number[]>([]);

  useEffect(() => {
    api.get('/games/stats').then(res => {
      const bets: { amount: number; result: number; won: boolean }[] = res.data.advanced ? [] : [];
      // Reconstituer la courbe depuis les paris
      api.get('/games/stats').then(r => {
        const allBets: { amount: number; result: number | null }[] = [];
        // On n'a pas l'historique complet ici, on simule avec les transactions
      });
    }).catch(() => {});

    // Chercher dans les transactions
    api.get('/users/me/transactions').then(res => {
      const txs: { amount: number }[] = res.data.transactions || [];
      let balance = 50000;
      const curve = [balance];
      txs.slice(-29).forEach(tx => {
        balance += tx.amount;
        curve.push(Math.max(0, balance));
      });
      setPoints(curve);
    }).catch(() => setPoints([50000]));
  }, []);

  if (points.length < 2) return null;

  const W = 300, H = 80;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const px = (i: number) => (i / (points.length - 1)) * W;
  const py = (v: number) => H - ((v - min) / range) * (H - 8) - 4;
  const pathD = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const up = last >= first;

  return (
    <div className="casino-card p-4 mt-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-bold text-gray-300">📈 Courbe de fortune</span>
        <span className={`text-sm font-black ${up ? 'text-green-400' : 'text-red-400'}`}>
          {up ? '+' : ''}{formatBalance(last - first)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
        <defs>
          <linearGradient id="fgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? '#10b981' : '#ef4444'} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={up ? '#10b981' : '#ef4444'} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={`${pathD} L ${px(points.length-1)} ${H} L 0 ${H} Z`} fill="url(#fgrad)"/>
        <path d={pathD} fill="none" stroke={up ? '#10b981' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={px(points.length-1)} cy={py(last)} r="4" fill={up ? '#10b981' : '#ef4444'}/>
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-casino-dark flex items-center justify-center">
        <div className="text-casino-gold animate-pulse text-xl">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-casino-dark">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 pt-20 pb-8">
        {/* Bienvenue */}
        <div className="mb-8">
          <div className="casino-card p-6 bg-gradient-to-r from-casino-gold/10 to-transparent border-casino-gold/20">
            <div className="flex items-center gap-4">
              <img
                src={user.avatar || '/avatars/default-1.png'}
                alt={user.pseudo}
                className="w-16 h-16 rounded-full border-2 border-casino-gold"
                onError={e => { (e.target as HTMLImageElement).src = '/avatars/default-1.png'; }}
              />
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Bienvenue, <span className="text-casino-gold">{user.pseudo}</span> !
                </h1>
                <div className="text-3xl font-bold text-casino-gold mt-1">
                  {formatBalance(user.balance)}
                </div>
                <p className="text-gray-400 text-sm">Solde disponible en Euro Fictif</p>
              </div>
            </div>
          </div>
          <FortuneGraph />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Jeux */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-casino-gold" />
              Nos jeux
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {GAMES.map(game => (
                <Link key={game.href} href={game.href}>
                  <div className={`casino-card p-4 bg-gradient-to-r ${game.color} border ${game.border} hover:scale-[1.01] transition-transform cursor-pointer h-full`}>
                    <div className="flex items-center gap-3">
                      <span className="text-4xl flex-shrink-0">{game.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-bold text-white truncate">{game.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${game.badgeColor}`}>
                            {game.badge}
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs line-clamp-2">{game.description}</p>
                      </div>
                      <div className="text-xl text-gray-600 flex-shrink-0">›</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Boutique + Bonus en ligne */}
            <div className="grid grid-cols-2 gap-4">
              <Link href="/shop">
                <div className="casino-card p-4 bg-gradient-to-r from-casino-gold/10 to-transparent border border-casino-gold/20 hover:scale-[1.01] transition-transform cursor-pointer">
                  <div className="flex items-center gap-3">
                    <ShoppingBag className="w-8 h-8 text-casino-gold flex-shrink-0" />
                    <div>
                      <h3 className="font-bold text-white">Boutique VIP</h3>
                      <p className="text-gray-400 text-xs">Grades, bordures, couleurs</p>
                    </div>
                  </div>
                </div>
              </Link>
              <Link href="/bonuses">
                <div className="casino-card p-4 bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-500/20 hover:scale-[1.01] transition-transform cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl flex-shrink-0">🎁</span>
                    <div>
                      <h3 className="font-bold text-white">Bonus & Succès</h3>
                      <p className="text-gray-400 text-xs">Roue, aide, prêts, succès</p>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Colonne droite : Chat + Leaderboard */}
          <div className="space-y-4 flex flex-col">
            <Leaderboard />
            <div className="flex-1 min-h-[400px]">
              <ChatPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
