'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';

type Player = {
  id: string;
  pseudo: string;
  avatar: string | null;
  grade: string;
  pseudoColor: string | null;
  profit: number;
  bets: number;
  wins: number;
};

type TournamentData = {
  classement: Player[];
  weekStart: string;
  weekEnd: string;
  cagnotte: number;
  prix: { place: number; label: string; pourcentage: number; montant: number }[];
  totalBets: number;
  totalVolume: number;
};

const GRADE_COLORS: Record<string, string> = {
  NONE: '#9ca3af',
  SILVER: '#94a3b8',
  GOLD: '#f59e0b',
  PLATINUM: '#7dd3fc',
  DIAMOND: '#c084fc',
};

const RANK_STYLES: Record<number, { bg: string; border: string; glow: string }> = {
  1: { bg: 'rgba(245,158,11,0.15)', border: '2px solid #f59e0b', glow: '0 0 20px rgba(245,158,11,0.3)' },
  2: { bg: 'rgba(148,163,184,0.12)', border: '2px solid #94a3b8', glow: '0 0 12px rgba(148,163,184,0.2)' },
  3: { bg: 'rgba(180,83,9,0.12)', border: '2px solid #b45309', glow: '0 0 12px rgba(180,83,9,0.2)' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function daysLeft(end: string) {
  const diff = new Date(end).getTime() - Date.now();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return 'Terminé';
}

export default function TournamentPage() {
  const { user } = useAuth();
  const [data, setData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tournament')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const myRank = data?.classement.findIndex(p => p.id === user?.id);

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-20 pb-10 flex flex-col gap-5">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-black text-casino-gold">🏆 Tournoi Hebdo</h1>
          {data && (
            <p className="text-gray-400 text-sm mt-1">
              {formatDate(data.weekStart)} — {formatDate(data.weekEnd)} · Fin dans <span className="text-casino-gold font-bold">{daysLeft(data.weekEnd)}</span>
            </p>
          )}
        </div>

        {/* Cagnotte */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 text-center"
            style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(180,83,9,0.15))', border: '2px solid rgba(245,158,11,0.4)', boxShadow: '0 0 30px rgba(245,158,11,0.2)' }}
          >
            <div className="text-sm text-gray-400 uppercase tracking-widest mb-1">Cagnotte totale</div>
            <div className="text-4xl font-black text-casino-gold">{formatBalance(data.cagnotte)}</div>
            <div className="flex justify-center gap-4 mt-4">
              {data.prix.map(p => (
                <div key={p.place} className="text-center">
                  <div className="text-2xl">{p.label}</div>
                  <div className="text-sm font-bold text-white">{formatBalance(p.montant)}</div>
                  <div className="text-xs text-gray-500">{p.pourcentage}%</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Stats globales */}
        {data && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <div className="text-xs text-gray-400">Mises cette semaine</div>
              <div className="text-xl font-black text-white">{data.totalBets}</div>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <div className="text-xs text-gray-400">Volume total</div>
              <div className="text-xl font-black text-casino-gold">{formatBalance(data.totalVolume)}</div>
            </div>
          </div>
        )}

        {/* Ma position */}
        {data && myRank !== undefined && myRank >= 0 && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 text-sm"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <span className="text-casino-gold font-black text-lg">#{myRank + 1}</span>
            <span className="text-gray-300">Ta position cette semaine</span>
            <span className="ml-auto font-bold text-green-400">
              {data.classement[myRank].profit >= 0 ? '+' : ''}{formatBalance(data.classement[myRank].profit)}
            </span>
          </div>
        )}

        {/* Classement */}
        <div className="flex flex-col gap-2">
          <div className="text-sm text-gray-400 font-medium uppercase tracking-wider px-1">Classement</div>

          {loading && (
            <div className="text-center py-12 text-gray-500">Chargement...</div>
          )}

          {!loading && data?.classement.length === 0 && (
            <div className="rounded-xl py-10 text-center text-gray-500"
              style={{ background: 'rgba(30,27,75,0.4)', border: '1px solid rgba(245,158,11,0.1)' }}>
              Personne n'a encore misé cette semaine.<br />
              <span className="text-casino-gold font-bold">Sois le premier !</span>
            </div>
          )}

          {data?.classement.map((player, idx) => {
            const rank = idx + 1;
            const style = RANK_STYLES[rank] || {
              bg: 'rgba(30,27,75,0.4)',
              border: '1px solid rgba(245,158,11,0.1)',
              glow: 'none',
            };
            const isMe = player.id === user?.id;

            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: style.bg, border: isMe ? '2px solid #22c55e' : style.border, boxShadow: isMe ? '0 0 12px rgba(34,197,94,0.25)' : style.glow }}
              >
                {/* Rang */}
                <div className="w-8 text-center font-black text-lg flex-shrink-0"
                  style={{ color: rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : '#6b7280' }}>
                  {rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : `#${rank}`}
                </div>

                {/* Avatar */}
                <img
                  src={player.avatar || '/avatars/default-1.png'}
                  alt={player.pseudo}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-casino-border"
                  onError={e => { (e.target as HTMLImageElement).src = '/avatars/default-1.png'; }}
                />

                {/* Pseudo + stats */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate flex items-center gap-1"
                    style={{ color: player.pseudoColor || GRADE_COLORS[player.grade] }}>
                    {player.pseudo}
                    {isMe && <span className="text-xs text-green-400 font-normal">(toi)</span>}
                  </div>
                  <div className="text-xs text-gray-500">{player.bets} mises · {player.wins} victoires</div>
                </div>

                {/* Profit */}
                <div className={`font-black text-sm flex-shrink-0 ${player.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {player.profit >= 0 ? '+' : ''}{formatBalance(player.profit)}
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-600 mt-2">
          Le classement est basé sur le profit net (gains – mises) de la semaine.<br />
          Les prix sont distribués automatiquement à la fin du tournoi.
        </p>
      </div>
    </div>
  );
}
