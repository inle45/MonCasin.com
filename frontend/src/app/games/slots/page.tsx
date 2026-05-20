'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import BigWinOverlay from '@/components/games/BigWinOverlay';
import WheelOfFortune from '@/components/games/WheelOfFortune';
import ChestGame from '@/components/games/ChestGame';

// ── Symbol definitions ───────────────────────────────────────────────────────
const SYMS: Record<string, { emoji: string; label: string; bg: string; glow: string; tier: number }> = {
  TEN:     { emoji: '🔟', label: '10',    bg: 'linear-gradient(160deg,#1e293b,#0f172a)', glow: '#64748b', tier: 1 },
  JACK:    { emoji: '🃏', label: 'J',     bg: 'linear-gradient(160deg,#14532d,#052e16)', glow: '#22c55e', tier: 1 },
  QUEEN:   { emoji: '♛',  label: 'Q',     bg: 'linear-gradient(160deg,#4c1d95,#2e1065)', glow: '#8b5cf6', tier: 2 },
  KING:    { emoji: '♚',  label: 'K',     bg: 'linear-gradient(160deg,#1e3a8a,#1e1b4b)', glow: '#3b82f6', tier: 2 },
  ACE:     { emoji: '🅰️', label: 'A',     bg: 'linear-gradient(160deg,#7c2d12,#431407)', glow: '#f97316', tier: 3 },
  CROWN:   { emoji: '👑', label: 'Crown', bg: 'linear-gradient(160deg,#854d0e,#422006)', glow: '#f59e0b', tier: 3 },
  DIAMOND: { emoji: '💎', label: 'Gem',   bg: 'linear-gradient(160deg,#0c4a6e,#082f49)', glow: '#06b6d4', tier: 4 },
  WILD:    { emoji: '🌟', label: 'WILD',  bg: 'linear-gradient(160deg,#78350f,#451a03)', glow: '#fbbf24', tier: 5 },
  SCATTER: { emoji: '⭐', label: 'SCAT',  bg: 'linear-gradient(160deg,#701a75,#3b0764)', glow: '#e879f9', tier: 5 },
};
const ALL_SYMS = Object.keys(SYMS);

const MISES = [1, 5, 10, 25, 50, 100, 250, 500];

// 20 paylines (each is [row for col0, row for col1, ..., row for col4])
const PAYLINES = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,0,1,0],
  [2,1,2,1,2],[1,0,1,0,1],[1,2,1,2,1],[0,0,0,1,2],[2,2,2,1,0],
  [0,1,1,1,2],[2,1,1,1,0],[1,1,0,1,1],[1,1,2,1,1],[0,2,1,0,2],
];
const LINE_COLORS = [
  '#ef4444','#3b82f6','#22c55e','#f59e0b','#8b5cf6',
  '#06b6d4','#ec4899','#10b981','#f97316','#a855f7',
  '#14b8a6','#eab308','#94a3b8','#84cc16','#6366f1',
  '#e11d48','#0ea5e9','#16a34a','#b45309','#7c3aed',
];

// SVG payline grid coords (% of grid area, 5 cols × 3 rows with gap-1.5)
const COL_X = [9.5, 30, 50, 70, 90.5];
const ROW_Y = [16, 50, 84];

function emptyGrid(): string[][] {
  return Array.from({ length: 5 }, () => ['TEN', 'TEN', 'TEN']);
}

// ── Types ────────────────────────────────────────────────────────────────────
interface WinLine { indexLigne: number; symbole: string; count: number; multiplicateur: number; }
interface SpinResult {
  grille: string[][]; gainTotal: number; lignesGagnantes: WinLine[];
  multiplicateurTotal: number; scatters: number;
  bonus: { type: 'FREE_SPINS' | 'WHEEL_OF_FORTUNE' | 'CHEST_GAME'; freespins?: number } | null;
  jackpotWin: boolean; gagne: boolean; bigWin: boolean; estFreeSpin: boolean;
  spinsRestants?: number; multiplicateurFreeSpin?: number; gainTotalFreeSpins?: number;
  freeSpinsTermines?: boolean; newBalance: number; jackpot: number;
}
interface WheelResult { multiplicateur: number; gain: number; newBalance: number; }
interface ChestResult {
  estAlarme: boolean; valeur: number; item: string | null; indexCoffre: number;
  gainTotal: number; termine: boolean;
  coffres: Array<{ estAlarme: boolean; valeur: number; item: string | null; revele: boolean }>;
  newBalance: number; itemCree?: { type: string } | null;
}

// ── Win tier ─────────────────────────────────────────────────────────────────
function winTier(m: number) {
  if (m <= 0)  return null;
  if (m < 3)   return { label: 'MINI WIN',  color: '#64748b' };
  if (m < 8)   return { label: 'SMALL WIN', color: '#3b82f6' };
  if (m < 20)  return { label: 'BIG WIN',   color: '#8b5cf6' };
  if (m < 50)  return { label: 'MEGA WIN',  color: '#f59e0b' };
  return             { label: 'ULTRA WIN', color: '#ef4444' };
}

