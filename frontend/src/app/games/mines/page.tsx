'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';

const MISES = [10, 25, 50, 100, 250, 500, 1000];
const MINES_OPTIONS = [1, 3, 5, 8, 10, 15, 20];

type CellState = 'hidden' | 'safe' | 'mine';

export default function MinesPage() {
  const { user, updateUser } = useAuth();
  const [mise, setMise] = useState(50);
  const [minesCount, setMinesCount] = useState(5);
  const [actif, setActif] = useState(false);
  const [cells, setCells] = useState<CellState[]>(Array(25).fill('hidden'));
  const [multiplicateur, setMultiplicateur] = useState(1);
  const [gainPotentiel, setGainPotentiel] = useState(0);
  const [loading, setLoading] = useState(false);
  const [minesReveled, setMinesReveled] = useState<number[]>([]);
  const [fin, setFin] = useState<'win' | 'mine' | null>(null);
  const [safeCount, setSafeCount] = useState(0);

  const demarrer = useCallback(async () => {
    if (loading || (user?.balance ?? 0) < mise) return;
    setLoading(true);
    try {
      const res = await api.post('/games/mines/start', { amount: mise, mines: minesCount });
      updateUser({ balance: res.data.newBalance });
      setCells(Array(25).fill('hidden'));
      setMultiplicateur(1);
      setGainPotentiel(mise);
      setMinesReveled([]);
      setFin(null);
      setSafeCount(0);
      setActif(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Impossible de démarrer la partie');
    }
    setLoading(false);
  }, [loading, user, mise, minesCount, updateUser]);

  const reveler = useCallback(async (index: number) => {
    if (!actif || cells[index] !== 'hidden' || loading) return;
    setLoading(true);
    try {
      const res = await api.post('/games/mines/reveal', { index });
      const data = res.data;

      if (data.mine) {
        const next = [...cells];
        next[index] = 'mine';
        data.mines?.forEach((i: number) => { if (next[i] === 'hidden') next[i] = 'mine'; });
        setCells(next);
        setMinesReveled(data.mines || []);
        setActif(false);
        setFin('mine');
        setMultiplicateur(0);
        setGainPotentiel(0);
      } else {
        const next = [...cells];
        next[index] = 'safe';
        setCells(next);
        setMultiplicateur(data.multiplicateur);
        setGainPotentiel(data.gainPotentiel);
        setSafeCount(data.safe);
        if (data.autoWin) {
          updateUser({ balance: data.newBalance });
          setActif(false);
          setFin('win');
          data.mines?.forEach((i: number) => { if (next[i] === 'hidden') next[i] = 'mine'; });
          setCells([...next]);
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur lors de la révélation');
    }
    setLoading(false);
  }, [actif, cells, loading, updateUser]);

  const encaisser = useCallback(async () => {
    if (!actif || safeCount === 0 || loading) return;
    setLoading(true);
    try {
      const res = await api.post('/games/mines/cashout');
      const data = res.data;
      updateUser({ balance: data.newBalance });
      const next = [...cells];
      data.mines?.forEach((i: number) => { if (next[i] === 'hidden') next[i] = 'mine'; });
      setCells(next);
      setActif(false);
      setFin('win');
      setMultiplicateur(data.multiplicateur);
      setGainPotentiel(data.gain);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur cashout');
    }
    setLoading(false);
  }, [actif, safeCount, loading, cells, updateUser]);

  const resetGame = () => {
    setActif(false);
    setCells(Array(25).fill('hidden'));
    setFin(null);
    setMultiplicateur(1);
    setGainPotentiel(0);
    setSafeCount(0);
    setMinesReveled([]);
  };

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-md mx-auto px-4 pt-20 pb-10 flex flex-col gap-4">

        <div className="text-center">
          <h1 className="text-3xl font-black text-casino-gold">💣 Mines</h1>
          <p className="text-gray-400 text-sm">Révèle des cases, évite les mines. Cashout avant d'exploser !</p>
        </div>

        {/* Stats en jeu */}
        <div className="flex gap-3 justify-center">
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="text-xs text-gray-400">Multiplicateur</div>
            <motion.div
              key={multiplicateur}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.3 }}
              className="text-2xl font-black text-casino-gold"
            >
              ×{multiplicateur}
            </motion.div>
          </div>
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="text-xs text-gray-400">Gain potentiel</div>
            <div className="text-lg font-black text-green-400">{formatBalance(gainPotentiel)}</div>
          </div>
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="text-xs text-gray-400">Mines</div>
            <div className="text-2xl font-black text-red-400">💣 {minesCount}</div>
          </div>
        </div>

        {/* Grille 5×5 */}
        <div className="grid grid-cols-5 gap-2">
          {cells.map((state, i) => (
            <motion.button
              key={i}
              whileHover={actif && state === 'hidden' ? { scale: 1.05, y: -2 } : {}}
              whileTap={actif && state === 'hidden' ? { scale: 0.93 } : {}}
              onClick={() => reveler(i)}
              disabled={!actif || state !== 'hidden' || loading}
              className="aspect-square rounded-xl flex items-center justify-center text-xl font-bold transition-all"
              style={{
                background:
                  state === 'mine' ? 'linear-gradient(135deg,#7f1d1d,#991b1b)' :
                  state === 'safe' ? 'linear-gradient(135deg,#14532d,#166534)' :
                  'linear-gradient(135deg,#1e1b4b,#2d2a5e)',
                border:
                  state === 'mine' ? '2px solid #ef4444' :
                  state === 'safe' ? '2px solid #22c55e' :
                  '1px solid rgba(245,158,11,0.2)',
                boxShadow:
                  state === 'safe' ? '0 0 12px rgba(34,197,94,0.4)' :
                  state === 'mine' ? '0 0 12px rgba(239,68,68,0.4)' : 'none',
                cursor: actif && state === 'hidden' ? 'pointer' : 'default',
              }}
            >
              <AnimatePresence mode="wait">
                {state === 'hidden' ? (
                  <motion.span key="h" exit={{ scale: 0, opacity: 0 }} className="text-gray-600 text-sm">◆</motion.span>
                ) : state === 'safe' ? (
                  <motion.span key="s" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>💎</motion.span>
                ) : (
                  <motion.span key="m" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200 }}>💣</motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>

        {/* Résultat final */}
        <AnimatePresence>
          {fin && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl py-4 text-center"
              style={{
                background: fin === 'win' ? 'linear-gradient(135deg,#14532d,#166534)' : 'linear-gradient(135deg,#7f1d1d,#991b1b)',
                border: fin === 'win' ? '2px solid #22c55e' : '2px solid #ef4444',
              }}
            >
              {fin === 'win' ? (
                <>
                  <div className="text-3xl font-black text-green-300">+{formatBalance(gainPotentiel)} 🎉</div>
                  <div className="text-sm text-gray-300 mt-1">×{multiplicateur} — {safeCount} cases révélées</div>
                </>
              ) : (
                <>
                  <div className="text-3xl">💥 BOOM !</div>
                  <div className="text-sm text-red-300 mt-1">Tu as touché une mine. Mise perdue.</div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Config avant partie */}
        {!actif && !fin && (
          <>
            {/* Nombre de mines */}
            <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div className="text-sm text-gray-400">Nombre de mines</div>
              <div className="flex gap-2 flex-wrap">
                {MINES_OPTIONS.map(m => (
                  <button
                    key={m}
                    onClick={() => setMinesCount(m)}
                    className="px-3 py-1.5 rounded-lg text-sm font-black transition-all"
                    style={{
                      background: minesCount === m ? '#dc2626' : 'rgba(255,255,255,0.05)',
                      color: minesCount === m ? '#fff' : '#9ca3af',
                      border: minesCount === m ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    💣 {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Mise */}
            <div className="grid grid-cols-4 gap-2">
              {MISES.map(m => (
                <button
                  key={m}
                  onClick={() => setMise(m)}
                  className="py-2 rounded-lg text-sm font-bold transition-all"
                  style={{
                    background: mise === m ? 'linear-gradient(135deg,#d97706,#f59e0b)' : 'rgba(30,27,75,0.7)',
                    color: mise === m ? '#000' : '#9ca3af',
                    border: mise === m ? '2px solid #fbbf24' : '1px solid rgba(245,158,11,0.15)',
                  }}
                >
                  {m} F€
                </button>
              ))}
            </div>
          </>
        )}

        {/* Boutons action */}
        {!actif ? (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={fin ? resetGame : demarrer}
            disabled={loading || (!fin && (user?.balance ?? 0) < mise)}
            className="w-full py-4 rounded-2xl text-xl font-black"
            style={{
              background: 'linear-gradient(135deg,#b45309,#f59e0b,#b45309)',
              color: '#000',
              boxShadow: '0 0 28px rgba(245,158,11,0.5)',
            }}
          >
            {fin ? '🔄 Rejouer' : `💣 JOUER — ${formatBalance(mise)}`}
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={encaisser}
            disabled={safeCount === 0 || loading}
            className="w-full py-4 rounded-2xl text-xl font-black transition-all"
            style={{
              background: safeCount > 0 ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'rgba(30,27,75,0.6)',
              color: safeCount > 0 ? '#fff' : '#4b5563',
              boxShadow: safeCount > 0 ? '0 0 24px rgba(34,197,94,0.5)' : 'none',
            }}
          >
            {safeCount === 0 ? 'Révèle une case pour commencer' : `💰 CASHOUT — ${formatBalance(gainPotentiel)}`}
          </motion.button>
        )}

        <div className="text-center text-sm text-gray-400">
          Solde : <span className="text-casino-gold font-bold">{formatBalance(user?.balance ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}
