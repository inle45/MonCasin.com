'use client';

'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import toast from 'react-hot-toast';
import { sfx } from '@/lib/sfx';

const QUICK_TARGETS = [1.5, 2, 3, 5, 10, 25, 100, 1000];

function winChance(target: number) {
  return Math.min(99, (0.97 / target) * 100).toFixed(2);
}

export default function LimboPage() {
  const { user, updateUser } = useAuth();
  const [bet, setBet] = useState('100');
  const [target, setTarget] = useState('2.00');
  const [result, setResult] = useState<number | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [playing, setPlaying] = useState(false);
  const [history, setHistory] = useState<{ result: number; target: number; won: boolean; payout: number }[]>([]);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [displayNum, setDisplayNum] = useState<number | null>(null);

  const betVal = parseFloat(bet) || 0;
  const targetVal = parseFloat(target) || 2;
  const payout = betVal * targetVal;

  // Auto-bet
  const [autoMode, setAutoMode] = useState(false);
  const [autoCount, setAutoCount] = useState(10);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const [autoStats, setAutoStats] = useState({ wins: 0, losses: 0, profit: 0 });
  const autoStopRef = useRef(false);

  async function playOnce(bv: number, tv: number): Promise<{ result: number; won: boolean; payout: number; newBalance: number } | null> {
    let t = 1.01;
    animRef.current = setInterval(() => {
      t = t * 1.08 + 0.05;
      setDisplayNum(parseFloat(t.toFixed(2)));
    }, 40);
    setResult(null);
    setWon(null);

    try {
      const r = await api.post('/games/limbo/play', { bet: bv, target: tv });
      clearInterval(animRef.current!);
      const { result: res, won: w, payout: pay, newBalance } = r.data;
      setDisplayNum(res);
      setResult(res);
      setWon(w);
      updateUser({ balance: newBalance });
      w ? sfx.win() : sfx.lose();
      setHistory(prev => [{ result: res, target: tv, won: w, payout: pay }, ...prev].slice(0, 20));
      return { result: res, won: w, payout: pay, newBalance };
    } catch {
      clearInterval(animRef.current!);
      return null;
    }
  }

  async function play() {
    if (playing || betVal <= 0 || targetVal < 1.01) return;
    if ((user?.balance ?? 0) < betVal) { toast.error('Solde insuffisant'); return; }

    setPlaying(true);

    if (autoMode && autoCount > 1) {
      autoStopRef.current = false;
      setAutoRemaining(autoCount);
      setAutoStats({ wins: 0, losses: 0, profit: 0 });

      let balance = user?.balance ?? 0;
      let wins = 0, losses = 0, profit = 0;

      for (let i = 0; i < autoCount; i++) {
        if (autoStopRef.current) break;
        if (balance < betVal) { toast.error('Solde insuffisant — auto-bet arrêté'); break; }
        setAutoRemaining(autoCount - i);
        const data = await playOnce(betVal, targetVal);
        if (!data) break;
        balance = data.newBalance;
        if (data.won) { wins++; profit += data.payout - betVal; }
        else { losses++; profit -= betVal; }
        setAutoStats({ wins, losses, profit });
        if (i < autoCount - 1 && !autoStopRef.current) await new Promise(r => setTimeout(r, 350));
      }

      setAutoRemaining(0);
      toast.success(`Auto-bet terminé — ${wins}W / ${losses}L — ${profit >= 0 ? '+' : ''}${formatBalance(profit)}`);
    } else {
      const data = await playOnce(betVal, targetVal);
      if (data) {
        if (data.won) toast.success(`🌙 x${data.result} — +${formatBalance(data.payout)} F€ !`);
        else toast.error(`💥 x${data.result} — Raté (visais x${targetVal})`);
      }
    }

    setPlaying(false);
  }

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-20 pb-10 flex flex-col gap-5">

        <div className="text-center">
          <h1 className="text-3xl font-black text-casino-gold">🌙 Limbo</h1>
          <p className="text-gray-400 text-sm mt-1">Choisis ta cible — plus elle est haute, plus tu risques</p>
        </div>

        {/* Résultat central */}
        <div
          className="rounded-2xl flex items-center justify-center py-12 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(192,132,252,0.1))', border: '2px solid rgba(99,102,241,0.3)' }}
        >
          <AnimatePresence mode="wait">
            {displayNum !== null ? (
              <motion.div
                key={displayNum}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <div
                  className="text-7xl font-black"
                  style={{ color: won === null ? '#818cf8' : won ? '#22c55e' : '#ef4444', textShadow: `0 0 40px ${won === null ? '#818cf8' : won ? '#22c55e' : '#ef4444'}80` }}
                >
                  {displayNum.toFixed(2)}x
                </div>
                {result !== null && (
                  <div className={`text-lg font-bold mt-2 ${won ? 'text-green-400' : 'text-red-400'}`}>
                    {won ? `+${formatBalance(betVal * targetVal)} F€` : `-${formatBalance(betVal)} F€`}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="idle" className="text-6xl font-black text-indigo-400/40">
                🌙
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Contrôles */}
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(99,102,241,0.2)' }}>

          {/* Mise */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Mise</label>
            <div className="flex gap-2 mt-1">
              <input
                type="number"
                value={bet}
                onChange={e => setBet(e.target.value)}
                className="flex-1 bg-black/30 border border-indigo-500/30 rounded-xl px-4 py-2.5 text-white text-lg font-bold focus:outline-none focus:border-indigo-400"
                min="1"
              />
              <button onClick={() => setBet(String(Math.floor(betVal / 2)))} className="px-3 py-2 rounded-xl bg-indigo-500/20 text-indigo-300 text-sm font-bold hover:bg-indigo-500/30">½</button>
              <button onClick={() => setBet(String(Math.floor(betVal * 2)))} className="px-3 py-2 rounded-xl bg-indigo-500/20 text-indigo-300 text-sm font-bold hover:bg-indigo-500/30">2×</button>
            </div>
          </div>

          {/* Cible */}
          <div>
            <div className="flex justify-between items-center">
              <label className="text-xs text-gray-400 uppercase tracking-wider">Cible</label>
              <span className="text-xs text-indigo-400">{winChance(targetVal)}% de chance</span>
            </div>
            <input
              type="number"
              value={target}
              onChange={e => setTarget(e.target.value)}
              className="w-full bg-black/30 border border-indigo-500/30 rounded-xl px-4 py-2.5 text-white text-lg font-bold mt-1 focus:outline-none focus:border-indigo-400"
              min="1.01"
              step="0.01"
            />
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {QUICK_TARGETS.map(t => (
                <button
                  key={t}
                  onClick={() => setTarget(String(t))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${parseFloat(target) === t ? 'bg-indigo-500 text-white' : 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/30'}`}
                >
                  x{t}
                </button>
              ))}
            </div>
          </div>

          {/* Info gain potentiel */}
          <div className="flex justify-between text-sm text-gray-400 border-t border-white/5 pt-3">
            <span>Gain potentiel</span>
            <span className="text-green-400 font-bold">{formatBalance(payout)} F€</span>
          </div>

          {/* Auto-bet */}
          <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-300">🤖 Auto-bet</span>
              <button onClick={() => setAutoMode(m => !m)}
                className="relative w-11 h-5.5 rounded-full transition-all flex-shrink-0"
                style={{ background: autoMode ? '#6366f1' : 'rgba(255,255,255,0.1)', width: 44, height: 24 }}>
                <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  style={{ left: autoMode ? '22px' : '2px' }} />
              </button>
            </div>
            {autoMode && (
              <div className="flex gap-1.5 flex-wrap">
                {[5, 10, 25, 50, 100].map(n => (
                  <button key={n} onClick={() => setAutoCount(n)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold"
                    style={{ background: autoCount === n ? '#6366f1' : 'rgba(255,255,255,0.07)', color: autoCount === n ? '#fff' : '#9ca3af' }}>
                    {n}×
                  </button>
                ))}
              </div>
            )}
            {autoMode && autoRemaining > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-indigo-400 animate-pulse">⚡ {autoRemaining} restants</span>
                <div className="flex gap-3">
                  <span className="text-green-400">{autoStats.wins}W</span>
                  <span className="text-red-400">{autoStats.losses}L</span>
                  <span className={autoStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {autoStats.profit >= 0 ? '+' : ''}{formatBalance(autoStats.profit)}
                  </span>
                </div>
                <button onClick={() => { autoStopRef.current = true; }} className="text-red-400 font-bold">Stop</button>
              </div>
            )}
          </div>

          <button
            onClick={play}
            disabled={playing || betVal <= 0 || targetVal < 1.01}
            className="w-full py-4 rounded-xl font-black text-lg text-white transition-all disabled:opacity-50 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 25px rgba(99,102,241,0.4)' }}
          >
            {playing && autoRemaining > 0
              ? `🤖 Auto ${autoCount - autoRemaining + 1}/${autoCount}...`
              : playing ? '🌙 Vol en cours...'
              : autoMode && autoCount > 1 ? `🤖 AUTO x${autoCount}`
              : 'Lancer'
            }
          </button>
        </div>

        {/* Historique */}
        {history.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider px-1 mb-2">Historique</div>
            <div className="flex flex-col gap-1.5">
              {history.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                  style={{ background: 'rgba(30,27,75,0.4)', border: `1px solid ${h.won ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'}` }}
                >
                  <span className="text-lg">{h.won ? '✅' : '❌'}</span>
                  <span className="font-black" style={{ color: h.won ? '#22c55e' : '#ef4444' }}>x{h.result.toFixed(2)}</span>
                  <span className="text-gray-500 text-xs">visait x{h.target}</span>
                  <span className={`ml-auto font-bold text-sm ${h.won ? 'text-green-400' : 'text-red-400'}`}>
                    {h.won ? `+${formatBalance(h.payout)}` : `-${formatBalance(h.payout / h.target)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
