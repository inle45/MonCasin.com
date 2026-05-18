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

interface CrashPoint {
  x: number;
  y: number;
}

export default function CrashPage() {
  const { user, updateUser, isLoading } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<CrashPoint[]>([]);
  const animFrameRef = useRef<number>(0);

  const [gameState, setGameState] = useState<'waiting' | 'running' | 'crashed'>('waiting');
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [waitTime, setWaitTime] = useState(8);
  const [history, setHistory] = useState<number[]>([]);
  const [bets, setBets] = useState<CrashBet[]>([]);

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

    ctx.clearRect(0, 0, W, H);

    // Fond
    ctx.fillStyle = '#050a05';
    ctx.fillRect(0, 0, W, H);

    // Grille
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = H - (H / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    const points = pointsRef.current;
    if (points.length < 2) return;

    // Courbe principale
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    const isCrashed = gameState === 'crashed';
    gradient.addColorStop(0, isCrashed ? 'rgba(239,68,68,0.8)' : 'rgba(16,185,129,0.8)');
    gradient.addColorStop(1, isCrashed ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)');

    ctx.strokeStyle = isCrashed ? '#ef4444' : '#10b981';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Remplissage sous la courbe
    ctx.lineTo(points[points.length - 1].x, H);
    ctx.lineTo(points[0].x, H);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Point actuel
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = isCrashed ? '#ef4444' : '#10b981';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [gameState]);

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
      pointsRef.current = [];
    });

    socket.on('crash:started', () => {
      setGameState('running');
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
  }, [socket, hasBet, myCashedOut, myBetAmount, drawCanvas, updateUser]);

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
    multiplier >= 5 ? 'text-yellow-400' :
    multiplier >= 2 ? 'text-green-400' : 'text-white';

  if (!user) return null;

  return (
    <div className="min-h-screen bg-casino-dark">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 pt-20 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Jeu principal */}
          <div className="lg:col-span-2 space-y-4">
            {/* Canvas */}
            <div className="casino-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  🚀 Crash Game
                  <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">LIVE</span>
                </h1>
                <div className="text-sm text-gray-400">{formatBalance(user.balance)}</div>
              </div>

              {/* Multiplicateur central */}
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={700}
                  height={280}
                  className="w-full rounded-lg crash-canvas"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {gameState === 'waiting' ? (
                    <div className="text-center">
                      <div className="text-5xl font-black text-white animate-pulse">{waitTime}s</div>
                      <div className="text-gray-400 mt-1">Prochaine partie dans...</div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className={clsx('text-6xl font-black transition-colors', multiplierColor)}>
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
              <div className="flex gap-2 mt-3 flex-wrap">
                {history.map((h, i) => (
                  <span key={i} className={clsx(
                    'text-xs px-2 py-1 rounded font-bold',
                    h < 2 ? 'bg-red-500/20 text-red-400' :
                    h < 5 ? 'bg-green-500/20 text-green-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  )}>
                    {formatMultiplier(h)}
                  </span>
                ))}
              </div>
            </div>

            {/* Contrôles */}
            <div className="casino-card p-4 space-y-3">
              <label className="block text-xs text-gray-400">Mise (F€)</label>

              {/* Input + chips sur une ligne */}
              <div className="flex gap-2">
                <input
                  type="number"
                  value={betAmount}
                  onChange={e => setBetAmount(e.target.value)}
                  disabled={hasBet || gameState !== 'waiting'}
                  className="w-24 bg-casino-darker border border-casino-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-casino-gold disabled:opacity-50"
                  min="1"
                />
                <div className="flex gap-1 flex-wrap flex-1">
                  {['50', '100', '500', '1000'].map(v => (
                    <button
                      key={v}
                      onClick={() => setBetAmount(v)}
                      disabled={hasBet || gameState !== 'waiting'}
                      className={clsx(
                        'flex-1 text-xs border rounded py-2 transition-colors disabled:opacity-50',
                        betAmount === v
                          ? 'border-casino-gold bg-casino-gold/20 text-casino-gold'
                          : 'bg-casino-darker border-casino-border text-gray-300 hover:border-casino-gold'
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bouton action pleine largeur */}
              {gameState === 'waiting' && !hasBet && (
                <button
                  onClick={placeBet}
                  className="w-full bg-casino-gold hover:bg-casino-gold-light text-black font-bold py-3 rounded-lg transition-colors text-lg"
                >
                  🎰 Miser {betAmount} F€
                </button>
              )}

              {hasBet && !myCashedOut && gameState === 'running' && (
                <button
                  onClick={cashOut}
                  className="w-full bg-green-500 hover:bg-green-400 text-white font-black py-4 rounded-lg transition-colors animate-pulse text-xl"
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

            {/* Table des mises */}
            <div className="casino-card p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Joueurs en jeu ({bets.length})</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {bets.map(bet => (
                  <div key={bet.userId} className="flex items-center justify-between text-sm">
                    <span className="text-white">{bet.pseudo}</span>
                    <span className="text-casino-gold">{formatBalance(bet.amount)}</span>
                    {bet.cashedOut && <span className="text-green-400 text-xs">✓ Retiré</span>}
                  </div>
                ))}
                {bets.length === 0 && <p className="text-gray-500 text-xs">Aucune mise pour l&apos;instant</p>}
              </div>
            </div>
          </div>

          {/* Chat — caché sur mobile */}
          <div className="hidden lg:block h-[calc(100vh-8rem)] min-h-[500px]">
            <ChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
