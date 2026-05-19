'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import toast from 'react-hot-toast';
import { Trophy, Clock, CheckCircle2, Zap } from 'lucide-react';

interface ChallengeState {
  key: string;
  emoji: string;
  description: string;
  reward: number;
  day: string;
  completed: boolean;
  winnerId: string | null;
  winnerPseudo: string | null;
  completedAt: string | null;
}

export default function ChallengePage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await api.get('/challenge');
      setChallenge(data);
    } catch {
      toast.error('Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: { pseudo: string; description: string; reward: number; emoji: string }) => {
      toast.success(`🏆 ${data.pseudo} a complété le défi du jour !`, { duration: 6000 });
      load();
    };
    socket.on('challenge:completed', handler);
    return () => { socket.off('challenge:completed', handler); };
  }, [socket]);

  if (!user) return null;

  const GAME_LINKS: Record<string, string> = {
    crash_7x: '/games/crash',
    crash_10x: '/games/crash',
    hilo_5streak: '/games/hilo',
    blackjack_bj: '/games/blackjack',
    limbo_100x: '/games/limbo',
    limbo_moon: '/games/limbo',
    roulette_zero: '/games/roulette',
    mines_10safe: '/games/mines',
    plinko_edge: '/games/plinko',
    dice_lucky: '/games/dice',
  };

  return (
    <div className="min-h-screen" style={{ background: '#0a0a16' }}>
      <Navbar />
      <div className="pt-20 pb-10 px-4 max-w-2xl mx-auto">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white mb-1">Défi du Jour</h1>
          <p className="text-gray-500 text-sm">Un seul gagnant par jour — soyez le premier !</p>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-20">Chargement…</div>
        ) : !challenge ? (
          <div className="text-center text-gray-500 py-20">Erreur de chargement</div>
        ) : (
          <div className="space-y-4">

            {/* Card principale */}
            <div
              className="rounded-2xl p-8 text-center relative overflow-hidden"
              style={{
                background: challenge.completed
                  ? 'linear-gradient(135deg, #052e16, #14532d)'
                  : 'linear-gradient(135deg, #1a0a3e, #2d1a6e)',
                border: `2px solid ${challenge.completed ? '#16a34a' : '#7c3aed'}`,
              }}
            >
              {/* Glow */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  background: challenge.completed
                    ? 'radial-gradient(circle at 50% 50%, #22c55e, transparent 70%)'
                    : 'radial-gradient(circle at 50% 50%, #7c3aed, transparent 70%)',
                }}
              />

              <div className="relative z-10">
                <div className="text-6xl mb-4">{challenge.emoji}</div>
                <div className="text-sm font-bold text-purple-300 mb-2 uppercase tracking-widest">
                  {challenge.day}
                </div>
                <p className="text-xl font-black text-white mb-6">{challenge.description}</p>

                <div className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/40 rounded-xl px-6 py-3 mb-6">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <span className="text-yellow-300 font-black text-xl">{formatBalance(challenge.reward)}</span>
                </div>

                {challenge.completed ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 text-green-400 font-black text-lg">
                      <CheckCircle2 className="w-6 h-6" />
                      Défi complété !
                    </div>
                    <p className="text-green-300 text-sm">
                      Remporté par <span className="font-black">{challenge.winnerPseudo}</span>
                      {challenge.winnerPseudo === user.pseudo && ' (toi !)'}
                    </p>
                    {challenge.completedAt && (
                      <p className="text-gray-500 text-xs">
                        à {new Date(challenge.completedAt).toLocaleTimeString('fr-FR')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 text-orange-400 font-bold text-sm">
                      <Clock className="w-4 h-4" />
                      En cours — pas encore remporté
                    </div>
                    {challenge.key && GAME_LINKS[challenge.key] && (
                      <a
                        href={GAME_LINKS[challenge.key]}
                        className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-black px-8 py-3 rounded-xl transition-colors text-sm"
                      >
                        <Zap className="w-4 h-4" />
                        Relever le défi
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Règles */}
            <div className="rounded-xl p-4 text-sm text-gray-400" style={{ background: '#0d0d1e', border: '1px solid #1e1e35' }}>
              <p className="font-bold text-gray-300 mb-2">Comment ça marche ?</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Un nouveau défi est tiré chaque jour à minuit</li>
                <li>Le premier joueur à accomplir la condition exacte remporte la récompense</li>
                <li>Aucun cumul : une fois remporté, le défi est verrouillé jusqu'au lendemain</li>
                <li>La récompense est créditée automatiquement sur ton solde</li>
              </ul>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
