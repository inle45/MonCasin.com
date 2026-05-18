'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Navbar from '@/components/layout/Navbar';
import ChatPanel from '@/components/chat/ChatPanel';
import { formatBalance, formatMultiplier } from '@/lib/api';
import { CrashBet } from '@/types';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

interface CrashPoint { x: number; y: number; }

export default function CrashPage() {
  const { user, updateUser, isLoading } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<CrashPoint[]>([]);
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [gameState, setGameState] = useState<'waiting' | 'running' | 'crashed'>('waiting');
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [waitTime, setWaitTime] = useState(8);
  const [history, setHistory] = useState<number[]>([]);
  const [bets, setBets] = useState<CrashBet[]>([]);
  const [shaking, setShaking] = useState(false);
  const [crashed, setCrashed] = useState(false);

  const [betAmount, setBetAmount] = useState('100');
  const [hasBet, setHasBet] = useState(false);
  const [myCashedOut, setMyCashedOut] = useState(false);
  const [myBetAmount, setMyBetAmount] = useState(0);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const isCrashed = gameState === 'crashed';
    const green = '#10b981';
    const red = '#ef4444';
    const lineColor = isCrashed ? red : green;

    ctx.clearRect(0, 0, W, H);

    // Fond radial premium : vert sombre ou rouge sombre selon état
    const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.65, 0, W * 0.5, H * 0.65, W * 0.8);
    if (isCrashed) {
      bgGrad.addColorStop(0, '#1a0606');
      bgGrad.addColorStop(0.5, '#0d0303');
      bgGrad.addColorStop(1, '#030303');
    } else {
      bgGrad.addColorStop(0, '#041a06');
      bgGrad.addColorStop(0.5, '#030d04');
      bgGrad.addColorStop(1, '#020302');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Grille subtile
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = H - (H / 5) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let i = 1; i <= 4; i++) {
      const x = (W / 4) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    const points = pointsRef.current;
    if (points.length < 2) return;

    // ── Traînée de particules lumineuses ────────────────────
    const trail = points.slice(-25);
    for (let i = 0; i < trail.length; i++) {
      const progress = i / (trail.length - 1);
      const alpha = progress * 0.75;
      const radius = 1 + progress * 5;

      ctx.save();
      ctx.beginPath();
      ctx.arc(trail[i].x, trail[i].y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isCrashed
        ? `rgba(239,68,68,${alpha})`
        : `rgba(16,185,129,${alpha})`;
      ctx.shadowBlur = radius * 5;
      ctx.shadowColor = lineColor;
      ctx.fill();
      ctx.restore();
    }

    // ── Courbe principale avec néon ─────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);

    ctx.shadowBlur = 18;
    ctx.shadowColor = lineColor;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();

    // ── Remplissage dégradé sous la courbe ──────────────────
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.lineTo(points[points.length - 1].x, H);
    ctx.lineTo(points[0].x, H);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, isCrashed ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)');
    grad.addColorStop(0.6, isCrashed ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // ── Point actif (gros halo) ──────────────────────────────
    const last = points[points.length - 1];
    // Halo extérieur
    ctx.save();
    const haloGrad = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 22);
    haloGrad.addColorStop(0, isCrashed ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.5)');
    haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(last.x, last.y, 22, 0, Math.PI * 2);
    ctx.fillStyle = haloGrad;
    ctx.fill();
    ctx.restore();

    // Point central
    ctx.save();
    ctx.beginPath();
    ctx.arc(last.x, last.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.shadowBlur = 20;
    ctx.shadowColor = lineColor;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }, [gameState]);

  // Déclenche screen shake + re-draw au crash
  const triggerCrashEffect = useCallback(() => {
    setShaking(true);
    setCrashed(true);
    if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
    shakeTimeoutRef.current = setTimeout(() => setShaking(false), 600);
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('init', (data) => {
      if (data.crashState) {
        setGameState(data.crashState.state);
        setMultiplier(data.crashState.multiplier);
        setBets(data.crashState.bets || []);
        setHistory(data.crashState.history || []);
      }
    });

    socket.on('crash:waiting', (data) => {
      setGameState('waiting');
      setMultiplier(1.0);
      setCrashPoint(null);
      setBets([]);
      setHasBet(false);
      setMyCashedOut(false);
      setMyBetAmount(0);
      setWaitTime(data.waitTime || 8);
      setHistory(data.history || []);
      setCrashed(false);
      pointsRef.current = [];
    });

    socket.on('crash:started', () => {
      setGameState('running');
      setCrashed(false);
      pointsRef.current = [];
    });

    socket.on('crash:tick', (data) => {
      setMultiplier(data.multiplier);

      const canvas = canvasRef.current;
      if (canvas) {
        const W = canvas.width;
        const H = canvas.height;
        const t = (data.multiplier - 1) / 50;
        const x = Math.min(t * W, W - 10);
        const y = H - Math.min((data.multiplier - 1) / 10 * H * 0.9, H - 20);
        pointsRef.current.push({ x, y });
        if (pointsRef.current.length === 1) {
          pointsRef.current.unshift({ x: 0, y: H });
        }
      }
      drawCanvas();
    });

    socket.on('crash:crashed', (data) => {
      setGameState('crashed');
      setCrashPoint(data.crashPoint);
      triggerCrashEffect();

      if (hasBet && !myCashedOut) {
        toast.error(`💥 CRASH à ${formatMultiplier(data.crashPoint)} ! Tu as perdu ${formatBalance(myBetAmount)}`);
      }
      drawCanvas();
    });

    socket.on('crash:bet_placed', (data) => {
      setBets(prev => [...prev, { userId: data.userId, pseudo: data.pseudo, amount: data.amount, cashedOut: false }]);
    });

    socket.on('crash:cashed_out', (data) => {
      setBets(prev => prev.map(b => b.userId === data.userId ? { ...b, cashedOut: true } : b));
    });

    socket.on('crash:bet_confirmed', (data) => {
      updateUser({ balance: data.newBalance });
      setHasBet(true);
      setMyBetAmount(data.amount);
      toast.success(`Mise de ${formatBalance(data.amount)} placée !`);
    });

    socket.on('crash:cashout_confirmed', (data) => {
      updateUser({ balance: data.newBalance });
      setMyCashedOut(true);
      toast.success(`🎉 Retiré à ${formatMultiplier(data.multiplier)} ! Gain : ${formatBalance(data.winAmount)}`);
    });

    socket.on('error', (data) => toast.error(data.message));

    return () => {
      socket.off('init');
      socket.off('crash:waiting');
      socket.off('crash:started');
      socket.off('crash:tick');
      socket.off('crash:crashed');
      socket.off('crash:bet_placed');
      socket.off('crash:cashed_out');
      socket.off('crash:bet_confirmed');
      socket.off('crash:cashout_confirmed');
      socket.off('error');
    };
  }, [socket, hasBet, myCashedOut, myBetAmount, drawCanvas, updateUser, triggerCrashEffect]);

  const placeBet = () => {
    if (!socket || hasBet || gameState !== 'waiting') return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Montant invalide'); return; }
    if (amount > (user?.balance || 0)) { toast.error('Solde insuffisant'); return; }
    socket.emit('crash:bet', { amount });
  };

  const cashOut = () => {
    if (!socket || !hasBet || myCashedOut || gameState !== 'running') return;
    socket.emit('crash:cashout');
  };

  const multiplierColor = gameState === 'crashed' ? 'text-red-400' :
    multiplier >= 5  ? 'text-yellow-400' :
    multiplier >= 2  ? 'text-green-400' : 'text-white';

  if (!user) return null;

  return (
    <div className="min-h-screen bg-casino-dark">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 pt-20 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Jeu principal ──────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Canvas + multiplicateur */}
            <div className={clsx(
              'casino-card p-4 transition-all duration-100',
              crashed && 'crash-crashed-card',
            )}>
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  🚀 Crash Game
                  <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">LIVE</span>
                </h1>
                <div className="text-sm text-gray-400">{formatBalance(user.balance)}</div>
              </div>

              {/* Canvas avec screen shake */}
              <div className={clsx(
                'relative',
                shaking && 'animate-screen-shake',
              )}>
                <canvas
                  ref={canvasRef}
                  width={700}
                  height={280}
                  className="w-full rounded-lg"
                />

                {/* Overlay multiplicateur */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {gameState === 'waiting' ? (
                    <div className="text-center">
                      <div className="text-5xl font-black text-white animate-pulse">{waitTime}s</div>
                      <div className="text-gray-400 mt-1 text-sm">Prochaine partie dans...</div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className={clsx(
                        'font-black transition-colors drop-shadow-lg',
                        multiplierColor,
                        multiplier >= 10 ? 'text-7xl' : 'text-6xl',
                      )}
                        style={{
                          textShadow: gameState === 'crashed'
                            ? '0 0 30px rgba(239,68,68,0.8)'
                            : multiplier >= 5
                              ? '0 0 30px rgba(234,179,8,0.8)'
                              : '0 0 20px rgba(16,185,129,0.6)',
                        }}
                      >
                        {formatMultiplier(multiplier)}
                      </div>
                      {gameState === 'crashed' && (
                        <div className="text-red-400 text-xl font-bold mt-2 animate-bounce">
                          💥 CRASH !
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Historique */}
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {history.map((h, i) => (
                  <span key={i} className={clsx(
                    'text-xs px-2 py-1 rounded font-bold transition-all',
                    h < 2   ? 'bg-red-500/20 text-red-400' :
                    h < 5   ? 'bg-green-500/20 text-green-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  )}>
                    {formatMultiplier(h)}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Contrôles ────────────────────────────────── */}
            <div className="casino-card p-4 space-y-3">
              <label className="block text-xs text-gray-400">Mise (F€)</label>

              <div className="flex gap-2">
                <input
                  type="number"
                  value={betAmount}
                  onChange={e => setBetAmount(e.target.value)}
                  disabled={hasBet || gameState !== 'waiting'}
                  className="w-24 bg-casino-darker border border-casino-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-casino-gold focus:shadow-[0_0_10px_rgba(245,158,11,0.3)] transition-shadow disabled:opacity-50"
                  min="1"
                />
                <div className="flex gap-1 flex-wrap flex-1">
                  {['50', '100', '500', '1000'].map(v => (
                    <button
                      key={v}
                      onClick={() => setBetAmount(v)}
                      disabled={hasBet || gameState !== 'waiting'}
                      className={clsx(
                        'flex-1 text-xs border rounded py-2 transition-all disabled:opacity-50',
                        betAmount === v
                          ? 'border-casino-gold bg-casino-gold/20 text-casino-gold shadow-[0_0_10px_rgba(245,158,11,0.35)]'
                          : 'bg-casino-darker border-casino-border text-gray-300 hover:border-casino-gold hover:text-white'
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {gameState === 'waiting' && !hasBet && (
                <button
                  onClick={placeBet}
                  className="w-full bg-casino-gold hover:bg-casino-gold-light text-black font-bold py-3 rounded-lg transition-all text-lg btn-gold-glow"
                >
                  🎰 Miser {betAmount} F€
                </button>
              )}

              {hasBet && !myCashedOut && gameState === 'running' && (
                <button
                  onClick={cashOut}
                  className="w-full bg-green-500 hover:bg-green-400 text-white font-black py-4 rounded-lg text-xl animate-pulse btn-green-glow"
                >
                  💰 RETIRER — {formatMultiplier(multiplier)}
                </button>
              )}

              {hasBet && gameState === 'waiting' && (
                <div className="w-full text-center bg-casino-gold/10 border border-casino-gold/30 text-casino-gold font-bold py-3 rounded-lg">
                  ✓ Mise placée : {formatBalance(myBetAmount)}
                </div>
              )}

              {myCashedOut && (
                <div className="w-full text-center bg-green-500/10 border border-green-500/30 text-green-400 font-bold py-3 rounded-lg">
                  ✓ Retiré avec succès !
                </div>
              )}
            </div>

            {/* ── Table des mises ───────────────────────────── */}
            <div className="casino-card p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Joueurs en jeu ({bets.length})</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {bets.map(bet => (
                  <div key={bet.userId} className="flex items-center justify-between text-sm">
                    <span className="text-white">{bet.pseudo}</span>
                    <span className="text-casino-gold">{formatBalance(bet.amount)}</span>
                    {bet.cashedOut && <span className="text-green-400 text-xs glow-green rounded px-1">✓ Retiré</span>}
                  </div>
                ))}
                {bets.length === 0 && <p className="text-gray-500 text-xs">Aucune mise pour l&apos;instant</p>}
              </div>
            </div>
          </div>

          {/* ── Chat (caché mobile) ───────────────────────── */}
          <div className="hidden lg:block h-[calc(100vh-8rem)] min-h-[500px]">
            <ChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
