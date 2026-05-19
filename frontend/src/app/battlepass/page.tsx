'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/context/AuthContext';
import api, { formatBalance } from '@/lib/api';
import toast from 'react-hot-toast';
import { Trophy, Lock, CheckCircle2, ChevronRight } from 'lucide-react';

interface Tier { tier: number; xp: number; reward: number; }
interface BPState {
  season: string;
  bpXp: number;
  tiers: Tier[];
  claimedTiers: number[];
}

const MILESTONES = new Set([5, 10, 15, 20, 25, 30]);

function SeasonLabel({ season }: { season: string }) {
  const [year, month] = season.split('-');
  const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return <span className="capitalize">{label}</span>;
}

function XpBar({ current, max, label }: { current: number; max: number; label?: string }) {
  const pct = Math.min(100, Math.round((current / max) * 100));
  return (
    <div>
      {label && <div className="flex justify-between text-xs text-gray-400 mb-1"><span>{label}</span><span>{current.toLocaleString('fr-FR')} / {max.toLocaleString('fr-FR')} XP</span></div>}
      <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BattlePassPage() {
  const { user, updateUser } = useAuth();
  const [bp, setBp] = useState<BPState | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);

  const load = () => {
    api.get('/battlepass').then(({ data }) => setBp(data)).catch(() => toast.error('Erreur')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const claim = async (tier: number, reward: number) => {
    setClaiming(tier);
    try {
      const { data } = await api.post(`/battlepass/claim/${tier}`);
      updateUser({ balance: data.newBalance });
      setBp(prev => prev ? { ...prev, claimedTiers: [...prev.claimedTiers, tier] } : prev);
      toast.success(`🎁 Palier ${tier} — +${formatBalance(reward)} !`, { duration: 4000 });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur');
    } finally {
      setClaiming(null);
    }
  };

  if (!user) return null;

  const maxXp = bp?.tiers[bp.tiers.length - 1]?.xp ?? 15000;
  const currentTier = bp ? bp.tiers.filter(t => bp.bpXp >= t.xp).length : 0;

  return (
    <div className="min-h-screen" style={{ background: '#0a0a16' }}>
      <Navbar />
      <div className="pt-20 pb-12 px-4 max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full mb-3">
            {bp && <SeasonLabel season={bp.season} />}
          </div>
          <h1 className="text-4xl font-black text-white mb-2">Battle Pass</h1>
          <p className="text-gray-500 text-sm">Joue pour accumuler de l'XP et débloquer des récompenses</p>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-20">Chargement…</div>
        ) : !bp ? null : (
          <>
            {/* XP Progress */}
            <div className="rounded-2xl p-5 mb-6" style={{ background: '#0d0d1e', border: '1px solid #1e1e35' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-bold">Progression de la saison</span>
                <span className="text-purple-400 font-black">Palier {currentTier} / 30</span>
              </div>
              <XpBar current={bp.bpXp} max={maxXp} label="XP Battle Pass" />
              <p className="text-xs text-gray-600 mt-2">1 XP gagné pour chaque 10 F€ misés</p>
            </div>

            {/* Tiers grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {bp.tiers.map((t) => {
                const unlocked = bp.bpXp >= t.xp;
                const claimed = bp.claimedTiers.includes(t.tier);
                const isMilestone = MILESTONES.has(t.tier);
                const isClaiming = claiming === t.tier;

                return (
                  <div
                    key={t.tier}
                    className="rounded-xl p-4 transition-all"
                    style={{
                      background: claimed ? '#0a1a0a' : unlocked ? '#12102a' : '#0d0d1e',
                      border: `1px solid ${claimed ? '#16a34a' : isMilestone && unlocked ? '#a855f7' : '#1e1e35'}`,
                    }}
                  >
                    {/* Tier number */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-xs font-black px-2 py-0.5 rounded-md"
                        style={{
                          background: claimed ? '#16a34a20' : isMilestone ? '#a855f720' : '#ffffff10',
                          color: claimed ? '#4ade80' : isMilestone ? '#d8b4fe' : '#6b7280',
                        }}
                      >
                        {isMilestone ? '⭐ ' : ''}Palier {t.tier}
                      </span>
                      {claimed ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : !unlocked ? (
                        <Lock className="w-4 h-4 text-gray-600" />
                      ) : null}
                    </div>

                    {/* Reward */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <Trophy className={`w-4 h-4 ${isMilestone ? 'text-yellow-400' : 'text-gray-500'}`} />
                      <span className={`font-black text-sm ${isMilestone ? 'text-yellow-300' : unlocked ? 'text-white' : 'text-gray-500'}`}>
                        {formatBalance(t.reward)}
                      </span>
                    </div>

                    {/* XP requirement */}
                    <div className="mb-3">
                      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.round((bp.bpXp / t.xp) * 100))}%`,
                            background: claimed ? '#4ade80' : 'linear-gradient(90deg, #7c3aed, #ec4899)',
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{t.xp.toLocaleString('fr-FR')} XP requis</p>
                    </div>

                    {/* Button */}
                    {!claimed && unlocked && (
                      <button
                        onClick={() => claim(t.tier, t.reward)}
                        disabled={isClaiming}
                        className="w-full py-1.5 rounded-lg text-xs font-black transition-all"
                        style={{
                          background: isMilestone ? 'linear-gradient(135deg, #7c3aed, #ec4899)' : '#4c1d95',
                          color: '#fff',
                          opacity: isClaiming ? 0.7 : 1,
                        }}
                      >
                        {isClaiming ? '…' : 'Réclamer'}
                      </button>
                    )}
                    {claimed && (
                      <div className="w-full py-1.5 rounded-lg text-xs font-bold text-center text-green-400 bg-green-500/10">
                        Réclamé ✓
                      </div>
                    )}
                    {!claimed && !unlocked && (
                      <div className="w-full py-1.5 rounded-lg text-xs font-bold text-center text-gray-600">
                        {t.xp.toLocaleString('fr-FR')} XP
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
