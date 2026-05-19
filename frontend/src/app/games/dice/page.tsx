'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import { sfx } from '@/lib/sfx';
import toast from 'react-hot-toast';

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

  // Auto-bet
  const [autoMode, setAutoMode] = useState(false);
  const [autoCount, setAutoCount] = useState(10);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const [autoStats, setAutoStats] = useState({ wins: 0, losses: 0, profit: 0 });
  const autoStopRef = useRef(false);

  const mult = calcMult(pivot, mode);
  const prob = Math.round((mode === 'over'
    ? Object.entries(COMBOS).filter(([s]) => parseInt(s) > pivot).reduce((a,[,v]) => a+v, 0)
    : Object.entries(COMBOS).filter(([s]) => parseInt(s) < pivot).reduce((a,[,v]) => a+v, 0)
  ) / 36 * 100);

  const rollOnce = useCallback(async (currentMise: number, currentPivot: number, currentMode: 'over' | 'under'): Promise<{ newBalance: number; gagne: boolean; gain: number; de1: number; de2: number; total: number; multiplicateur: number } | null> => {
    const anim = setInterval(() => {
      setDisplayDice([Math.ceil(Math.random()*6), Math.ceil(Math.random()*6)]);
    }, 80);

    return new Promise((resolve) => {
      api.post('/games/dice/roll', { amount: currentMise, target: currentPivot, mode: currentMode })
        .then(res => {
          const data = res.data;
          setTimeout(() => {
            clearInterval(anim);
            setDisplayDice([data.de1, data.de2]);
            setResult(data);
            updateUser({ balance: data.newBalance });
            data.gagne ? sfx.win() : sfx.lose();
            resolve(data);
          }, 700);
        })
        .catch(() => {
          clearInterval(anim);
          resolve(null);
        });
    });
  }, [updateUser]);

  const roll = useCallback(async () => {
    if (rolling || !user || user.balance < mise) return;
    setRolling(true);
    setResult(null);
    sfx.click();

    if (autoMode && autoCount > 1) {
      autoStopRef.current = false;
      setAutoRemaining(autoCount);
      setAutoStats({ wins: 0, losses: 0, profit: 0 });

      let balance = user.balance;
      let wins = 0, losses = 0, profit = 0;

      for (let i = 0; i < autoCount; i++) {
        if (autoStopRef.current) break;
        if (balance < mise) { toast.error('Solde insuffisant — auto-bet arrêté'); break; }

        setAutoRemaining(autoCount - i);
        const data = await rollOnce(mise, pivot, mode);
        if (!data) break;

        balance = data.newBalance;
        if (data.gagne) { wins++; profit += data.gain - mise; }
        else { losses++; profit -= mise; }
        setAutoStats({ wins, losses, profit });

        if (i < autoCount - 1 && !autoStopRef.current) {
          await new Promise(r => setTimeout(r, 400));
        }
      }

      setAutoRemaining(0);
      toast.success(`Auto-bet terminé — ${wins}W / ${losses}L — ${profit >= 0 ? '+' : ''}${formatBalance(profit)}`);
    } else {
      const data = await rollOnce(mise, pivot, mode);
      if (!data) { setRolling(false); return; }
    }

    setRolling(false);
  }, [rolling, user, mise, pivot, mode, autoMode, autoCount, rollOnce]);

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

        {/* Auto-bet toggle */}
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'rgba(30,27,75,0.4)', border: '1px solid rgba(245,158,11,0.1)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-300">🤖 Auto-bet</span>
            <button
              onClick={() => setAutoMode(m => !m)}
              className="relative w-12 h-6 rounded-full transition-all"
              style={{ background: autoMode ? '#f59e0b' : 'rgba(255,255,255,0.1)' }}
            >
              <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                style={{ left: autoMode ? '26px' : '2px' }} />
            </button>
          </div>
          {autoMode && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">Nombre de paris</span>
              <div className="flex gap-1.5 flex-wrap flex-1 justify-end">
                {[5, 10, 25, 50, 100].map(n => (
                  <button key={n} onClick={() => setAutoCount(n)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                    style={{ background: autoCount === n ? '#f59e0b' : 'rgba(255,255,255,0.07)', color: autoCount === n ? '#000' : '#9ca3af' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          {autoMode && autoRemaining > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-indigo-400 animate-pulse">⚡ {autoRemaining} paris restants</span>
              <div className="flex gap-4 text-xs">
                <span className="text-green-400">✅ {autoStats.wins}W</span>
                <span className="text-red-400">❌ {autoStats.losses}L</span>
                <span className={autoStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {autoStats.profit >= 0 ? '+' : ''}{formatBalance(autoStats.profit)}
                </span>
              </div>
              <button onClick={() => { autoStopRef.current = true; }} className="text-xs text-red-400 font-bold hover:text-red-300">Stop</button>
            </div>
          )}
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
          {rolling && autoRemaining > 0 ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }}>🎲</motion.span>
              Auto {autoCount - autoRemaining + 1}/{autoCount}...
            </span>
          ) : rolling ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }}>🎲</motion.span>
              Lancer...
            </span>
          ) : autoMode && autoCount > 1 ? `🤖 AUTO x${autoCount} — ${formatBalance(mise * autoCount)}` : `🎲 LANCER — ${formatBalance(mise)}`}
        </motion.button>

        <div className="text-center text-sm text-gray-400">
          Solde : <span className="text-casino-gold font-bold">{formatBalance(user?.balance ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}
