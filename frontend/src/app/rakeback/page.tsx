'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import toast from 'react-hot-toast';
import { sfx } from '@/lib/sfx';

type RakebackState = {
  rakeback: number;
  canClaim: boolean;
  nextClaimAt: string | null;
};

function Countdown({ target }: { target: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(target).getTime() - Date.now()) / 1000));
      setSecs(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return <span className="font-mono text-casino-gold">{String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</span>;
}

export default function RakebackPage() {
  const { user, updateUser } = useAuth();
  const [state, setState] = useState<RakebackState | null>(null);
  const [claiming, setClaiming] = useState(false);

  const fetchState = useCallback(() => {
    api.get('/rakeback').then(r => setState(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchState(); }, [fetchState]);

  async function claim() {
    if (claiming || !state?.canClaim || (state?.rakeback ?? 0) < 1) return;
    setClaiming(true);
    try {
      const r = await api.post('/rakeback/claim');
      sfx.coin();
      toast.success(`💰 ${formatBalance(r.data.amount)} F€ récupérés !`);
      updateUser({ balance: r.data.newBalance });
      fetchState();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur');
    } finally {
      setClaiming(false);
    }
  }

  const pct = state ? Math.min(100, (state.rakeback / 5000) * 100) : 0;

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-20 pb-10 flex flex-col gap-5">

        <div className="text-center">
          <h1 className="text-3xl font-black text-casino-gold">💰 Rakeback</h1>
          <p className="text-gray-400 text-sm mt-1">5% de chaque perte accumulé — réclamable toutes les 24h</p>
        </div>

        {/* Carte principale */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-6"
          style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(34,197,94,0.08))', border: '2px solid rgba(245,158,11,0.25)' }}
        >
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-2 text-center">Rakeback disponible</div>
          <div className="text-5xl font-black text-casino-gold text-center" style={{ textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
            {state ? formatBalance(state.rakeback) : '—'}
            <span className="text-xl ml-1 text-yellow-600">F€</span>
          </div>

          {/* Barre de progression */}
          <div className="mt-4 bg-black/30 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg,#f59e0b,#22c55e)', width: `${pct}%` }}
              animate={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 text-right mt-1">{pct.toFixed(1)}% vers 5 000 F€</div>

          <div className="mt-5">
            {state?.canClaim ? (
              <button
                onClick={claim}
                disabled={claiming || (state?.rakeback ?? 0) < 1}
                className="w-full py-3.5 rounded-xl font-black text-black text-base transition-all disabled:opacity-50 active:scale-95"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', boxShadow: '0 0 20px rgba(245,158,11,0.4)' }}
              >
                {claiming ? 'Réclamation...' : state && state.rakeback >= 1 ? `Réclamer ${formatBalance(Math.floor(state.rakeback))} F€` : 'Aucun rakeback (min 1 F€)'}
              </button>
            ) : (
              <div className="text-center py-3">
                <div className="text-gray-400 text-sm mb-1">Prochain rakeback dans</div>
                {state?.nextClaimAt && <Countdown target={state.nextClaimAt} />}
              </div>
            )}
          </div>
        </motion.div>

        {/* Explication */}
        <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: 'rgba(30,27,75,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-sm font-bold text-white">Comment ça marche ?</div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">💸</span>
            <div className="text-sm text-gray-400">Chaque fois que tu perds, <span className="text-casino-gold font-bold">5% de ta mise</span> est mis de côté dans ton rakeback.</div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">⏰</span>
            <div className="text-sm text-gray-400">Tu peux réclamer ton rakeback accumulé <span className="text-casino-gold font-bold">une fois toutes les 24h</span>.</div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🎮</span>
            <div className="text-sm text-gray-400">Valable sur tous les jeux : Crash, Roulette, Mines, HiLo et Limbo.</div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="text-sm text-gray-400">Plus tu joues, plus ton rakeback grandit — même si tu perds, tu récupères toujours quelque chose.</div>
          </div>
        </div>

        <div className="text-center text-xs text-gray-600">
          Solde actuel : <span className="text-casino-gold font-bold">{formatBalance(user?.balance ?? 0)} F€</span>
        </div>
      </div>
    </div>
  );
}
