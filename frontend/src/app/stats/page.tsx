'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import { SkeletonStats } from '@/components/ui/Skeleton';

type GameStat = {
  game: string;
  _count: { id: number };
  _sum: { amount: number | null; result: number | null };
};

type DayStat = { date: string; profit: number; games: number };

type StatsData = {
  stats: GameStat[];
  advanced: {
    bestWin: { profit: number; game: string; multiplier: number; date: string } | null;
    worstStreak: number;
    totalWagered: number;
    totalGames: number;
    winRate: string;
  };
  dailyStats: DayStat[];
};

const GAME_ICONS: Record<string, string> = {
  CRASH: '⚡', ROULETTE: '🎡', SLOTS: '🎰', DICE: '🎲', MINES: '💣', HILO: '🃏',
};
const GAME_LABELS: Record<string, string> = {
  CRASH: 'Crash', ROULETTE: 'Roulette', SLOTS: 'Slots', DICE: 'Dés', MINES: 'Mines', HILO: 'Hi-Lo',
};

function ProfitChart({ days }: { days: DayStat[] }) {
  const hasData = days.some(d => d.games > 0);
  if (!hasData) return null;

  const profits = days.map(d => d.profit);
  const min = Math.min(...profits);
  const max = Math.max(...profits);
  const range = max - min || 1;
  const W = 600, H = 100;
  const px = (i: number) => (i / (days.length - 1)) * W;
  const py = (v: number) => H - ((v - min) / range) * (H - 12) - 6;

  const pathD = days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(d.profit).toFixed(1)}`).join(' ');
  const totalProfit = profits.reduce((a, b) => a + b, 0);
  const up = totalProfit >= 0;

  const color = up ? '#22c55e' : '#ef4444';

  // Labels de dates (1 sur 5)
  const labels = days.filter((_, i) => i % 5 === 0 || i === days.length - 1);

  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(245,158,11,0.15)' }}>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm font-bold text-gray-300">📈 Profit des 30 derniers jours</span>
        <span className={`text-sm font-black ${up ? 'text-green-400' : 'text-red-400'}`}>
          {up ? '+' : ''}{totalProfit.toLocaleString('fr-FR')} F€
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" style={{ height: 120 }}>
        <defs>
          <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <clipPath id="profitClip">
            <rect x="0" y="0" width={W} height={H} />
          </clipPath>
        </defs>
        {/* Zone neutre (y=0) */}
        <line x1="0" y1={py(0).toFixed(1)} x2={W} y2={py(0).toFixed(1)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
        {/* Aire */}
        <path d={`${pathD} L ${px(days.length - 1)} ${H} L 0 ${H} Z`} fill="url(#profitGrad)" clipPath="url(#profitClip)" />
        {/* Ligne */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Point final */}
        <circle cx={px(days.length - 1)} cy={py(days[days.length - 1].profit)} r="4" fill={color} />
        {/* Labels date */}
        {labels.map(d => {
          const i = days.findIndex(x => x.date === d.date);
          return (
            <text key={d.date} x={px(i)} y={H + 16} textAnchor="middle" fill="#6b7280" fontSize="9">
              {d.date.slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/games/stats')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const adv = data?.advanced;
  const totalProfit = data?.stats.reduce((s, g) =>
    s + ((g._sum.result ?? 0) - (g._sum.amount ?? 0)), 0) ?? 0;

  const bigStats = [
    { label: 'Parties jouées', value: adv?.totalGames ?? 0, sub: 'au total', color: '#f59e0b' },
    { label: 'Taux de victoire', value: `${adv?.winRate ?? '0'}%`, sub: 'des parties', color: '#22c55e' },
    { label: 'Total misé', value: formatBalance(adv?.totalWagered ?? 0), sub: 'depuis le début', color: '#60a5fa' },
    { label: 'Profit net', value: formatBalance(totalProfit), sub: totalProfit >= 0 ? '🟢 positif' : '🔴 négatif', color: totalProfit >= 0 ? '#22c55e' : '#ef4444' },
  ];

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-20 pb-10 flex flex-col gap-5">

        <div className="text-center">
          <h1 className="text-3xl font-black text-casino-gold">📊 Mes statistiques</h1>
          <p className="text-gray-400 text-sm mt-1">Ton historique complet depuis le début</p>
        </div>

        {loading ? (
          <SkeletonStats />
        ) : (
          <>
            {/* Big 4 */}
            <div className="grid grid-cols-2 gap-3">
              {bigStats.map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="rounded-2xl p-4 text-center"
                  style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                  <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.sub}</div>
                </motion.div>
              ))}
            </div>

            {/* Graphique 30 jours */}
            {data!.dailyStats && <ProfitChart days={data!.dailyStats} />}

            {/* Meilleur gain + pire série */}
            <div className="flex gap-3">
              {adv?.bestWin && (
                <div className="flex-1 rounded-xl p-4" style={{ background: 'rgba(20,83,45,0.4)', border: '1px solid rgba(34,197,94,0.3)' }}>
                  <div className="text-xs text-gray-400 mb-1">🏆 Meilleur gain</div>
                  <div className="text-lg font-black text-green-400">+{formatBalance(adv.bestWin.profit)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {GAME_ICONS[adv.bestWin.game]} {GAME_LABELS[adv.bestWin.game] || adv.bestWin.game}
                    {adv.bestWin.multiplier > 0 && ` · ×${adv.bestWin.multiplier}`}
                  </div>
                </div>
              )}
              {(adv?.worstStreak ?? 0) > 0 && (
                <div className="flex-1 rounded-xl p-4" style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <div className="text-xs text-gray-400 mb-1">💀 Pire série</div>
                  <div className="text-lg font-black text-red-400">{adv!.worstStreak} défaites</div>
                  <div className="text-xs text-gray-500 mt-0.5">d'affilée</div>
                </div>
              )}
            </div>

            {/* Par jeu */}
            {data!.stats.length > 0 && (
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <div className="px-4 py-3 border-b border-white/5">
                  <span className="text-sm font-bold text-gray-300">Détail par jeu</span>
                </div>
                {data!.stats.map((g, i) => {
                  const wagered = g._sum.amount ?? 0;
                  const gained = g._sum.result ?? 0;
                  const profit = gained - wagered;
                  return (
                    <motion.div key={g.game} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                      className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0">
                      <span className="text-2xl w-8 text-center">{GAME_ICONS[g.game] || '🎮'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{GAME_LABELS[g.game] || g.game}</div>
                        <div className="text-xs text-gray-500">{g._count.id} parties</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-black text-sm ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {profit >= 0 ? '+' : ''}{formatBalance(profit)}
                        </div>
                        <div className="text-xs text-gray-600">{formatBalance(wagered)} misé</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {data!.stats.length === 0 && (
              <div className="rounded-xl py-10 text-center text-gray-500"
                style={{ background: 'rgba(30,27,75,0.4)', border: '1px solid rgba(245,158,11,0.1)' }}>
                Aucune partie jouée pour l'instant.<br />
                <span className="text-casino-gold font-bold">Lance-toi !</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
