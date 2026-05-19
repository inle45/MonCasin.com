'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import toast from 'react-hot-toast';
import { sfx } from '@/lib/sfx';
import BigWinOverlay from '@/components/games/BigWinOverlay';

type Risk = 'low' | 'medium' | 'high';
type Rows = 8 | 12 | 16;

const MULTIPLIERS: Record<Risk, Record<number, number[]>> = {
  low: {
    8:  [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    12: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8:  [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    16: [110, 41, 10, 5, 3, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8:  [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [100, 41, 10, 5, 3, 1.5, 0.2, 1.5, 3, 5, 10, 41, 100],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

function multColor(m: number) {
  if (m >= 10) return '#f59e0b';
  if (m >= 2) return '#22c55e';
  if (m >= 1) return '#60a5fa';
  return '#6b7280';
}

function PlinkoBoard({ rows, path, animStep, bucket }: { rows: number; path: number[] | null; animStep: number; bucket: number | null }) {
  const pegs: { row: number; col: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= r; c++) pegs.push({ row: r, col: c });
  }

  const W = 320;
  const H = 260;
  const pegR = rows === 16 ? 4 : rows === 12 ? 5 : 6;
  const rowH = H / (rows + 1);

  function pegX(row: number, col: number) {
    const spacing = W / (row + 2);
    return spacing * (col + 1);
  }
  function pegY(row: number) { return rowH * (row + 1); }

  // Position balle selon l'étape d'animation
  let ballX = W / 2, ballY = -10;
  if (path && animStep > 0) {
    const r = Math.min(animStep - 1, rows - 1);
    const c = path.slice(0, r + 1).reduce((a, b) => a + b, 0);
    if (animStep > rows) {
      // Balle dans le bucket
      ballY = H + 10;
      ballX = pegX(rows - 1, c);
    } else {
      ballX = pegX(r, c);
      ballY = pegY(r);
    }
  }

  return (
    <svg width={W} height={H + 20} viewBox={`0 0 ${W} ${H + 20}`} className="mx-auto">
      {pegs.map(({ row, col }) => {
        const isOnPath = path && animStep > row && col === path.slice(0, row + 1).reduce((a, b) => a + b, 0);
        return (
          <circle
            key={`${row}-${col}`}
            cx={pegX(row, col)}
            cy={pegY(row)}
            r={pegR}
            fill={isOnPath ? '#f59e0b' : '#334155'}
          />
        );
      })}
      {path && animStep > 0 && (
        <motion.circle
          cx={ballX}
          cy={ballY}
          r={pegR + 3}
          fill="#f59e0b"
          animate={{ cx: ballX, cy: ballY }}
          transition={{ duration: 0.15, ease: 'easeInOut' }}
        />
      )}
    </svg>
  );
}

export default function PlinkoPage() {
  const { user, updateUser } = useAuth();
  const [bet, setBet] = useState('100');
  const [risk, setRisk] = useState<Risk>('medium');
  const [rows, setRows] = useState<Rows>(8);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<{ path: number[]; bucket: number; multiplier: number; payout: number } | null>(null);
  const [animStep, setAnimStep] = useState(0);
  const [history, setHistory] = useState<{ multiplier: number; payout: number; bet: number }[]>([]);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const betVal = parseFloat(bet) || 0;
  const mults = MULTIPLIERS[risk][rows];

  const [bigWin, setBigWin] = useState<{ montant: number; multiplicateur: number } | null>(null);

  // Auto-bet
  const [autoMode, setAutoMode] = useState(false);
  const [autoCount, setAutoCount] = useState(10);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const [autoStats, setAutoStats] = useState({ wins: 0, losses: 0, profit: 0 });
  const autoStopRef = useRef(false);

  async function playOnce(bv: number, r: Risk, rowCount: Rows): Promise<{ multiplier: number; payout: number; newBalance: number } | null> {
    setResult(null);
    setAnimStep(0);
    try {
      const res = await api.post('/games/plinko/play', { bet: bv, risk: r, rows: rowCount });
      const data = res.data;
      setResult(data);
      updateUser({ balance: data.newBalance });

      return new Promise(resolve => {
        let step = 0;
        animRef.current = setInterval(() => {
          step++;
          setAnimStep(step);
          if (step <= rowCount) sfx.tick(0.3);
          if (step > rowCount + 1) {
          clearInterval(animRef.current!);
          if (data.multiplier >= 1) {
            sfx.win();
            if (data.multiplier >= 5) { sfx.bigWin(); setBigWin({ montant: data.payout, multiplicateur: data.multiplier }); }
          } else { sfx.lose(); }
          setHistory(prev => [{ multiplier: data.multiplier, payout: data.payout, bet: bv }, ...prev].slice(0, 15));
            resolve(data);
          }
        }, 100);
      });
    } catch {
      return null;
    }
  }

  async function play() {
    if (playing || betVal <= 0) return;
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
        const data = await playOnce(betVal, risk, rows);
        if (!data) break;
        balance = data.newBalance;
        if (data.multiplier >= 1) { wins++; profit += data.payout - betVal; }
        else { losses++; profit -= betVal; }
        setAutoStats({ wins, losses, profit });
        if (i < autoCount - 1 && !autoStopRef.current) await new Promise(r => setTimeout(r, 200));
      }

      setAutoRemaining(0);
      toast.success(`Auto-bet terminé — ${wins}W / ${losses}L — ${profit >= 0 ? '+' : ''}${formatBalance(profit)}`);
    } else {
      const data = await playOnce(betVal, risk, rows);
      if (data) {
        data.multiplier >= 1
          ? toast.success(`🪙 x${data.multiplier} — +${formatBalance(data.payout)} F€`)
          : toast.error(`💥 x${data.multiplier}`);
      }
    }

    setPlaying(false);
  }

  useEffect(() => () => { if (animRef.current) clearInterval(animRef.current); }, []);

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <BigWinOverlay visible={!!bigWin} montant={bigWin?.montant ?? 0} multiplicateur={bigWin?.multiplicateur ?? 0} onClose={() => setBigWin(null)} />
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-20 pb-10 flex flex-col gap-4">

        <div className="text-center">
          <h1 className="text-3xl font-black text-casino-gold">🪙 Plinko</h1>
          <p className="text-gray-400 text-sm mt-1">Lâche la balle, regarde-la rebondir</p>
        </div>

        {/* Board */}
        <div className="rounded-2xl py-4 overflow-hidden" style={{ background: 'rgba(15,15,30,0.8)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <PlinkoBoard rows={rows} path={result?.path ?? null} animStep={animStep} bucket={result?.bucket ?? null} />

          {/* Multiplicateurs */}
          <div className="flex px-2 mt-2 gap-0.5">
            {mults.map((m, i) => (
              <div
                key={i}
                className="flex-1 text-center text-xs font-black py-1 rounded transition-all"
                style={{
                  background: result && result.bucket === i && animStep > rows
                    ? `${multColor(m)}33`
                    : 'rgba(0,0,0,0.3)',
                  color: multColor(m),
                  border: result && result.bucket === i && animStep > rows
                    ? `1px solid ${multColor(m)}`
                    : '1px solid transparent',
                  fontSize: mults.length > 12 ? '9px' : '11px',
                }}
              >
                {m}x
              </div>
            ))}
          </div>
        </div>

        {/* Contrôles */}
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Mise</label>
            <div className="flex gap-2 mt-1">
              <input
                type="number"
                value={bet}
                onChange={e => setBet(e.target.value)}
                className="flex-1 bg-black/30 border border-indigo-500/30 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:border-indigo-400"
                min="1"
              />
              <button onClick={() => setBet(String(Math.floor(betVal / 2)))} className="px-3 py-2 rounded-xl bg-indigo-500/20 text-indigo-300 text-sm font-bold">½</button>
              <button onClick={() => setBet(String(betVal * 2))} className="px-3 py-2 rounded-xl bg-indigo-500/20 text-indigo-300 text-sm font-bold">2×</button>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-400 uppercase tracking-wider">Risque</label>
              <div className="flex gap-1 mt-1">
                {(['low', 'medium', 'high'] as Risk[]).map(r => (
                  <button key={r} onClick={() => setRisk(r)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${risk === r ? 'bg-indigo-500 text-white' : 'bg-indigo-500/15 text-indigo-300'}`}>
                    {r === 'low' ? 'Bas' : r === 'medium' ? 'Moyen' : 'Élevé'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 uppercase tracking-wider">Lignes</label>
              <div className="flex gap-1 mt-1">
                {([8, 12, 16] as Rows[]).map(r => (
                  <button key={r} onClick={() => setRows(r)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${rows === r ? 'bg-indigo-500 text-white' : 'bg-indigo-500/15 text-indigo-300'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Auto-bet */}
          <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-300">🤖 Auto-bet</span>
              <button onClick={() => setAutoMode(m => !m)}
                style={{ background: autoMode ? '#6366f1' : 'rgba(255,255,255,0.1)', width: 44, height: 24, borderRadius: 12, position: 'relative', transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: 2, left: autoMode ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
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
            disabled={playing || betVal <= 0}
            className="w-full py-3.5 rounded-xl font-black text-white disabled:opacity-50 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.35)' }}
          >
            {playing && autoRemaining > 0
              ? `🤖 Auto ${autoCount - autoRemaining + 1}/${autoCount}...`
              : playing ? '🪙 En vol...'
              : autoMode && autoCount > 1 ? `🤖 AUTO x${autoCount}`
              : 'Lancer'
            }
          </button>
        </div>

        {/* Historique */}
        {history.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {history.map((h, i) => (
              <div key={i} className="px-2.5 py-1 rounded-lg text-xs font-black"
                style={{ background: `${multColor(h.multiplier)}22`, color: multColor(h.multiplier), border: `1px solid ${multColor(h.multiplier)}44` }}>
                x{h.multiplier}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
