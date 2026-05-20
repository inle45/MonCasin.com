'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PUNISHMENTS = [
  { label: '😭 Message dans le chat', desc: 'Le casino annonce ta défaite à tous' },
  { label: '🐔 Avatar poulet forcé', desc: '...juste dans ta tête, promis' },
  { label: '🎲 Lance encore !', desc: 'Ta punition c\'est de rejouer' },
  { label: '💸 -1 F€ symbolique', desc: 'Pour la forme' },
  { label: '🤡 Tu es le Clown du jour', desc: 'Titre provisoire : Grand Perdant' },
  { label: '☕ Pause café obligatoire', desc: 'Reviens dans 2 minutes' },
  { label: '🔁 Mise doublée !', desc: 'La chance tourne... ou pas' },
  { label: '🐢 Mode tortue activé', desc: 'Joue lentement, réfléchis vite' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  lossStreak: number;
}

export default function ShameWheel({ visible, onClose, lossStreak }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<typeof PUNISHMENTS[0] | null>(null);
  const [rotation, setRotation] = useState(0);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    const idx = Math.floor(Math.random() * PUNISHMENTS.length);
    const newRotation = rotation + 1440 + (idx / PUNISHMENTS.length) * 360;
    setRotation(newRotation);
    setTimeout(() => {
      setResult(PUNISHMENTS[idx]);
      setSpinning(false);
    }, 3000);
  };

  if (!visible) return null;

  const segmentAngle = 360 / PUNISHMENTS.length;
  const colors = ['#ef4444','#f97316','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#ec4899','#06b6d4'];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      >
        <motion.div
          initial={{ scale: 0.8, y: 40 }}
          animate={{ scale: 1, y: 0 }}
          className="rounded-3xl p-8 flex flex-col items-center gap-5 max-w-sm w-full mx-4"
          style={{ background: 'linear-gradient(145deg,#12121f,#1a1a2e)', border: '2px solid #ef4444' }}
        >
          <div className="text-4xl">😭</div>
          <div className="text-center">
            <div className="text-red-400 font-black text-xl">Roue de la Honte !</div>
            <div className="text-gray-400 text-sm mt-1">{lossStreak} défaites d'affilée... tu mérites ta punition</div>
          </div>

          {/* Roue SVG */}
          <div className="relative">
            {/* Flèche */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 text-2xl">▼</div>
            <motion.svg
              width="200" height="200" viewBox="-100 -100 200 200"
              animate={{ rotate: rotation }}
              transition={{ duration: 3, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {PUNISHMENTS.map((p, i) => {
                const startAngle = (i * segmentAngle - 90) * Math.PI / 180;
                const endAngle = ((i + 1) * segmentAngle - 90) * Math.PI / 180;
                const x1 = Math.cos(startAngle) * 90;
                const y1 = Math.sin(startAngle) * 90;
                const x2 = Math.cos(endAngle) * 90;
                const y2 = Math.sin(endAngle) * 90;
                const mx = Math.cos((startAngle + endAngle) / 2) * 55;
                const my = Math.sin((startAngle + endAngle) / 2) * 55;
                return (
                  <g key={i}>
                    <path d={`M 0 0 L ${x1} ${y1} A 90 90 0 0 1 ${x2} ${y2} Z`} fill={colors[i]} stroke="#0a0a0f" strokeWidth="1" />
                    <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="white" fontWeight="bold">
                      {i + 1}
                    </text>
                  </g>
                );
              })}
              <circle r="12" fill="#0a0a0f" />
            </motion.svg>
          </div>

          {result ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="text-center p-4 rounded-2xl w-full"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <div className="text-white font-black text-lg">{result.label}</div>
              <div className="text-gray-400 text-sm mt-1">{result.desc}</div>
            </motion.div>
          ) : (
            <button onClick={spin} disabled={spinning}
              className="w-full py-3 rounded-xl font-black text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#b91c1c,#ef4444)' }}>
              {spinning ? '🎡 Ça tourne...' : '🎡 FAIRE TOURNER'}
            </button>
          )}

          {result && (
            <button onClick={onClose} className="text-gray-500 text-sm hover:text-gray-300">
              Fermer et continuer à perdre →
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
