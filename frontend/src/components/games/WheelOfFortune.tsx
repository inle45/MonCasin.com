'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SEGMENTS = [
  { multiplicateur: 10,  couleur: '#f59e0b', angle: 0   },
  { multiplicateur: 15,  couleur: '#d97706', angle: 40  },
  { multiplicateur: 20,  couleur: '#b45309', angle: 80  },
  { multiplicateur: 25,  couleur: '#ef4444', angle: 120 },
  { multiplicateur: 30,  couleur: '#dc2626', angle: 160 },
  { multiplicateur: 40,  couleur: '#7c3aed', angle: 200 },
  { multiplicateur: 50,  couleur: '#6d28d9', angle: 240 },
  { multiplicateur: 75,  couleur: '#1d4ed8', angle: 280 },
  { multiplicateur: 100, couleur: '#065f46', angle: 320 },
];

const TOTAL_SEGMENTS = SEGMENTS.length;
const SEGMENT_ANGLE = 360 / TOTAL_SEGMENTS; // 40°

interface Props {
  mise: number;
  multiplicateur: number | null; // null = pas encore de résultat
  gain: number;
  onClose: () => void;
}

export default function WheelOfFortune({ mise, multiplicateur, gain, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Angle de départ aléatoire, angle final centré sur le segment gagnant
  const targetIndexRef = useRef(0);
  const startAngleRef = useRef(Math.random() * 360);
  const totalRotationRef = useRef(0);

  useEffect(() => {
    if (multiplicateur === null) return;

    const idx = SEGMENTS.findIndex(s => s.multiplicateur === multiplicateur);
    targetIndexRef.current = idx >= 0 ? idx : 0;

    // Angle de la flèche (pointe vers le haut) doit atterrir au centre du segment gagnant
    const targetAngle = SEGMENTS[targetIndexRef.current].angle + SEGMENT_ANGLE / 2;
    // Tours complets (4) + ajustement pour centrer le segment
    const currentMod = startAngleRef.current % 360;
    const delta = (360 - currentMod + targetAngle) % 360;
    totalRotationRef.current = startAngleRef.current + 4 * 360 + delta;

    startTimeRef.current = null;

    function drawWheel(angle: number) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = cx - 10;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fond sombre
      ctx.beginPath();
      ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();

      // Segments
      SEGMENTS.forEach((seg, i) => {
        const startRad = ((angle + i * SEGMENT_ANGLE - 90) * Math.PI) / 180;
        const endRad = ((angle + (i + 1) * SEGMENT_ANGLE - 90) * Math.PI) / 180;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startRad, endRad);
        ctx.closePath();
        ctx.fillStyle = seg.couleur;
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Texte du multiplicateur
        const midRad = (startRad + endRad) / 2;
        const tx = cx + (r * 0.68) * Math.cos(midRad);
        const ty = cy + (r * 0.68) * Math.sin(midRad);
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(midRad + Math.PI / 2);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(`×${seg.multiplicateur}`, 0, 0);
        ctx.restore();
      });

      // Hub central
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
      grad.addColorStop(0, '#fbbf24');
      grad.addColorStop(1, '#92400e');
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Flèche fixe (pointe vers le haut)
      ctx.save();
      ctx.translate(cx, 12);
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-10, 22);
      ctx.lineTo(10, 22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const DURATION = 4500; // ms

    function easeOut(t: number) {
      return 1 - Math.pow(1 - t, 4);
    }

    function animate(ts: number) {
      if (!startTimeRef.current) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;
      const t = Math.min(elapsed / DURATION, 1);
      const currentAngle = easeOut(t) * (totalRotationRef.current - startAngleRef.current) + startAngleRef.current;

      drawWheel(currentAngle);

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        drawWheel(totalRotationRef.current % 360);
        setRevealed(true);
      }
    }

    drawWheel(startAngleRef.current);
    animRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animRef.current);
  }, [multiplicateur]);

  // Dessiner l'état initial (roue statique)
  useEffect(() => {
    if (multiplicateur !== null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = cx - 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    SEGMENTS.forEach((seg, i) => {
      const startRad = ((i * SEGMENT_ANGLE - 90) * Math.PI) / 180;
      const endRad = (((i + 1) * SEGMENT_ANGLE - 90) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startRad, endRad);
      ctx.closePath();
      ctx.fillStyle = seg.couleur;
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      const midRad = (startRad + endRad) / 2;
      const tx = cx + (r * 0.68) * Math.cos(midRad);
      const ty = cy + (r * 0.68) * Math.sin(midRad);
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(midRad + Math.PI / 2);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`×${seg.multiplicateur}`, 0, 0);
      ctx.restore();
    });

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
    grad.addColorStop(0, '#fbbf24');
    grad.addColorStop(1, '#92400e');
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.save();
    ctx.translate(cx, 12);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-10, 22);
    ctx.lineTo(10, 22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [multiplicateur]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center gap-6 p-8 rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)', border: '2px solid #f59e0b' }}
      >
        <h2 className="text-3xl font-black text-casino-gold">Roue de la Fortune</h2>
        <p className="text-gray-400 text-sm">Mise : {mise.toLocaleString('fr-FR')} F€</p>

        <div className="relative">
          <canvas ref={canvasRef} width={280} height={280} />
        </div>

        <AnimatePresence>
          {revealed && multiplicateur !== null && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="text-center"
            >
              <div className="text-5xl font-black text-casino-gold">×{multiplicateur}</div>
              <div className="text-2xl font-bold text-green-400 mt-1">
                +{gain.toLocaleString('fr-FR')} F€
              </div>
              <button
                onClick={onClose}
                className="mt-4 px-8 py-3 bg-casino-gold text-black font-black rounded-xl text-lg hover:bg-casino-gold-light transition-colors"
              >
                Encaisser 💰
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!revealed && (
          <p className="text-yellow-300 text-sm animate-pulse">La roue tourne...</p>
        )}
      </motion.div>
    </div>
  );
}