// ── Symbol Cell ──────────────────────────────────────────────────────────────
function SymCell({ sym, winning, spinning, lineColor }: {
  sym: string; winning: boolean; spinning: boolean; lineColor?: string;
}) {
  const d = SYMS[sym] ?? SYMS.TEN;
  const glow = lineColor ?? d.glow;
  return (
    <motion.div
      animate={winning ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={winning ? { duration: 0.6, repeat: Infinity } : {}}
      className="w-[62px] h-[62px] sm:w-[76px] sm:h-[76px] rounded-xl flex flex-col items-center justify-center relative overflow-hidden select-none"
      style={{
        background: d.bg,
        border: winning ? `2px solid ${glow}` : '1px solid rgba(255,255,255,0.09)',
        boxShadow: winning
          ? `0 0 22px ${glow}99, inset 0 0 16px ${glow}22`
          : 'inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      {/* Top specular */}
      <div className="absolute top-0 left-0 right-0 h-1/3 rounded-t-xl"
        style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.18),transparent)', pointerEvents: 'none' }} />

      <span className="text-[32px] sm:text-[38px] leading-none z-10"
        style={{ filter: winning ? `drop-shadow(0 0 8px ${glow})` : 'none' }}>
        {d.emoji}
      </span>

      <span className="text-[8px] font-black tracking-widest mt-0.5 z-10"
        style={{ color: winning ? glow : 'rgba(255,255,255,0.35)' }}>
        {d.label}
      </span>

      {winning && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          animate={{ opacity: [0, 0.45, 0] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          style={{ background: glow, mixBlendMode: 'overlay' }}
        />
      )}

      {/* Bottom depth shadow */}
      <div className="absolute bottom-0 left-0 right-0 h-1/4 rounded-b-xl"
        style={{ background: 'linear-gradient(0deg,rgba(0,0,0,0.4),transparent)', pointerEvents: 'none' }} />
    </motion.div>
  );
}

// ── Reel ─────────────────────────────────────────────────────────────────────
function Reel({ symbols, reelIdx, spinning, stopped, teasing, winLines }: {
  symbols: string[]; reelIdx: number; spinning: boolean; stopped: boolean;
  teasing: boolean; winLines: WinLine[];
}) {
  const [disp, setDisp] = useState(symbols);
  const ivRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (spinning && !stopped) {
      ivRef.current = setInterval(() => {
        setDisp([
          ALL_SYMS[Math.random() * ALL_SYMS.length | 0],
          ALL_SYMS[Math.random() * ALL_SYMS.length | 0],
          ALL_SYMS[Math.random() * ALL_SYMS.length | 0],
        ]);
      }, 75);
    } else {
      clearInterval(ivRef.current);
      setDisp(symbols);
    }
    return () => clearInterval(ivRef.current);
  }, [spinning, stopped, symbols]);

  // Which rows are winning on this reel, and which line color
  const winMap = new Map<number, string>();
  if (!spinning || stopped) {
    winLines.forEach((l, li) => {
      const row = PAYLINES[l.indexLigne]?.[reelIdx];
      if (row !== undefined && !winMap.has(row)) winMap.set(row, LINE_COLORS[li % LINE_COLORS.length]);
    });
  }

  const isSpinning = spinning && !stopped;
  const isTease    = teasing && !stopped;

  return (
    <div className="relative">
      {/* Reel side glows when spinning */}
      {isSpinning && (
        <div className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ boxShadow: 'inset 0 0 20px rgba(245,158,11,0.12)' }} />
      )}
      <motion.div
        animate={isSpinning ? { y: [0, -12, 0] } : { y: 0 }}
        transition={isSpinning
          ? { duration: 0.09, repeat: Infinity, ease: 'linear' }
          : { type: 'spring', stiffness: 500, damping: 14, mass: 0.4 }}
        className="flex flex-col gap-1.5"
        style={{
          filter: isSpinning
            ? 'blur(4.5px) brightness(1.5) saturate(1.4)'
            : isTease
            ? 'blur(2px) brightness(1.2) saturate(1.6)'
            : 'none',
          transition: isSpinning ? 'none' : 'filter 0.15s ease',
        }}
      >
        {disp.map((sym, row) => (
          <SymCell
            key={row}
            sym={sym}
            winning={!isSpinning && winMap.has(row)}
            spinning={isSpinning}
            lineColor={winMap.get(row)}
          />
        ))}
      </motion.div>
    </div>
  );
}

