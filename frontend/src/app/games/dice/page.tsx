'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';

const MISES = [10, 25, 50, 100, 250, 500, 1000];
// Nombre de combinaisons par total (2 dés)
const COMBOS: Record<number, number> = {2:1,3:2,4:3,5:4,6:5,7:6,8:5,9:4,10:3,11:2,12:1};

function calcMult(pivot: number, mode: 'over' | 'under') {
  let wins = 0;
  for (let s = 2; s <= 12; s++) {
    if (mode === 'over' ? s > pivot : s < pivot) wins += COMBOS[s];
  }
  const prob = wins / 36;
  return prob > 0 ? Math.round((0.97 / prob) * 100) / 100 : 0;
}

function DeFace({ value }: { value: number }) {
  const DOTS: Record<number, [number,number][]> = {
    1: [[50,50]],
    2: [[25,25],[75,75]],
    3: [[25,25],[50,50],[75,75]],
    4: [[25,25],[75,25],[25,75],[75,75]],
    5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
    6: [[25,20],[75,20],[25,50],[75,50],[25,80],[75,80]],
  };
  const dots = DOTS[value] || [];
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <rect x="2" y="2" width="96" height="96" rx="18" fill="#1e1b4b" stroke="#f59e0b" strokeWidth="3"/>
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" fill="#fbbf24"/>
      ))}
    </svg>
  );
}

export default function DicePage() {
  const { user, updateUser } = useAuth();
  const [mise, setMise] = useState(50);
  const [pivot, setPivot] = useState(7);
  const [mode, setMode] = useState<'over' | 'under'>('over');
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<{ de1:number; de2:number; total:number; gagne:boolean; gain:number; multiplicateur:number } | null>(null);
  const [displayDice, setDisplayDice] = useState<[number,number]>([1,1]);

  const mult = calcMult(pivot, mode);
  const prob = Math.round((mode === 'over'
    ? Object.entries(COMBOS).filter(([s]) => parseInt(s) > pivot).reduce((a,[,v]) => a+v, 0)
    : Object.entries(COMBOS).filter(([s]) => parseInt(s) < pivot).reduce((a,[,v]) => a+v, 0)
  ) / 36 * 100);

  const roll = useCallback(async () => {
    if (rolling || !user || user.balance < mise) return;
    setRolling(true);
    setResult(null);

    // Animation des dés
    let ticks = 0;
    const anim = setInterval(() => {
      setDisplayDice([Math.ceil(Math.random()*6), Math.ceil(Math.random()*6)]);
      if (++ticks > 12) clearInterval(anim);
    }, 80);

    try {
      const res = await api.post('/games/dice/roll', { amount: mise, target: pivot, mode });
      const data = res.data;
      setTimeout(() => {
        clearInterval(anim);
        setDisplayDice([data.de1, data.de2]);
        setResult(data);
        updateUser({ balance: data.newBalance });
        setRolling(false);
      }, 1050);
    } catch {
      clearInterval(anim);
      setRolling(false);
    }
  }, [rolling, user, mise, pivot, mode, updateUser]);

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-md mx-auto px-4 pt-20 pb-10 flex flex-col gap-5">

        <div className="text-center">
          <h1 className="text-3xl font-black text-casino-gold">🎲 Dice</h1>
          <p className="text-gray-400 text-sm">Lance 2 dés et parie sur le résultat</p>
        </div>

        {/* Dés */}
        <div className="flex justify-center gap-6 py-6">
          {[displayDice[0], displayDice[1]].map((val, i) => (
            <motion.div
              key={i}
              animate={rolling ? { rotate: [0, 180, 360], scale: [1, 1.15, 1] } : { rotate: 0 }}
              transition={rolling ? { duration: 0.35, repeat: Infinity } : { duration: 0.3 }}
              className="w-20 h-20 drop-shadow-xl"
            >
              <DeFace value={val} />
            </motion.div>
          ))}
        </div>

        {/* Résultat */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key={result.total}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl py-4 text-center"
              style={{
                background: result.gagne ? 'linear-gradient(135deg,#14532d,#166534)' : 'linear-gradient(135deg,#7f1d1d,#991b1b)',
                border: result.gagne ? '2px solid #22c55e' : '2px solid #ef4444',
              }}
            >
              <div className="text-4xl font-black">{result.total}</div>
              <div className={`text-lg font-bold mt-1 ${result.gagne ? 'text-green-300' : 'text-red-300'}`}>
                {result.gagne ? `+${formatBalance(result.gain)} 🎉` : `−${formatBalance(mise)} 💸`}
              </div>
              {result.gagne && (
                <div className="text-xs text-gray-400 mt-0.5">×{result.multiplicateur}</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Config — pivot */}
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Cible</span>
            <div className="flex gap-2 items-center">
              {[3,4,5,6,7,8,9,10,11].map(n => (
                <button
                  key={n}
                  onClick={() => setPivot(n)}
                  className="w-8 h-8 rounded-lg text-sm font-black transition-all"
                  style={{
                    background: pivot === n ? '#f59e0b' : 'rgba(255,255,255,0.05)',
                    color: pivot === n ? '#000' : '#9ca3af',
                    border: pivot === n ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            {(['over','under'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 py-2 rounded-lg font-black text-sm transition-all"
                style={{
                  background: mode === m ? (m === 'over' ? '#16a34a' : '#dc2626') : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  border: mode === m ? `2px solid ${m === 'over' ? '#22c55e' : '#ef4444'}` : '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {m === 'over' ? `▲ Supérieur à ${pivot}` : `▼ Inférieur à ${pivot}`}
              </button>
            ))}
          </div>

          <div className="flex justify-between text-xs text-gray-400 px-1">
            <span>Probabilité : <span className="text-white font-bold">{prob}%</span></span>
            <span>Multiplicateur : <span className="text-casino-gold font-black">×{mult}</span></span>
            <span>Gain potentiel : <span className="text-green-400 font-bold">{formatBalance(Math.round(mise * mult))}</span></span>
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

        {/* Bouton lancer */}
        <motion.button
          whileTap={!rolling ? { scale: 0.96 } : {}}
          onClick={roll}
          disabled={rolling || (user?.balance ?? 0) < mise}
          className="w-full py-4 rounded-2xl text-xl font-black transition-all"
          style={{
            background: rolling ? 'rgba(20,20,40,0.8)' : 'linear-gradient(135deg,#b45309,#f59e0b,#b45309)',
            color: rolling ? '#4b5563' : '#000',
            boxShadow: rolling ? 'none' : '0 0 28px rgba(245,158,11,0.55)',
            cursor: rolling ? 'not-allowed' : 'pointer',
          }}
        >
          {rolling ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }}>🎲</motion.span>
              Lancer...
            </span>
          ) : `🎲 LANCER — ${formatBalance(mise)}`}
        </motion.button>

        <div className="text-center text-sm text-gray-400">
          Solde : <span className="text-casino-gold font-bold">{formatBalance(user?.balance ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}
