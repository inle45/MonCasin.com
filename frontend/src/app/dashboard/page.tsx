'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Navbar from '@/components/layout/Navbar';
import ChatPanel from '@/components/chat/ChatPanel';
import Leaderboard from '@/components/leaderboard/Leaderboard';
import { formatBalance } from '@/lib/api';
import { Zap, Trophy, ShoppingBag } from 'lucide-react';

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
    description: 'Faites tourner les rouleaux ! TRJ de 86% conforme à la loi française.',
    color: 'from-purple-500/20 to-violet-900/20',
    border: 'border-purple-500/30',
    badge: 'SOLO',
    badgeColor: 'text-purple-400 bg-purple-400/10',
  },
];

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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Jeux */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-casino-gold" />
              Nos jeux
            </h2>

            <div className="grid gap-4">
              {GAMES.map(game => (
                <Link key={game.href} href={game.href}>
                  <div className={`casino-card p-5 bg-gradient-to-r ${game.color} border ${game.border} hover:scale-[1.01] transition-transform cursor-pointer`}>
                    <div className="flex items-center gap-4">
                      <span className="text-5xl">{game.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-white">{game.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${game.badgeColor}`}>
                            {game.badge}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm">{game.description}</p>
                      </div>
                      <div className="text-2xl text-gray-600">›</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Boutique */}
            <Link href="/shop">
              <div className="casino-card p-5 bg-gradient-to-r from-casino-gold/10 to-transparent border border-casino-gold/20 hover:scale-[1.01] transition-transform cursor-pointer">
                <div className="flex items-center gap-4">
                  <ShoppingBag className="w-10 h-10 text-casino-gold" />
                  <div>
                    <h3 className="text-lg font-bold text-white">Boutique VIP</h3>
                    <p className="text-gray-400 text-sm">Achète des grades, bordures et couleurs de pseudo avec tes F€</p>
                  </div>
                </div>
              </div>
            </Link>
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
