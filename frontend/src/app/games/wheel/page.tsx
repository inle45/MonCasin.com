'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import toast from 'react-hot-toast';
import { sfx } from '@/lib/sfx';
import BigWinOverlay from '@/components/games/BigWinOverlay';
import ShameWheel from '@/components/ui/ShameWheel';

const SEGMENTS = [
  { label: '×0.5', multiplier: 0.5, color: '#ef4444' },
  { label: '×1.5', multiplier: 1.5, color: '#22c55e' },
  { label: '×2',   multiplier: 2,   color: '#3b82f6' },
  { label: '×3',   multiplier: 3,   color: '#f59e0b' },
  { label: '×0',   multiplier: 0,   color: '#6b7280' },
  { label: '×5',   multiplier: 5,   color: '#8b5cf6' },
  { label: '×10',  multiplier: 10,  color: '#ec4899' },
  { label: '×25',  multiplier: 25,  color: '#f59e0b' },
  { label: '×0.5', multiplier: 0.5, color: '#ef4444' },
  { label: '×1',   multiplier: 1,   color: '#64748b' },
  { label: '×2',   multiplier: 2,   color: '#3b82f6' },
  { label: '×50',  multiplier: 50,  color: '#fbbf24' },
];

const BETS = [50, 100, 250, 500, 1000, 2500];

export default function WheelPage() {
  const { user, updateUser } = useAuth();
  const [bet, setBet] = useState(100);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<{ segment: typeof SEGMENTS[0]; payout: number; profit: number } | null>(null);
  const [bigWin, setBigWin] = useState<{ montant: number; multiplicateur: number } | null>(null);
  const [lossStreak, setLossStreak] = useState(0);
  const [shameVisible, setShameVisible] = useState(false);
  const lastRotation = useRef(0);

  const spin = async () => {
    if (spinning || !user || user.balance < bet) return;
    setSpinning(true);
    setResult(null);

    try {
      const res = await api.post('/games/wheel/spin', { bet });
      const data = res.data;

      const segmentAngle = 360 / SEGMENTS.length;
      const targetAngle = (data.index + 0.5) * segmentAngle;
      const spins = 5 + Math.floor(Math.random() * 3);
      const newRotation = lastRotation.current + spins * 360 + (360 - targetAngle);
      lastRotation.current = newRotation;
      setRotation(newRotation);

      setTimeout(() => {
        setResult({ segment: data.segment, payout: data.payout, profit: data.profit });
        updateUser({ balance: data.newBalance });

        if (data.profit > 0) {
          sfx.win();
          if (data.segment.multiplier >= 5) { sfx.bigWin(); setBigWin({ montant: data.payout, multiplicateur: data.segment.multiplier }); }
          toast.success(`🎡 ${data.segment.label} — +${formatBalance(data.payout)} !`);
          setLossStreak(0);
        } else {
          sfx.lose();
          toast.error(`💥 ${data.segment.label} — Raté`);
          const newStreak = lossStreak + 1;
          setLossStreak(newStreak);
          if (newStreak >= 5) { setShameVisible(true); setLossStreak(0); }
        }
        setSpinning(false);
      }, 4000);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur');
      setSpinning(false);
    }
  };

  const segmentAngle = 360 / SEGMENTS.length;

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <BigWinOverlay visible={!!bigWin} montant={bigWin?.montant ?? 0} multiplicateur={bigWin?.multiplicateur ?? 0} onClose={() => setBigWin(null)} />
      <ShameWheel visible={shameVisible} onClose={() => setShameVisible(false)} lossStreak={5} />
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-20 pb-10 flex flex-col gap-5 items-center">
        <div className="text-center">
          <h1 className="text-3xl font-black text-casino-gold">🎡 Roue de la Richesse</h1>
          <p className="text-gray-400 text-sm mt-1">Jusqu'à ×50 — Tentez votre chance !</p>
        </div>

        {/* Roue */}
        <div className="relative flex items-center justify-center">
          {/* Flèche indicatrice */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20 text-casino-gold text-3xl drop-shadow-lg">▼</div>
          <div className="relative w-72 h-72">
            <motion.svg
              width="100%" height="100%" viewBox="-150 -150 300 300"
              animate={{ rotate: rotation }}
              transition={{ duration: 4, ease: [0.15, 0.5, 0.35, 1] }}
            >
              {SEGMENTS.map((seg, i) => {
                const start = (i * segmentAngle - 90) * Math.PI / 180;
                const end = ((i + 1) * segmentAngle - 90) * Math.PI / 180;
                const x1 = Math.cos(start) * 140, y1 = Math.sin(start) * 140;
                const x2 = Math.cos(end) * 140, y2 = Math.sin(end) * 140;
                const mx = Math.cos((start + end) / 2) * 95;
                const my = Math.sin((start + end) / 2) * 95;
                return (
                  <g key={i}>
                    <path d={`M 0 0 L ${x1} ${y1} A 140 140 0 0 1 ${x2} ${y2} Z`}
                      fill={seg.color} stroke="#0a0a0f" strokeWidth="2" opacity="0.9" />
                    <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle"
                      fontSize="13" fontWeight="bold" fill="white"
                      transform={`rotate(${(i + 0.5) * segmentAngle}, ${mx}, ${my})`}>
                      {seg.label}
                    </text>
                  </g>
                );
              })}
              <circle r="18" fill="#0a0a0f" stroke="rgba(245,158,11,0.5)" strokeWidth="2" />
              <text textAnchor="middle" dominantBaseline="middle" fontSize="14" fill="#f59e0b">🎡</text>
            </motion.svg>
          </div>
        </div>

        {/* Résultat */}
        {result && !spinning && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full text-center py-4 rounded-2xl"
            style={{
              background: result.profit > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${result.profit > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
            <div className="text-3xl font-black" style={{ color: result.profit > 0 ? '#22c55e' : '#ef4444' }}>
              {result.segment.label}
            </div>
            <div className={`text-lg font-bold mt-1 ${result.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {result.profit > 0 ? `+${formatBalance(result.payout)}` : result.segment.multiplier === 0 ? 'Perdu tout' : formatBalance(result.payout)}
            </div>
          </motion.div>
        )}

        {/* Mise */}
        <div className="grid grid-cols-3 gap-2 w-full">
          {BETS.map(b => (
            <button key={b} onClick={() => setBet(b)}
              className="py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: bet === b ? 'linear-gradient(135deg,#b45309,#f59e0b)' : 'rgba(30,27,75,0.7)',
                color: bet === b ? '#000' : '#9ca3af',
                border: bet === b ? '2px solid #fbbf24' : '1px solid rgba(245,158,11,0.15)',
              }}>
              {b.toLocaleString('fr-FR')} F€
            </button>
          ))}
        </div>

        {/* Bouton */}
        <motion.button whileTap={{ scale: 0.97 }} onClick={spin}
          disabled={spinning || (user?.balance ?? 0) < bet}
          className="w-full py-4 rounded-2xl text-xl font-black disabled:opacity-50 transition-all"
          style={{
            background: spinning ? 'rgba(20,20,40,0.8)' : 'linear-gradient(135deg,#b45309,#f59e0b,#b45309)',
            color: spinning ? '#4b5563' : '#000',
            boxShadow: spinning ? 'none' : '0 0 28px rgba(245,158,11,0.55)',
          }}>
          {spinning ? '🎡 Ça tourne...' : `🎡 TOURNER — ${formatBalance(bet)}`}
        </motion.button>

        <div className="text-center text-sm text-gray-400">
          Solde : <span className="text-casino-gold font-bold">{formatBalance(user?.balance ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}
