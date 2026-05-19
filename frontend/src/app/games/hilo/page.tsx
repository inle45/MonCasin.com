'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import { sfx } from '@/lib/sfx';

const MISES = [10, 25, 50, 100, 250, 500, 1000];

type CardData = { v: number; s: string; name: string; red: boolean };
type Phase = 'idle' | 'playing' | 'win' | 'lose';

function PlayingCard({ card, size = 'lg' }: { card: CardData; size?: 'lg' | 'sm' }) {
  const big = size === 'lg';
  return (
    <div
      className={`rounded-xl flex flex-col items-center justify-center font-black select-none ${big ? 'w-28 h-40 text-5xl' : 'w-12 h-16 text-lg'}`}
      style={{
        background: 'linear-gradient(135deg,#1e1b4b,#2d2a5e)',
        border: `${big ? 3 : 2}px solid ${card.red ? '#ef4444' : 'rgba(245,158,11,0.5)'}`,
        boxShadow: big ? `0 0 24px ${card.red ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.25)'}` : 'none',
        color: card.red ? '#f87171' : '#f5f5f5',
      }}
    >
      <span>{card.name}</span>
      <span className={big ? 'text-2xl' : 'text-sm'}>{card.s}</span>
    </div>
  );
}

export default function HiloPage() {
  const { user, updateUser } = useAuth();
  const [mise, setMise] = useState(50);
  const [phase, setPhase] = useState<Phase>('idle');
  const [loading, setLoading] = useState(false);

  const [currentCard, setCurrentCard] = useState<CardData | null>(null);
  const [history, setHistory] = useState<CardData[]>([]);
  const [multHigh, setMultHigh] = useState<number | null>(null);
  const [multLow, setMultLow] = useState<number | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [gainPotentiel, setGainPotentiel] = useState(0);
  const [round, setRound] = useState(0);
  const [fin, setFin] = useState<{ win: boolean; gain: number; mult: number } | null>(null);

  const start = useCallback(async () => {
    if (loading || (user?.balance ?? 0) < mise) return;
    setLoading(true);
    sfx.click();
    try {
      const res = await api.post('/games/hilo/start', { amount: mise });
      const d = res.data;
      updateUser({ balance: d.newBalance });
      setCurrentCard(d.card);
      setHistory([]);
      setMultHigh(d.multHigh);
      setMultLow(d.multLow);
      setMultiplier(1);
      setGainPotentiel(mise);
      setRound(0);
      setFin(null);
      setPhase('playing');
      sfx.cardFlip();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Impossible de démarrer');
    }
    setLoading(false);
  }, [loading, user, mise, updateUser]);

  const guess = useCallback(async (direction: 'high' | 'low') => {
    if (phase !== 'playing' || loading || !currentCard) return;
    setLoading(true);
    sfx.cardFlip();
    try {
      const res = await api.post('/games/hilo/guess', { direction });
      const d = res.data;

      setHistory(prev => [...prev, currentCard]);
      setCurrentCard(d.card);

      if (!d.correct) {
        updateUser({ balance: d.newBalance });
        setPhase('lose');
        setFin({ win: false, gain: 0, mult: 0 });
        sfx.explosion();
      } else {
        setMultiplier(d.multiplier);
        setGainPotentiel(d.gainPotentiel);
        setMultHigh(d.multHigh);
        setMultLow(d.multLow);
        setRound(d.round);
        sfx.ping();

        if (d.autoWin) {
          updateUser({ balance: d.newBalance });
          setPhase('win');
          setFin({ win: true, gain: d.gainPotentiel, mult: d.multiplier });
          sfx.bigWin();
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur');
    }
    setLoading(false);
  }, [phase, loading, currentCard, updateUser]);

  const cashout = useCallback(async () => {
    if (phase !== 'playing' || round === 0 || loading) return;
    setLoading(true);
    sfx.cashout();
    try {
      const res = await api.post('/games/hilo/cashout');
      const d = res.data;
      updateUser({ balance: d.newBalance });
      setPhase('win');
      setFin({ win: true, gain: d.gain, mult: d.multiplier });
      sfx.win();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur cashout');
    }
    setLoading(false);
  }, [phase, round, loading, updateUser]);

  const reset = () => {
    setPhase('idle');
    setCurrentCard(null);
    setHistory([]);
    setFin(null);
    setRound(0);
    setMultiplier(1);
    setGainPotentiel(0);
  };

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-md mx-auto px-4 pt-20 pb-10 flex flex-col gap-4">

        <div className="text-center">
          <h1 className="text-3xl font-black text-casino-gold">🃏 Hi-Lo</h1>
          <p className="text-gray-400 text-sm">La prochaine carte sera-t-elle plus haute ou plus basse ?</p>
        </div>

        {/* Stats en jeu */}
        <div className="flex gap-3 justify-center">
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="text-xs text-gray-400">Multiplicateur</div>
            <motion.div key={multiplier} animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.3 }}
              className="text-2xl font-black text-casino-gold">×{multiplier}
            </motion.div>
          </div>
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="text-xs text-gray-400">Gain potentiel</div>
            <div className="text-lg font-black text-green-400">{formatBalance(gainPotentiel)}</div>
          </div>
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="text-xs text-gray-400">Cartes jouées</div>
            <div className="text-2xl font-black text-white">{round}</div>
          </div>
        </div>

        {/* Historique cartes */}
        <div className="flex gap-2 justify-center min-h-16 items-end flex-wrap">
          {history.slice(-6).map((c, i) => (
            <motion.div key={i} initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300 }}>
              <PlayingCard card={c} size="sm" />
            </motion.div>
          ))}
        </div>

        {/* Carte courante */}
        <div className="flex justify-center py-4">
          <AnimatePresence mode="wait">
            {currentCard ? (
              <motion.div key={`${currentCard.v}-${currentCard.s}`}
                initial={{ rotateY: 90, scale: 0.8 }} animate={{ rotateY: 0, scale: 1 }}
                exit={{ rotateY: -90, scale: 0.8 }} transition={{ duration: 0.25 }}>
                <PlayingCard card={currentCard} />
              </motion.div>
            ) : (
              <motion.div key="empty" className="w-28 h-40 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(30,27,75,0.4)', border: '3px dashed rgba(245,158,11,0.2)' }}>
                <span className="text-4xl text-gray-600">🃏</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Résultat */}
        <AnimatePresence>
          {fin && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="rounded-xl py-4 text-center"
              style={{
                background: fin.win ? 'linear-gradient(135deg,#14532d,#166534)' : 'linear-gradient(135deg,#7f1d1d,#991b1b)',
                border: fin.win ? '2px solid #22c55e' : '2px solid #ef4444',
              }}>
              {fin.win ? (
                <>
                  <div className="text-3xl font-black text-green-300">+{formatBalance(fin.gain)} 🎉</div>
                  <div className="text-sm text-gray-300 mt-1">×{fin.mult} — {round} cartes correctes</div>
                </>
              ) : (
                <>
                  <div className="text-3xl">💥 Mauvaise carte !</div>
                  <div className="text-sm text-red-300 mt-1">Mise perdue</div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Boutons Higher / Lower */}
        {phase === 'playing' && !fin && (
          <div className="flex gap-3">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => guess('high')} disabled={loading}
              className="flex-1 py-4 rounded-2xl font-black text-lg"
              style={{ background: 'linear-gradient(135deg,#14532d,#16a34a)', border: '2px solid #22c55e', boxShadow: '0 0 20px rgba(34,197,94,0.35)', color: '#fff' }}>
              ▲ PLUS HAUTE
              {multHigh && <div className="text-sm font-bold text-green-200 mt-0.5">×{multHigh}</div>}
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => guess('low')} disabled={loading}
              className="flex-1 py-4 rounded-2xl font-black text-lg"
              style={{ background: 'linear-gradient(135deg,#7f1d1d,#dc2626)', border: '2px solid #ef4444', boxShadow: '0 0 20px rgba(239,68,68,0.35)', color: '#fff' }}>
              ▼ PLUS BASSE
              {multLow && <div className="text-sm font-bold text-red-200 mt-0.5">×{multLow}</div>}
            </motion.button>
          </div>
        )}

        {/* Boutons action principaux */}
        {phase === 'idle' || fin ? (
          <motion.button whileTap={{ scale: 0.96 }} onClick={fin ? reset : start}
            disabled={loading || (!fin && (user?.balance ?? 0) < mise)}
            className="w-full py-4 rounded-2xl text-xl font-black"
            style={{ background: 'linear-gradient(135deg,#b45309,#f59e0b,#b45309)', color: '#000', boxShadow: '0 0 28px rgba(245,158,11,0.5)' }}>
            {fin ? '🔄 Rejouer' : `🃏 JOUER — ${formatBalance(mise)}`}
          </motion.button>
        ) : (
          <motion.button whileTap={{ scale: 0.96 }} onClick={cashout}
            disabled={round === 0 || loading}
            className="w-full py-3 rounded-2xl font-black transition-all"
            style={{
              background: round > 0 ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'rgba(30,27,75,0.6)',
              color: round > 0 ? '#fff' : '#4b5563',
              boxShadow: round > 0 ? '0 0 20px rgba(34,197,94,0.4)' : 'none',
            }}>
            {round === 0 ? 'Devine pour commencer' : `💰 CASHOUT — ${formatBalance(gainPotentiel)}`}
          </motion.button>
        )}

        {/* Mise (seulement avant le jeu) */}
        {(phase === 'idle' || !!fin) && (
          <div className="grid grid-cols-4 gap-2">
            {MISES.map(m => (
              <button key={m} onClick={() => setMise(m)}
                className="py-2 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: mise === m ? 'linear-gradient(135deg,#d97706,#f59e0b)' : 'rgba(30,27,75,0.7)',
                  color: mise === m ? '#000' : '#9ca3af',
                  border: mise === m ? '2px solid #fbbf24' : '1px solid rgba(245,158,11,0.15)',
                }}>
                {m} F€
              </button>
            ))}
          </div>
        )}

        <div className="text-center text-sm text-gray-400">
          Solde : <span className="text-casino-gold font-bold">{formatBalance(user?.balance ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}
