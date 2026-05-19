'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';

type Entry = { rank: number; userId: string; pseudo: string; avatar: string | null; grade: string; wagered: number; reward: number };
type RaceState = { leaderboard: Entry[]; myWagered: number; myRank: number | null; weekStart: string; weekEnd: string; rewards: Record<string, number> };

const GRADE_COLORS: Record<string, string> = { NONE: '#9ca3af', SILVER: '#94a3b8', GOLD: '#f59e0b', PLATINUM: '#7dd3fc', DIAMOND: '#c084fc' };
const RANK_ICONS = ['🥇', '🥈', '🥉'];

function Countdown() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const nextMonday = new Date(now);
      nextMonday.setHours(0, 0, 0, 0);
      const day = nextMonday.getDay();
      nextMonday.setDate(nextMonday.getDate() + ((8 - day) % 7 || 7));
      setSecs(Math.max(0, Math.floor((nextMonday.getTime() - now.getTime()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return (
    <span className="font-mono text-casino-gold">
      {d > 0 ? `${d}j ` : ''}{String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
    </span>
  );
}

export default function RacePage() {
  const { user } = useAuth();
  const [state, setState] = useState<RaceState | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(() => {
    api.get('/race').then(r => setState(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetch(); const id = setInterval(fetch, 30000); return () => clearInterval(id); }, [fetch]);

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-20 pb-10 flex flex-col gap-5">

        <div className="text-center">
          <h1 className="text-3xl font-black text-casino-gold">🏁 Wager Race</h1>
          <p className="text-gray-400 text-sm mt-1">Mise le plus possible cette semaine — top 3 récompensés</p>
        </div>

        {/* Timer + Récompenses */}
        <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.1),rgba(239,68,68,0.08))', border: '2px solid rgba(245,158,11,0.25)' }}>
          <div className="text-center mb-4">
            <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Reset dans</div>
            <div className="text-2xl font-black"><Countdown /></div>
          </div>
          <div className="flex gap-2">
            {[{ rank: 1, prize: state?.rewards[1] ?? 10000, icon: '🥇' }, { rank: 2, prize: state?.rewards[2] ?? 5000, icon: '🥈' }, { rank: 3, prize: state?.rewards[3] ?? 2000, icon: '🥉' }].map(r => (
              <div key={r.rank} className="flex-1 text-center py-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <div className="text-2xl">{r.icon}</div>
                <div className="text-casino-gold font-black text-sm mt-1">{formatBalance(r.prize)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Ma position */}
        {state && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <span className="text-2xl">{state.myRank && state.myRank <= 3 ? RANK_ICONS[state.myRank - 1] : '📊'}</span>
            <div className="flex-1">
              <div className="text-sm font-bold">Ma position</div>
              <div className="text-xs text-gray-400">{state.myRank ? `#${state.myRank}` : 'Non classé'}</div>
            </div>
            <div className="text-right">
              <div className="text-casino-gold font-black">{formatBalance(state.myWagered)}</div>
              <div className="text-xs text-gray-500">misés</div>
            </div>
          </div>
        )}

        {/* Classement */}
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-widest px-1 mb-2">Classement de la semaine</div>
          <div className="flex flex-col gap-2">
            {loading && <div className="text-center text-gray-500 py-8">Chargement...</div>}
            {state?.leaderboard.map((entry, i) => (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: entry.userId === user?.id ? 'rgba(99,102,241,0.15)' : 'rgba(30,27,75,0.4)',
                  border: `1px solid ${i < 3 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.05)'}`,
                }}
              >
                <span className="text-xl w-7 text-center">{i < 3 ? RANK_ICONS[i] : `#${entry.rank}`}</span>
                <img
                  src={entry.avatar || '/avatars/default-1.png'}
                  className="w-8 h-8 rounded-full"
                  onError={e => { (e.target as HTMLImageElement).src = '/avatars/default-1.png'; }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate" style={{ color: GRADE_COLORS[entry.grade] }}>{entry.pseudo}</div>
                  <div className="text-xs text-gray-500">{formatBalance(entry.wagered)} misés</div>
                </div>
                {entry.reward > 0 && (
                  <div className="text-casino-gold font-black text-sm">+{formatBalance(entry.reward)}</div>
                )}
              </motion.div>
            ))}
            {state?.leaderboard.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500">Aucune mise cette semaine. Sois le premier !</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
