'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatBalance } from '@/lib/api';

interface Props {
  visible: boolean;
  montant: number;
  multiplicateur: number;
  onClose: () => void;
}

// Pièces d'or en CSS pur — rendu côté client uniquement
function PiecesOr() {
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 1.2 + Math.random() * 1.0,
    size: 8 + Math.random() * 12,
    emoji: i % 3 === 0 ? '🪙' : i % 3 === 1 ? '💰' : '⭐',
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: -30, x: `${p.left}vw`, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', opacity: 0, rotate: 720 }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          style={{ position: 'absolute', top: 0, fontSize: p.size }}
        >
          {p.emoji}
        </motion.div>
      ))}
    </div>
  );
}

export default function BigWinOverlay({ visible, montant, multiplicateur, onClose }: Props) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      timeoutRef.current = setTimeout(onClose, 5000);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [visible, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
          style={{ background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.25) 0%, rgba(0,0,0,0.92) 70%)' }}
          onClick={onClose}
        >
          <PiecesOr />

          {/* Tremblement + flash d'écran */}
          <motion.div
            animate={{ x: [0, -8, 8, -5, 5, -2, 2, 0], y: [0, -5, 5, -3, 3, 0] }}
            transition={{ duration: 0.6, times: [0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 1] }}
            className="relative z-10 flex flex-col items-center gap-6"
          >
            {/* Flash lumineux */}
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 8, opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="absolute w-24 h-24 rounded-full bg-yellow-400"
            />

            {/* Texte BIG WIN */}
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: [0, 1.3, 1.0], rotate: [0, 5, 0] }}
              transition={{ duration: 0.7, times: [0, 0.6, 1], type: 'spring', stiffness: 200 }}
              className="text-center"
            >
              <div
                className="text-7xl font-black tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706, #fbbf24)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 0 60px rgba(245,158,11,0.8)',
                  filter: 'drop-shadow(0 0 20px rgba(245,158,11,1))',
                }}
              >
                BIG WIN !
              </div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-5xl font-black text-casino-gold mt-3"
                style={{ textShadow: '0 0 30px rgba(245,158,11,0.9)' }}
              >
                +{formatBalance(montant)}
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-2xl text-yellow-300 font-bold mt-2"
              >
                ×{multiplicateur} la mise !
              </motion.div>
            </motion.div>

            {/* Bouton fermer */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              onClick={onClose}
              className="mt-4 px-8 py-3 bg-casino-gold text-black font-black rounded-xl text-lg hover:bg-casino-gold-light transition-colors"
            >
              Encaisser 💰
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
