'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import api, { getAvatarUrl } from '@/lib/api';
import { Skeleton } from '@/components/ui/Skeleton';

const GRADE_BADGES: Record<string, string> = { SILVER: '🥈', GOLD: '🥇', PLATINUM: '💠', DIAMOND: '💎' };
const MEDALS = ['🥇', '🥈', '🥉', '4', '5'];

interface RankEntry {
  pseudo: string;
  avatar?: string;
  grade?: string;
  value: number;
  label: string;
}

interface GameLeaderboard {
  crashTop: RankEntry[];
  limboTop: RankEntry[];
  plinkoTop: RankEntry[];
  wageredTop: RankEntry[];
}

function RankTable({ title, icon, entries, loading }: { title: string; icon: string; entries: RankEntry[]; loading: boolean }) {
  return (
    <div className="casino-card overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        <span className="font-black text-white">{title}</span>
      </div>
      <div className="divide-y divide-white/5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <Skeleton className="w-7 h-5" />
              <Skeleton className="w-7 h-7 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          ))
        ) : entries.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-500 text-sm">Aucune donnée</div>
        ) : (
          entries.map((e, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
            >
              <span className="w-7 text-center font-black text-lg">
                {i < 3 ? MEDALS[i] : <span className="text-gray-500 text-sm">{i + 1}</span>}
              </span>
              <img
                src={getAvatarUrl(e.avatar)}
                alt={e.pseudo}
                className="w-7 h-7 rounded-full flex-shrink-0"
                onError={ev => { (ev.target as HTMLImageElement).src = '/avatars/default-1.svg'; }}
              />
              <span className="flex-1 font-bold text-white text-sm">
                {e.grade && GRADE_BADGES[e.grade] && <span className="mr-1 text-xs">{GRADE_BADGES[e.grade]}</span>}
                {e.pseudo}
              </span>
              <span className={`font-black text-sm ${i === 0 ? 'text-casino-gold' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-700' : 'text-gray-400'}`}>
                {e.label}
              </span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [data, setData] = useState<GameLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [balanceTop, setBalanceTop] = useState<RankEntry[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/users/leaderboard/games'),
      api.get('/users/leaderboard'),
    ]).then(([gRes, bRes]) => {
      setData(gRes.data);
      setBalanceTop((bRes.data.users || []).slice(0, 5).map((u: any) => ({
        pseudo: u.pseudo,
        avatar: u.avatar,
        grade: u.grade,
        value: u.balance,
        label: `${Math.round(u.balance).toLocaleString('fr-FR')} F€`,
      })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 pt-20 pb-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-casino-gold">🏆 Classements</h1>
          <p className="text-gray-400 text-sm mt-1">Les meilleurs joueurs par catégorie</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <RankTable title="Solde le plus élevé" icon="💰" entries={balanceTop} loading={loading} />
          <RankTable title="Meilleur Crash cashout" icon="🚀" entries={data?.crashTop ?? []} loading={loading} />
          <RankTable title="Plus gros volume misé" icon="🎲" entries={data?.wageredTop ?? []} loading={loading} />
          <RankTable title="Plus gros gain aux Mines" icon="💣" entries={data?.plinkoTop ?? []} loading={loading} />
        </div>
      </div>
    </div>
  );
}
