'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import { formatBalance } from '@/lib/api';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Achievement {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  reward: number;
  earned: boolean;
  earnedAt: string | null;
}

interface SpinStatus {
  canSpin: boolean;
  nextSpinAt: string | null;
  lastReward: number | null;
}

const WHEEL_SEGMENTS = [
  { amount: 500, color: '#ef4444', label: '500' },
  { amount: 1000, color: '#f59e0b', label: '1 000' },
  { amount: 1500, color: '#10b981', label: '1 500' },
  { amount: 2000, color: '#3b82f6', label: '2 000' },
  { amount: 3000, color: '#8b5cf6', label: '3 000' },
  { amount: 5000, color: '#f59e0b', label: '5 000' },
];

export default function BonusesPage() {
  const { user, updateUser, isLoading } = useAuth();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [spinStatus, setSpinStatus] = useState<SpinStatus>({ canSpin: false, nextSpinAt: null, lastReward: null });
  const [bailoutLeft, setBailoutLeft] = useState(3);
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [countdown, setCountdown] = useState('');
  const [hasLoan, setHasLoan] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('casino_token');
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      axios.get(`${API}/api/bonuses/achievements`, { headers }),
      axios.get(`${API}/api/bonuses/daily-spin/status`, { headers }),
      axios.get(`${API}/api/bonuses/bailout/status`, { headers }),
      axios.get(`${API}/api/bonuses/loans`, { headers }),
    ]).then(([ach, spin, bailout, loans]) => {
      setAchievements(ach.data.achievements);
      setSpinStatus(spin.data);
      setBailoutLeft(bailout.data.usagesLeft);
      setHasLoan(loans.data.loans?.length > 0);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!spinStatus.nextSpinAt) return;
    const update = () => {
      const diff = new Date(spinStatus.nextSpinAt!).getTime() - Date.now();
      if (diff <= 0) { setCountdown(''); setSpinStatus(s => ({ ...s, canSpin: true, nextSpinAt: null })); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [spinStatus.nextSpinAt]);

  useEffect(() => {
    drawWheel(rotation);
  }, [rotation]);

  function drawWheel(rot: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(cx, cy) - 10;
    const seg = (Math.PI * 2) / WHEEL_SEGMENTS.length;

    ctx.clearRect(0, 0, W, H);

    WHEEL_SEGMENTS.forEach((s, i) => {
      const start = rot + i * seg - Math.PI / 2;
      const end = start + seg;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Texte
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + seg / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(s.label + ' F€', r - 12, 5);
      ctx.restore();
    });

    // Centre
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#0d0d1a';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Flèche
    ctx.beginPath();
    ctx.moveTo(cx + r + 8, cy);
    ctx.lineTo(cx + r - 4, cy - 8);
    ctx.lineTo(cx + r - 4, cy + 8);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  async function spin() {
    if (!spinStatus.canSpin || spinning) return;
    const token = localStorage.getItem('casino_token');

    setSpinning(true);
    setSpinResult(null);

    try {
      const res = await axios.post(`${API}/api/bonuses/daily-spin`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const { reward, newBalance } = res.data;

      // Trouver l'index du segment
      const idx = WHEEL_SEGMENTS.findIndex(s => s.amount === reward);
      const seg = (Math.PI * 2) / WHEEL_SEGMENTS.length;

      // Calculer l'angle final pour atterrir sur ce segment
      const targetAngle = -(idx * seg + seg / 2);
      const spins = 5 * Math.PI * 2;
      const finalRot = targetAngle + spins;

      // Animation
      const duration = 4000;
      const start = Date.now();
      const startRot = rotation;

      const animate = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        const current = startRot + (finalRot - startRot) * eased;
        setRotation(current);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setSpinResult(reward);
          updateUser({ balance: newBalance });
          toast.success(`🎉 Roue de la Fortune : +${formatBalance(reward)} !`);
          setSpinStatus({ canSpin: false, nextSpinAt: null, lastReward: reward });
          const next = new Date();
          next.setDate(next.getDate() + 1);
          next.setHours(0, 0, 0, 0);
          setSpinStatus({ canSpin: false, nextSpinAt: next.toISOString(), lastReward: reward });
          setSpinning(false);
        }
      };
      requestAnimationFrame(animate);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Erreur lors du spin');
      setSpinning(false);
    }
  }

  async function claimBailout() {
    const token = localStorage.getItem('casino_token');
    try {
      const res = await axios.post(`${API}/api/bonuses/bailout`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      updateUser({ balance: res.data.newBalance });
      setBailoutLeft(res.data.usagesLeft);
      toast.success(`💰 +1 000 F€ de l'État Fictif ! (${res.data.usagesLeft} restante${res.data.usagesLeft > 1 ? 's' : ''} aujourd'hui)`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Erreur');
    }
  }

  async function requestLoan() {
    const token = localStorage.getItem('casino_token');
    try {
      const res = await axios.post(`${API}/api/bonuses/loans/request`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      updateUser({ balance: res.data.newBalance });
      setHasLoan(true);
      toast.success(`🏦 10 000 F€ empruntés ! Remboursement automatique: 12 000 F€`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Erreur');
    }
  }

  if (!user) return null;

  const canBailout = user.balance < 100 && bailoutLeft > 0;

  return (
    <div className="min-h-screen bg-casino-dark">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 pt-20 pb-8">
        <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          🎁 Bonus & Succès
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Roue de la Fortune ─────────────────────────────── */}
          <div className="casino-card p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              🎡 Roue de la Fortune
              <span className="text-xs text-gray-400 font-normal">— 1 spin/jour</span>
            </h2>

            <div className="relative flex justify-center mb-4">
              <canvas ref={canvasRef} width={260} height={260} className="rounded-full" />
            </div>

            {spinResult && (
              <div className="text-center text-casino-gold font-black text-2xl mb-3 animate-bounce">
                +{formatBalance(spinResult)} !
              </div>
            )}

            {spinStatus.canSpin ? (
              <button
                onClick={spin}
                disabled={spinning}
                className="w-full bg-casino-gold hover:bg-casino-gold-light text-black font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {spinning ? '🎡 En cours...' : '🎡 Tourner la roue !'}
              </button>
            ) : (
              <div className="text-center text-gray-400 text-sm">
                {countdown ? (
                  <>Prochain spin dans <span className="text-casino-gold font-bold">{countdown}</span></>
                ) : (
                  'Reviens demain !'
                )}
                {spinStatus.lastReward && (
                  <div className="text-xs mt-1 text-gray-500">
                    Dernier gain : {formatBalance(spinStatus.lastReward)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Aide & Prêts ────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Bailout */}
            <div className="casino-card p-5">
              <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                🏛️ Aide de l'État Fictif
              </h2>
              <p className="text-gray-400 text-sm mb-4">
                Si ton solde tombe sous 100 F€, l'État peut t'aider jusqu'à 3 fois par jour.
              </p>

              <div className="flex items-center gap-3 mb-4">
                <div className="text-2xl font-bold text-white">{formatBalance(user.balance)}</div>
                <div className="text-xs text-gray-500">solde actuel</div>
              </div>

              <div className="flex gap-1 mb-4">
                {[0, 1, 2].map(i => (
                  <div key={i} className={clsx(
                    'flex-1 h-2 rounded-full',
                    i < bailoutLeft ? 'bg-green-500' : 'bg-gray-700'
                  )} />
                ))}
              </div>
              <div className="text-xs text-gray-500 mb-4">{bailoutLeft}/3 aides restantes aujourd'hui</div>

              <button
                onClick={claimBailout}
                disabled={!canBailout}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {user.balance >= 100 ? '🔒 Solde trop élevé (> 100 F€)' :
                  bailoutLeft <= 0 ? '✗ Limite journalière atteinte' :
                  '🏛️ Demander +1 000 F€'}
              </button>
            </div>

            {/* Prêt d'État */}
            <div className="casino-card p-5">
              <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                🏦 Prêt de l'État
                <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">+20% intérêts</span>
              </h2>
              <p className="text-gray-400 text-sm mb-4">
                Emprunte 10 000 F€. 12 000 F€ seront automatiquement déduits de tes prochains gains.
              </p>

              {hasLoan ? (
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm text-center py-3 rounded-lg">
                  ⚠️ Prêt en cours — Remboursement automatique sur tes gains
                </div>
              ) : (
                <button
                  onClick={requestLoan}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded-lg transition-colors"
                >
                  🏦 Emprunter 10 000 F€
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Succès ──────────────────────────────────────────────── */}
        <div className="casino-card p-6 mt-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            🏆 Succès
            <span className="text-sm text-gray-400 font-normal">
              {achievements.filter(a => a.earned).length}/{achievements.length} débloqués
            </span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map(ach => (
              <div key={ach.id} className={clsx(
                'relative p-4 rounded-xl border transition-all',
                ach.earned
                  ? 'border-casino-gold/40 bg-casino-gold/5'
                  : 'border-casino-border bg-casino-darker opacity-60'
              )}>
                <div className="text-3xl mb-2">{ach.icon}</div>
                <div className={clsx('font-bold text-sm', ach.earned ? 'text-casino-gold' : 'text-gray-400')}>
                  {ach.name}
                </div>
                <div className="text-xs text-gray-500 mt-1">{ach.description}</div>
                {ach.reward > 0 && (
                  <div className="text-xs text-green-400 mt-2">+{formatBalance(ach.reward)}</div>
                )}
                {ach.earned && ach.earnedAt && (
                  <div className="text-xs text-gray-600 mt-2">
                    Obtenu le {new Date(ach.earnedAt).toLocaleDateString('fr-FR')}
                  </div>
                )}
                {ach.earned && (
                  <div className="absolute top-3 right-3 text-casino-gold text-lg">✓</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