// ── Payline SVG overlay ───────────────────────────────────────────────────────
function PaylineOverlay({ lines, visible }: { lines: WinLine[]; visible: boolean }) {
  if (!visible || lines.length === 0) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 20 }}
    >
      {lines.map((l, idx) => {
        const pattern = PAYLINES[l.indexLigne];
        if (!pattern) return null;
        const color = LINE_COLORS[idx % LINE_COLORS.length];
        const pts = pattern.map((row, col) => `${COL_X[col]},${ROW_Y[row]}`).join(' ');
        return (
          <g key={idx}>
            {/* Outer glow */}
            <polyline points={pts} fill="none" stroke={color}
              strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.22" />
            {/* Core line */}
            <polyline points={pts} fill="none" stroke={color}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
            {/* Dots */}
            {pattern.map((row, col) => (
              <circle key={col} cx={COL_X[col]} cy={ROW_Y[row]} r="2.8"
                fill={color} opacity="0.95" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ── Coin rain particles ───────────────────────────────────────────────────────
function CoinRain({ active }: { active: boolean }) {
  const [coins, setCoins] = useState<{ id: number; x: number; delay: number; dur: number }[]>([]);
  useEffect(() => {
    if (!active) { setCoins([]); return; }
    setCoins(Array.from({ length: 28 }, (_, i) => ({
      id: i, x: 3 + Math.random() * 94,
      delay: Math.random() * 1.4, dur: 1.1 + Math.random() * 0.9,
    })));
    const t = setTimeout(() => setCoins([]), 3200);
    return () => clearTimeout(t);
  }, [active]);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 30 }}>
      {coins.map(c => (
        <div key={c.id} className="absolute text-base select-none"
          style={{ left: `${c.x}%`, top: '-5%', animation: `slot-coin ${c.dur}s ${c.delay}s ease-in both` }}>
          🪙
        </div>
      ))}
    </div>
  );
}

// ── Neon strip decoration ─────────────────────────────────────────────────────
const NEON_COLORS = ['#ef4444','#f97316','#fbbf24','#22c55e','#06b6d4','#8b5cf6','#ec4899','#ef4444'];
function NeonStrip({ dir }: { dir: 'row' | 'col' }) {
  return (
    <div className={`flex ${dir === 'row' ? 'flex-row' : 'flex-col'} gap-1.5`}>
      {NEON_COLORS.map((c, i) => (
        <div key={i} className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{
            background: c,
            boxShadow: `0 0 6px ${c}, 0 0 14px ${c}80`,
            animation: `slot-neon 1.6s ${i * 0.2}s ease-in-out infinite`,
          }} />
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SlotsPage() {
  const { user, updateUser } = useAuth();
  const { socket } = useSocket();

  const [grid,         setGrid]         = useState<string[][]>(emptyGrid());
  const [mise,         setMise]         = useState(10);
  const [spinning,     setSpinning]     = useState(false);
  const [stopped,      setStopped]      = useState([true,true,true,true,true]);
  const [winLines,     setWinLines]     = useState<WinLine[]>([]);
  const [jackpot,      setJackpot]      = useState(50000);
  const [teasing,      setTeasing]      = useState(false);
  const [lastGain,     setLastGain]     = useState<number | null>(null);
  const [lastMult,     setLastMult]     = useState(0);
  const [autoSpin,     setAutoSpin]     = useState(false);
  const [showCoins,    setShowCoins]    = useState(false);
  const autoRef = useRef(false);

  // Free spins
  const [freeMode,     setFreeMode]     = useState(false);
  const [freeLeft,     setFreeLeft]     = useState(0);
  const [freeMult,     setFreeMult]     = useState(1);
  const [freeTotal,    setFreeTotal]    = useState(0);

  // Big win overlay
  const [bigVisible,   setBigVisible]   = useState(false);
  const [bigAmount,    setBigAmount]    = useState(0);
  const [bigMult,      setBigMult]      = useState(0);

  // Bonus mini-games
  const [showWheel,    setShowWheel]    = useState(false);
  const [wheelRes,     setWheelRes]     = useState<WheelResult | null>(null);
  const [wheelMise,    setWheelMise]    = useState(0);
  const [showChest,    setShowChest]    = useState(false);
  const [chestData,    setChestData]    = useState<{
    coffres: ChestResult['coffres']; gainTotal: number; itemsObtenus: string[]; mise: number; termine: boolean;
  } | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => {
    if (!socket) return;
    const h = ({ jackpot: j }: { jackpot: number }) => setJackpot(j);
    socket.on('slots:jackpot', h);
    return () => { socket.off('slots:jackpot', h); };
  }, [socket]);

  useEffect(() => {
    api.get('/games/slots/jackpot').then(r => setJackpot(r.data.jackpot)).catch(() => {});
  }, []);

  const handleSpin = useCallback(async () => {
    if (spinning || !user) return;
    if (!freeMode && (user.balance ?? 0) < mise) return;

    setSpinning(true);
    setStopped([false,false,false,false,false]);
    setWinLines([]);
    setTeasing(false);
    setLastGain(null);
    setLastMult(0);
    setShowCoins(false);
    clearTimers();

    try {
      const res = await api.post('/games/slots/spin', { amount: mise });
      const d: SpinResult = res.data;
      updateUser({ balance: d.newBalance });
      setJackpot(d.jackpot);

      let scatCount = 0;
      for (let r = 0; r < 5; r++)
        for (let row = 0; row < 3; row++)
          if (d.grille[r][row] === 'SCATTER') scatCount++;

      const DELAYS = [350, 750, 1200, 1700, 2250];
      DELAYS.forEach((delay, ri) => {
        const t = setTimeout(() => {
          setGrid(prev => prev.map((col, i) => i === ri ? d.grille[ri] : col));
          setStopped(prev => { const n = [...prev]; n[ri] = true; return n; });

          if (ri === 1 && scatCount >= 2) setTeasing(true);

          if (ri === 4) {
            setSpinning(false);
            setTeasing(false);
            setWinLines(d.lignesGagnantes);
            setLastGain(d.gainTotal > 0 ? d.gainTotal : null);
            setLastMult(d.multiplicateurTotal);

            if (d.gainTotal > 0 && !d.bigWin && !d.jackpotWin) {
              setShowCoins(true);
              setTimeout(() => setShowCoins(false), 3200);
            }

            if (d.estFreeSpin) {
              setFreeLeft(d.spinsRestants ?? 0);
              setFreeMult(d.multiplicateurFreeSpin ?? 1);
              setFreeTotal(d.gainTotalFreeSpins ?? 0);
              if (d.freeSpinsTermines) setFreeMode(false);
            }

            if (d.jackpotWin) {
              autoRef.current = false; setAutoSpin(false);
              setBigAmount(d.gainTotal); setBigMult(9999); setBigVisible(true);
              return;
            }
            if (d.bigWin && !d.bonus) {
              autoRef.current = false; setAutoSpin(false);
              setBigAmount(d.gainTotal); setBigMult(d.multiplicateurTotal); setBigVisible(true);
            }
            if (autoRef.current && !d.bonus && !d.bigWin && !d.jackpotWin) {
              if (!freeMode && d.newBalance < mise) { autoRef.current = false; setAutoSpin(false); }
              else setTimeout(() => { if (autoRef.current) handleSpin(); }, 620);
            }
            if (d.bonus) {
              autoRef.current = false; setAutoSpin(false);
              if (d.bonus.type === 'FREE_SPINS') {
                setFreeMode(true); setFreeLeft(d.bonus.freespins ?? 10); setFreeMult(1); setFreeTotal(0);
              } else if (d.bonus.type === 'WHEEL_OF_FORTUNE') {
                setWheelMise(mise); setWheelRes(null); setShowWheel(true);
                setTimeout(() => {
                  api.post('/games/slots/bonus/wheel', { amount: mise })
                    .then(r => { setWheelRes(r.data); updateUser({ balance: r.data.newBalance }); })
                    .catch(() => {});
                }, 800);
              } else if (d.bonus.type === 'CHEST_GAME') {
                setChestData({
                  coffres: Array.from({ length: 12 }, () => ({ estAlarme: false, valeur: 0, item: null, revele: false })),
                  gainTotal: 0, itemsObtenus: [], mise, termine: false,
                });
                setShowChest(true);
              }
            }
          }
        }, delay);
        timers.current.push(t);
      });
    } catch {
      setSpinning(false);
      setStopped([true,true,true,true,true]);
    }
  }, [spinning, user, freeMode, mise, updateUser]);

  const handleChest = useCallback(async (idx: number) => {
    try {
      const res = await api.post('/games/slots/bonus/chest', { indexCoffre: idx });
      const d: ChestResult = res.data;
      updateUser({ balance: d.newBalance });
      setChestData(prev => ({
        coffres: d.coffres, gainTotal: d.gainTotal,
        itemsObtenus: d.itemCree ? [...(prev?.itemsObtenus ?? []), d.itemCree.type] : prev?.itemsObtenus ?? [],
        mise: prev?.mise ?? mise, termine: d.termine,
      }));
    } catch {}
  }, [mise, updateUser]);

  const allStopped = stopped.every(Boolean);
  const tier = winTier(lastMult);

  return (
    <div className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse at 50% 0%,#100020 0%,#05000f 50%,#020008 100%)' }}>
      <Navbar />

      {/* Inject CSS animations */}
      <style>{`
        @keyframes slot-coin {
          0%   { transform:translateY(0) rotate(0deg) scale(1);opacity:1; }
          100% { transform:translateY(110vh) rotate(720deg) scale(0.4);opacity:0; }
        }
        @keyframes slot-neon {
          0%,100%{ opacity:1; }
          50%    { opacity:0.3; }
        }
        @keyframes slot-jackpot {
          0%,100%{ text-shadow:0 0 12px #f59e0b,0 0 25px #f59e0b80; }
          50%    { text-shadow:0 0 25px #fbbf24,0 0 50px #f59e0b,0 0 80px #f59e0b40; }
        }
        @keyframes slot-marquee {
          0%  { transform:translateX(100%); }
          100%{ transform:translateX(-130%); }
        }
        @keyframes slot-free {
          0%,100%{ box-shadow:0 0 18px rgba(99,102,241,0.4),inset 0 0 25px rgba(99,102,241,0.08); }
          50%    { box-shadow:0 0 38px rgba(99,102,241,0.7),inset 0 0 45px rgba(99,102,241,0.15); }
        }
        @keyframes slot-btn-idle {
          0%,100%{ box-shadow:0 0 28px rgba(245,158,11,0.45),0 8px 20px rgba(0,0,0,0.5); }
          50%    { box-shadow:0 0 50px rgba(245,158,11,0.75),0 8px 20px rgba(0,0,0,0.5); }
        }
        @keyframes slot-win-pop {
          0%  { transform:scale(0.5)rotate(-6deg);opacity:0; }
          65% { transform:scale(1.18)rotate(2deg);opacity:1; }
          100%{ transform:scale(1)rotate(0); }
        }
        @keyframes slot-rotate {
          from{ transform:rotate(0deg); }
          to  { transform:rotate(360deg); }
        }
      `}</style>

      <div className="max-w-5xl mx-auto px-3 pt-16 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_268px] gap-4 items-start">

          {/* ── SLOT MACHINE CABINET ──────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-full max-w-[560px] rounded-3xl overflow-hidden"
              style={{
                background: 'linear-gradient(180deg,#1c0a35 0%,#0e0420 45%,#060210 100%)',
                border: '2px solid rgba(245,158,11,0.32)',
                boxShadow: '0 0 70px rgba(139,92,246,0.12),0 0 40px rgba(245,158,11,0.08),0 30px 80px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.1)',
              }}>

              {/* ── Marquee header ──────────────────────────────────────── */}
              <div style={{
                background: 'linear-gradient(180deg,#120830 0%,#1c0f40 100%)',
                borderBottom: '2px solid rgba(245,158,11,0.28)',
                padding: '10px 16px 8px',
              }}>
                <div className="flex justify-center mb-2"><NeonStrip dir="row" /></div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[9px] font-black tracking-[0.35em] uppercase" style={{ color: 'rgba(245,158,11,0.5)' }}>Casino</div>
                    <div className="text-[26px] font-black leading-none"
                      style={{ background: 'linear-gradient(135deg,#fef3c7,#f59e0b,#d97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.04em' }}>
                      EVOLUTION
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] font-bold tracking-widest" style={{ color: 'rgba(251,191,36,0.55)' }}>⚡ JACKPOT</div>
                    <div className="text-xl font-black tabular-nums"
                      style={{ color: '#fbbf24', animation: 'slot-jackpot 1.8s ease-in-out infinite' }}>
                      {jackpot.toLocaleString('fr-FR')} F€
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-bold" style={{ color: 'rgba(245,158,11,0.5)' }}>LIGNES</div>
                    <div className="text-2xl font-black" style={{ color: '#f59e0b' }}>20</div>
                  </div>
                </div>

                {/* Scrolling ticker */}
                <div className="overflow-hidden h-[18px] mt-1.5 rounded"
                  style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(245,158,11,0.12)' }}>
                  <div className="text-[10px] font-bold whitespace-nowrap h-full flex items-center"
                    style={{ color: '#f59e0b', animation: 'slot-marquee 16s linear infinite', display: 'inline-flex', paddingLeft: '100%' }}>
                    🌟 WILD ×5 = JACKPOT &nbsp;•&nbsp; ⭐ 3 SCATTER = BONUS &nbsp;•&nbsp; 💎 DIAMOND ×5 = ×90 &nbsp;•&nbsp; 🎁 FREE SPINS • ROUE DE LA FORTUNE • COFFRES MYSTÈRES &nbsp;•&nbsp;
                  </div>
                </div>
              </div>

              {/* ── Free spin banner ────────────────────────────────────── */}
              <AnimatePresence>
                {freeMode && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <div className="px-4 py-2.5 flex items-center justify-between"
                      style={{
                        background: 'linear-gradient(90deg,#1d4ed8,#7c3aed,#1d4ed8)',
                        borderBottom: '2px solid rgba(99,102,241,0.45)',
                        animation: 'slot-free 1.5s ease-in-out infinite',
                      }}>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-blue-200">🎁 Free Spins</div>
                        <div className="text-2xl font-black text-white">{freeLeft} <span className="text-sm font-normal text-blue-300">restants</span></div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] font-bold text-purple-200">Multiplicateur</div>
                        <div className="text-xl font-black text-yellow-300">×{freeMult.toFixed(1)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-blue-200">Gains cumulés</div>
                        <div className="text-lg font-black text-green-300">+{freeTotal.toLocaleString('fr-FR')} F€</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Reel grid ───────────────────────────────────────────── */}
              <div className="px-3 pt-3 pb-2">
                <div className="flex items-stretch gap-2">
                  {/* Left neon */}
                  <div className="flex-shrink-0 flex items-center"><NeonStrip dir="col" /></div>

                  {/* Grid window */}
                  <div className="flex-1 relative rounded-2xl overflow-hidden"
                    style={{
                      background: 'linear-gradient(180deg,#03000c,#08001a)',
                      border: '2px solid rgba(245,158,11,0.22)',
                      boxShadow: 'inset 0 0 50px rgba(0,0,0,0.7), inset 0 0 1px rgba(255,255,255,0.04)',
                      padding: '8px',
                    }}>

                    <CoinRain active={showCoins} />

                    {/* Glass top reflection */}
                    <div className="absolute inset-x-0 top-0 h-1/3 pointer-events-none rounded-t-xl"
                      style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.05),transparent)', zIndex: 25 }} />

                    {/* Payline overlay (relative wrapper to get correct %) */}
                    <div className="relative">
                      <PaylineOverlay lines={allStopped ? winLines : []} visible={allStopped} />

                      {/* 5 reels */}
                      <div className="flex justify-center gap-1.5">
                        {grid.map((col, ri) => (
                          <Reel key={ri}
                            symbols={col} reelIdx={ri}
                            spinning={spinning} stopped={stopped[ri]}
                            teasing={teasing}
                            winLines={allStopped ? winLines : []}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Glass bottom glow */}
                    <div className="absolute inset-x-0 bottom-0 h-1/5 pointer-events-none"
                      style={{ background: 'linear-gradient(0deg,rgba(245,158,11,0.05),transparent)', zIndex: 25 }} />
                  </div>

                  {/* Right neon */}
                  <div className="flex-shrink-0 flex items-center"><NeonStrip dir="col" /></div>
                </div>

                {/* Win result */}
                <div className="min-h-[44px] flex items-center justify-center mt-2">
                  <AnimatePresence mode="wait">
                    {allStopped && lastGain !== null && lastGain > 0 && (
                      <motion.div key={lastGain}
                        initial={{ opacity: 0, y: 8, scale: 0.75 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: 'spring', stiffness: 320 }}
                        className="flex items-center gap-2.5"
                        style={{ animation: 'slot-win-pop 0.4s ease-out' }}
                      >
                        {tier && (
                          <span className="text-[11px] font-black tracking-widest px-3 py-0.5 rounded-full"
                            style={{
                              background: `${tier.color}1a`, color: tier.color,
                              border: `1px solid ${tier.color}`, textShadow: `0 0 10px ${tier.color}`,
                            }}>
                            {tier.label}
                          </span>
                        )}
                        <span className="text-2xl font-black text-green-400"
                          style={{ textShadow: '0 0 14px rgba(74,222,128,0.8)' }}>
                          +{formatBalance(lastGain)}
                        </span>
                        <span className="text-xs text-gray-500">
                          ×{lastMult.toFixed(1)} — {winLines.length}L
                        </span>
                      </motion.div>
                    )}
                    {allStopped && !spinning && (lastGain === null || lastGain === 0) && (
                      <motion.p key="noop"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-xs text-gray-700">
                        Bonne chance au prochain spin !
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* ── Controls ────────────────────────────────────────────── */}
              <div className="px-4 pb-5 space-y-3" style={{ borderTop: '1px solid rgba(245,158,11,0.12)' }}>

                {/* Bet chips */}
                {!freeMode && (
                  <div className="pt-3">
                    <div className="text-[9px] font-black tracking-[0.3em] text-center mb-2"
                      style={{ color: 'rgba(245,158,11,0.45)' }}>MISE PAR SPIN</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {MISES.map(m => (
                        <button key={m}
                          onClick={() => !spinning && setMise(m)}
                          disabled={spinning}
                          className="py-2 rounded-xl text-xs font-black transition-all disabled:opacity-40"
                          style={{
                            background: mise === m ? 'linear-gradient(135deg,#92400e,#d97706,#f59e0b)' : 'rgba(255,255,255,0.04)',
                            color: mise === m ? '#000' : '#6b7280',
                            border: mise === m ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.06)',
                            boxShadow: mise === m ? '0 0 14px rgba(245,158,11,0.5)' : 'none',
                            transform: mise === m ? 'scale(1.04)' : undefined,
                          }}>
                          {m >= 1000 ? `${m/1000}K` : m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Spin row */}
                <div className="flex items-center gap-3">
                  {/* Auto toggle */}
                  <button
                    onClick={() => {
                      const next = !autoSpin;
                      autoRef.current = next;
                      setAutoSpin(next);
                      if (next && !spinning) handleSpin();
                    }}
                    disabled={!freeMode && (user?.balance ?? 0) < mise}
                    className="flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-[10px] font-black transition-all gap-0.5"
                    style={{
                      background: autoSpin ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                      color: autoSpin ? '#22c55e' : '#4b5563',
                      border: autoSpin ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.06)',
                      boxShadow: autoSpin ? '0 0 12px rgba(34,197,94,0.25)' : 'none',
                    }}>
                    <span style={{ display: 'inline-block', animation: autoSpin ? 'slot-rotate 1s linear infinite' : 'none', fontSize: 16 }}>⚙️</span>
                    AUTO
                  </button>

                  {/* SPIN button */}
                  <motion.button
                    whileTap={!spinning ? { scale: 0.93 } : {}}
                    onClick={handleSpin}
                    disabled={spinning || (!freeMode && (user?.balance ?? 0) < mise)}
                    className="flex-1 py-4 rounded-2xl text-lg font-black disabled:cursor-not-allowed"
                    style={{
                      background: spinning
                        ? 'rgba(15,5,30,0.9)'
                        : freeMode
                        ? 'linear-gradient(135deg,#1d4ed8,#7c3aed)'
                        : 'linear-gradient(135deg,#78350f,#b45309,#f59e0b,#b45309,#78350f)',
                      color: spinning ? '#2d2d3a' : '#000',
                      boxShadow: spinning ? 'none' : freeMode
                        ? '0 0 30px rgba(99,102,241,0.55), 0 8px 22px rgba(0,0,0,0.5)'
                        : undefined,
                      animation: !spinning && !freeMode ? 'slot-btn-idle 2.2s ease-in-out infinite' : 'none',
                      border: spinning ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}>
                    {spinning ? (
                      <span className="flex items-center justify-center gap-2">
                        <span style={{ display: 'inline-block', animation: 'slot-rotate 0.5s linear infinite' }}>⚙️</span>
                        Rotation en cours…
                      </span>
                    ) : freeMode ? `🎁 FREE SPIN — ${freeLeft} restants`
                    : `▶ SPIN — ${formatBalance(mise)}`}
                  </motion.button>

                  {/* Balance */}
                  <div className="flex-shrink-0 text-right min-w-[60px]">
                    <div className="text-[9px] font-bold" style={{ color: 'rgba(245,158,11,0.45)' }}>SOLDE</div>
                    <div className="text-sm font-black" style={{ color: '#f59e0b' }}>
                      {formatBalance(user?.balance ?? 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Paytable accordion ─────────────────────────────────────── */}
            <div className="w-full max-w-[560px] rounded-2xl overflow-hidden"
              style={{ background: 'rgba(8,2,18,0.85)', border: '1px solid rgba(245,158,11,0.13)' }}>
              <details>
                <summary className="px-4 py-2.5 cursor-pointer text-sm font-bold select-none flex items-center justify-between"
                  style={{ color: 'rgba(245,158,11,0.65)' }}>
                  <span>📋 Tableau des gains — 20 lignes actives</span>
                  <span className="text-xs opacity-50">▼</span>
                </summary>
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    {([
                      { sym: 'WILD',    pays: '×15 / ×50 / ×200',   note: 'Remplace tout' },
                      { sym: 'SCATTER', pays: '3+ = BONUS GARANTI',  note: 'Free Spins/Roue/Coffres' },
                      { sym: 'DIAMOND', pays: '×8 / ×30 / ×90'   },
                      { sym: 'CROWN',   pays: '×3 / ×12 / ×35'   },
                      { sym: 'ACE',     pays: '×1.2 / ×4 / ×12'  },
                      { sym: 'KING',    pays: '×0.9 / ×2.5 / ×7' },
                      { sym: 'QUEEN',   pays: '×0.7 / ×2 / ×5'   },
                      { sym: 'JACK',    pays: '×0.5 / ×1.5 / ×3' },
                      { sym: 'TEN',     pays: '×0.4 / ×1.2 / ×2.5' },
                    ] as { sym: string; pays: string; note?: string }[]).map(({ sym, pays, note }) => {
                      const d = SYMS[sym];
                      return (
                        <div key={sym} className="flex items-center gap-2">
                          <span className="text-xl">{d?.emoji}</span>
                          <div>
                            <div className="font-bold text-white text-[11px]">{d?.label}</div>
                            <div className="text-[10px]" style={{ color: d?.glow }}>{pays}</div>
                            {note && <div className="text-[9px] text-gray-600">{note}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-white/5 space-y-1 text-[10px]">
                    <div className="text-yellow-400">🌟 WILD ×5 ligne centrale = JACKPOT PROGRESSIF</div>
                    <div className="text-gray-500">Gains calculés sur 3, 4 ou 5 symboles identiques</div>
                  </div>
                </div>
              </details>
            </div>
          </div>

          {/* ── Right panel: paylines + details ───────────────────────────── */}
          <div className="hidden lg:flex flex-col gap-3">

            {/* Active paylines grid */}
            <div className="rounded-2xl p-3"
              style={{ background: 'rgba(8,2,18,0.85)', border: '1px solid rgba(245,158,11,0.13)' }}>
              <div className="text-[9px] font-black tracking-widest mb-2.5"
                style={{ color: 'rgba(245,158,11,0.55)' }}>LIGNES ACTIVES</div>
              <div className="grid grid-cols-4 gap-1">
                {PAYLINES.map((_, i) => {
                  const w = winLines.some(l => l.indexLigne === i);
                  return (
                    <div key={i} className="text-center text-[10px] font-black rounded-lg py-1"
                      style={{
                        background: w ? `${LINE_COLORS[i]}20` : 'rgba(255,255,255,0.03)',
                        color: w ? LINE_COLORS[i] : 'rgba(255,255,255,0.18)',
                        border: w ? `1px solid ${LINE_COLORS[i]}50` : '1px solid transparent',
                        boxShadow: w ? `0 0 8px ${LINE_COLORS[i]}40` : 'none',
                        transition: 'all 0.3s',
                      }}>
                      {i + 1}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Last spin breakdown */}
            <div className="rounded-2xl p-3"
              style={{ background: 'rgba(8,2,18,0.85)', border: `1px solid ${lastGain && lastGain > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
              <div className="text-[9px] font-black tracking-widest mb-2"
                style={{ color: lastGain && lastGain > 0 ? 'rgba(34,197,94,0.6)' : 'rgba(255,255,255,0.2)' }}>
                DERNIER RÉSULTAT
              </div>
              {lastGain !== null && lastGain > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-green-400 font-black text-xl">+{formatBalance(lastGain)}</div>
                  <div className="text-xs text-gray-400">×{lastMult.toFixed(2)} multiplicateur</div>
                  <div className="text-xs text-gray-500">{winLines.length} ligne{winLines.length > 1 ? 's' : ''} gagnante{winLines.length > 1 ? 's' : ''}</div>
                  <div className="space-y-1 pt-1 border-t border-white/5">
                    {winLines.map((l, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px]">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                        <span style={{ color: LINE_COLORS[i % LINE_COLORS.length] }}>L{l.indexLigne + 1}</span>
                        <span className="text-gray-400">{SYMS[l.symbole]?.emoji} {l.count}× &nbsp;×{l.multiplicateur}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-gray-700 text-xs">Aucun gain ce spin</div>
              )}
            </div>

            {/* Symbol legend */}
            <div className="rounded-2xl p-3"
              style={{ background: 'rgba(8,2,18,0.85)', border: '1px solid rgba(245,158,11,0.13)' }}>
              <div className="text-[9px] font-black tracking-widest mb-2.5" style={{ color: 'rgba(245,158,11,0.55)' }}>
                SYMBOLES
              </div>
              <div className="space-y-1.5">
                {Object.entries(SYMS).reverse().map(([key, d]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-lg leading-none">{d.emoji}</span>
                    <span className="text-[10px] font-bold" style={{ color: d.glow }}>{d.label}</span>
                    <div className="flex-1 h-px rounded" style={{ background: `linear-gradient(90deg,${d.glow}50,transparent)` }} />
                    <div className="flex gap-0.5">
                      {Array.from({ length: d.tier }, (_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: d.glow }} />
                      ))}
                      {Array.from({ length: 5 - d.tier }, (_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Jackpot live */}
            <div className="rounded-2xl p-3 text-center"
              style={{ background: 'rgba(8,2,18,0.85)', border: '1px solid rgba(245,158,11,0.13)' }}>
              <div className="text-[9px] font-black tracking-widest mb-1" style={{ color: 'rgba(251,191,36,0.5)' }}>JACKPOT PROGRESSIF</div>
              <div className="text-2xl font-black tabular-nums"
                style={{ color: '#fbbf24', animation: 'slot-jackpot 1.8s ease-in-out infinite' }}>
                {jackpot.toLocaleString('fr-FR')} F€
              </div>
              <div className="text-[9px] text-gray-600 mt-1">🌟 WILD ×5 sur la ligne centrale</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bonus overlays ──────────────────────────────────────────────────── */}
      <BigWinOverlay visible={bigVisible} montant={bigAmount} multiplicateur={bigMult} onClose={() => setBigVisible(false)} />

      {showWheel && (
        <WheelOfFortune
          mise={wheelMise}
          multiplicateur={wheelRes?.multiplicateur ?? null}
          gain={wheelRes?.gain ?? 0}
          onClose={() => { setShowWheel(false); setWheelRes(null); }}
        />
      )}

      {showChest && chestData && (
        <ChestGame
          coffres={chestData.coffres}
          gainTotal={chestData.gainTotal}
          itemsObtenus={chestData.itemsObtenus}
          mise={chestData.mise}
          termine={chestData.termine}
          onPick={handleChest}
          onClose={() => { setShowChest(false); setChestData(null); }}
        />
      )}
    </div>
  );
}
