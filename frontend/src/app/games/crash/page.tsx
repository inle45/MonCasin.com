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
import { sfx } from '@/lib/sfx';

interface CrashPoint { x: number; y: number; }
interface Particle { x: number; y: number; vx: number; vy: number; alpha: number; radius: number; color: string; }

// ── Rocket SVG ──────────────────────────────────────────────────────────────
function RocketSVG({ size = 36, crashed = false }: { size?: number; crashed?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" style={{ filter: crashed ? 'drop-shadow(0 0 8px #ef4444)' : 'drop-shadow(0 0 12px #10b981)' }}>
      {/* Flamme */}
      {!crashed && (
        <>
          <ellipse cx="18" cy="31" rx="4" ry="6" fill="#f97316" opacity="0.9" className="rocket-flame"/>
          <ellipse cx="18" cy="30" rx="2.5" ry="4" fill="#fbbf24" opacity="0.8"/>
        </>
      )}
      {/* Corps fusée */}
      <ellipse cx="18" cy="18" rx="6" ry="11" fill={crashed ? '#7f1d1d' : '#1e3a5f'}/>
      <ellipse cx="18" cy="18" rx="5" ry="10" fill={crashed ? '#991b1b' : '#1d4ed8'}/>
      {/* Nez */}
      <path d="M12 12 Q18 2 24 12 Z" fill={crashed ? '#ef4444' : '#60a5fa'}/>
      {/* Fenêtre */}
      <circle cx="18" cy="15" r="3" fill={crashed ? '#450a0a' : '#0ea5e9'}/>
      <circle cx="18" cy="15" r="2" fill={crashed ? '#7f1d1d' : '#38bdf8'}/>
      <circle cx="17" cy="14" r="0.8" fill="rgba(255,255,255,0.6)"/>
      {/* Ailerons */}
      <path d="M12 24 L8 30 L12 28 Z" fill={crashed ? '#7f1d1d' : '#1e40af'}/>
      <path d="M24 24 L28 30 L24 28 Z" fill={crashed ? '#7f1d1d' : '#1e40af'}/>
      {/* Détails */}
      <rect x="16" y="19" width="4" height="2" rx="1" fill={crashed ? '#450a0a' : '#0ea5e9'} opacity="0.7"/>
    </svg>
  );
}

// ── Stars background ─────────────────────────────────────────────────────────
function Stars() {
  const stars = useRef(
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.8 + 0.4,
      dur: (Math.random() * 3 + 2).toFixed(1),
      delay: (Math.random() * 4).toFixed(1),
    }))
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.current.map(s => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            animation: `star-twinkle ${s.dur}s ${s.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── Neon city skyline ────────────────────────────────────────────────────────
function CitySkyline({ crashed }: { crashed: boolean }) {
  const color = crashed ? '#7f1d1d' : '#0f172a';
  const glow = crashed ? '#ef444430' : '#1d4ed830';
  return (
    <svg viewBox="0 0 700 80" preserveAspectRatio="none" className="absolute bottom-0 left-0 right-0 w-full" style={{ height: 80 }}>
      <defs>
        <linearGradient id="citygrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={glow}/>
          <stop offset="100%" stopColor={color}/>
        </linearGradient>
      </defs>
      <path d="M0,80 L0,55 L20,55 L20,35 L30,35 L30,45 L50,45 L50,20 L60,20 L60,45 L75,45 L75,30 L85,30 L85,45 L100,45 L100,55 L120,55 L120,35 L135,35 L135,20 L145,20 L145,35 L160,35 L160,50 L175,50 L175,25 L190,25 L190,15 L200,15 L200,25 L215,25 L215,50 L230,50 L230,35 L245,35 L245,45 L260,45 L260,30 L275,30 L275,45 L290,45 L290,55 L310,55 L310,30 L325,30 L325,40 L340,40 L340,18 L355,18 L355,10 L365,10 L365,18 L380,18 L380,40 L395,40 L395,55 L415,55 L415,35 L430,35 L430,25 L445,25 L445,35 L460,35 L460,50 L475,50 L475,30 L490,30 L490,45 L510,45 L510,55 L525,55 L525,38 L540,38 L540,28 L550,28 L550,38 L565,38 L565,50 L580,50 L580,35 L595,35 L595,48 L615,48 L615,55 L630,55 L630,40 L645,40 L645,28 L655,28 L655,40 L670,40 L670,55 L690,55 L690,65 L700,65 L700,80 Z" fill="url(#citygrad)"/>
      {/* Building windows */}
      {[55,80,195,355,445,540,650].map((bx, i) => (
        <g key={i}>
          <rect x={bx+2} y={crashed ? 22 : 12} width="3" height="3" fill={crashed ? '#ef444440' : '#60a5fa40'} rx="0.5"/>
          <rect x={bx+7} y={crashed ? 22 : 12} width="3" height="3" fill={crashed ? '#ef444440' : '#93c5fd30'} rx="0.5"/>
          <rect x={bx+2} y={crashed ? 28 : 18} width="3" height="3" fill={crashed ? '#ef444450' : '#3b82f660'} rx="0.5"/>
        </g>
      ))}
    </svg>
  );
}

// ── Neon grid floor ──────────────────────────────────────────────────────────
function NeonGrid({ crashed }: { crashed: boolean }) {
  const color = crashed ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.12)';
  return (
    <svg viewBox="0 0 700 60" preserveAspectRatio="none" className="absolute bottom-0 left-0 right-0 w-full" style={{ height: 60 }}>
      {/* Horizontal lines with perspective */}
      {[0,15,28,39,48,55,60].map((y, i) => (
        <line key={i} x1="0" y1={y} x2="700" y2={y} stroke={color} strokeWidth={i === 6 ? 1.5 : 0.8}/>
      ))}
      {/* Vertical lines converging to center */}
      {[-200,-100,-40,0,40,100,200,300,400,500,600,700,800,900].map((xOff, i) => (
        <line key={i} x1={350 + xOff * 0.15} y1={0} x2={350 + xOff} y2={60} stroke={color} strokeWidth="0.8"/>
      ))}
    </svg>
  );
}

export default function CrashPage() {
  const { user, updateUser, isLoading } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<CrashPoint[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [gameState, setGameState] = useState<'waiting' | 'running' | 'crashed'>('waiting');
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [waitTime, setWaitTime] = useState(8);
  const [countdown, setCountdown] = useState(8);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [bets, setBets] = useState<CrashBet[]>([]);
  const [shaking, setShaking] = useState(false);
  const [crashed, setCrashed] = useState(false);
  const [reactions, setReactions] = useState<{ id: string; pseudo: string; emoji: string }[]>([]);
  const [flashRed, setFlashRed] = useState(false);

  const [betAmount, setBetAmount] = useState('100');
  const [hasBet, setHasBet] = useState(false);
  const [myCashedOut, setMyCashedOut] = useState(false);
  const [myBetAmount, setMyBetAmount] = useState(0);

  // Rocket position on screen
  const [rocketPos, setRocketPos] = useState<{ x: number; y: number; angle: number }>({ x: 0, y: 0, angle: -45 });

  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  // CSS animations injection
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes star-twinkle {
        0%,100% { opacity:0.2; transform:scale(1); }
        50% { opacity:1; transform:scale(1.4); }
      }
      @keyframes rocket-flame {
        0%,100% { transform:scaleY(1) scaleX(1); }
        50% { transform:scaleY(1.3) scaleX(0.8); }
      }
      .rocket-flame { animation: rocket-flame 0.15s ease-in-out infinite; transform-origin: center bottom; }
      @keyframes crash-flash {
        0% { opacity:0.6; }
        100% { opacity:0; }
      }
      @keyframes crash-shake {
        0%,100% { transform:translate(0,0) rotate(0deg); }
        10% { transform:translate(-8px,4px) rotate(-1deg); }
        20% { transform:translate(8px,-4px) rotate(1deg); }
        30% { transform:translate(-6px,6px) rotate(-0.5deg); }
        40% { transform:translate(6px,-2px) rotate(0.5deg); }
        50% { transform:translate(-4px,4px) rotate(-0.5deg); }
        60% { transform:translate(4px,0px) rotate(0deg); }
        70% { transform:translate(-2px,2px); }
        80% { transform:translate(2px,0); }
      }
      .crash-shake { animation: crash-shake 0.6s cubic-bezier(.36,.07,.19,.97); }
      @keyframes multiplier-pulse {
        0%,100% { transform:scale(1); }
        50% { transform:scale(1.04); }
      }
      @keyframes cashout-pulse {
        0%,100% { box-shadow:0 0 20px rgba(16,185,129,0.4); transform:scale(1); }
        50% { box-shadow:0 0 40px rgba(16,185,129,0.8); transform:scale(1.02); }
      }
      .cashout-btn { animation: cashout-pulse 0.8s ease-in-out infinite; }
      @keyframes countdown-ring {
        from { stroke-dashoffset: 0; }
      }
      @keyframes bet-glow {
        0%,100% { box-shadow:0 0 15px rgba(245,158,11,0.3); }
        50% { box-shadow:0 0 30px rgba(245,158,11,0.7); }
      }
      @keyframes neon-scan {
        0% { transform: translateY(-100%); opacity:0; }
        10% { opacity:0.5; }
        90% { opacity:0.5; }
        100% { transform: translateY(100%); opacity:0; }
      }
      .neon-scan { animation: neon-scan 3s linear infinite; }
      @keyframes float-reaction {
        0% { transform:translateY(0) scale(0); opacity:1; }
        100% { transform:translateY(-60px) scale(1.5); opacity:0; }
      }
      @keyframes winner-glow {
        0%,100% { text-shadow: 0 0 20px rgba(234,179,8,0.8), 0 0 40px rgba(234,179,8,0.4); }
        50% { text-shadow: 0 0 40px rgba(234,179,8,1), 0 0 80px rgba(234,179,8,0.6), 0 0 120px rgba(234,179,8,0.3); }
      }
      @keyframes crash-text {
        0% { transform:scale(0.5); opacity:0; }
        60% { transform:scale(1.2); }
        100% { transform:scale(1); opacity:1; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const spawnExplosion = useCallback((x: number, y: number) => {
    const colors = ['#ef4444','#f97316','#fbbf24','#dc2626','#ff6b6b','#fff'];
    for (let i = 0; i < 60; i++) {
      const angle = (Math.PI * 2 * i) / 60 + Math.random() * 0.3;
      const speed = Math.random() * 6 + 2;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 3,
        alpha: 1,
        radius: Math.random() * 4 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }, []);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const isCrashed = gameStateRef.current === 'crashed';
    const green = '#10b981';
    const red = '#ef4444';
    const lineColor = isCrashed ? red : green;

    ctx.clearRect(0, 0, W, H);

    // Deep space background
    const bgGrad = ctx.createRadialGradient(W * 0.3, H * 0.3, 0, W * 0.5, H * 0.5, W);
    if (isCrashed) {
      bgGrad.addColorStop(0, '#1c0000');
      bgGrad.addColorStop(0.4, '#0d0000');
      bgGrad.addColorStop(1, '#020000');
    } else {
      bgGrad.addColorStop(0, '#000818');
      bgGrad.addColorStop(0.4, '#000510');
      bgGrad.addColorStop(1, '#000205');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid lines
    ctx.strokeStyle = isCrashed ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const y = H - (H / 6) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let i = 1; i <= 5; i++) {
      const x = (W / 5) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    // Update & draw particles
    particlesRef.current = particlesRef.current.filter(p => p.alpha > 0.02);
    for (const p of particlesRef.current) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.alpha *= 0.94;
      p.vx *= 0.98;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = p.radius * 3;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.restore();
    }

    const points = pointsRef.current;
    if (points.length < 2) return;

    // Gradient fill under curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.lineTo(points[points.length - 1].x, H);
    ctx.lineTo(points[0].x, H);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
    fillGrad.addColorStop(0, isCrashed ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)');
    fillGrad.addColorStop(0.5, isCrashed ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)');
    fillGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Glow trail particles
    const trail = points.slice(-30);
    for (let i = 0; i < trail.length; i++) {
      const t = i / (trail.length - 1);
      ctx.save();
      ctx.beginPath();
      ctx.arc(trail[i].x, trail[i].y, 1 + t * 6, 0, Math.PI * 2);
      ctx.fillStyle = isCrashed ? `rgba(239,68,68,${t * 0.7})` : `rgba(16,185,129,${t * 0.7})`;
      ctx.shadowBlur = (1 + t * 6) * 4;
      ctx.shadowColor = lineColor;
      ctx.fill();
      ctx.restore();
    }

    // Main curve — triple layered glow
    for (let pass = 0; pass < 3; pass++) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = pass === 0 ? 8 : pass === 1 ? 4 : 2.5;
      ctx.shadowBlur = pass === 0 ? 30 : pass === 1 ? 15 : 5;
      ctx.shadowColor = lineColor;
      ctx.globalAlpha = pass === 0 ? 0.2 : pass === 1 ? 0.5 : 1;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // Rocket at tip (stored for overlay positioning)
    const last = points[points.length - 1];
    const prev = points[points.length - 3] || points[0];
    const angle = Math.atan2(last.y - prev.y, last.x - prev.x);

    // Convert canvas coords to percent for overlay rocket
    setRocketPos({ x: (last.x / W) * 100, y: (last.y / H) * 100, angle: angle * (180 / Math.PI) - 90 });

    // Big halo at tip
    const halo = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 30);
    halo.addColorStop(0, isCrashed ? 'rgba(239,68,68,0.6)' : 'rgba(16,185,129,0.5)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(last.x, last.y, 30, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.fill();
  }, []);

  const animLoop = useCallback(() => {
    if (particlesRef.current.length > 0) drawCanvas();
    animFrameRef.current = requestAnimationFrame(animLoop);
  }, [drawCanvas]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(animLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [animLoop]);

  const triggerCrashEffect = useCallback((x: number, y: number) => {
    setShaking(true);
    setFlashRed(true);
    setCrashed(true);
    if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
    shakeTimeoutRef.current = setTimeout(() => { setShaking(false); setFlashRed(false); }, 700);
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
      const wt = data.waitTime || 8;
      setWaitTime(wt);
      setCountdown(wt);
      setHistory(data.history || []);
      setCrashed(false);
      pointsRef.current = [];
      particlesRef.current = [];
      setRocketPos({ x: 0, y: 0, angle: -45 });

      if (countdownRef.current) clearInterval(countdownRef.current);
      let remaining = wt;
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(Math.max(0, remaining));
        if (remaining <= 0) { if (countdownRef.current) clearInterval(countdownRef.current); }
      }, 1000);
    });

    socket.on('crash:started', () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setGameState('running');
      setCrashed(false);
      pointsRef.current = [];
      particlesRef.current = [];
      sfx.click();
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
        if (pointsRef.current.length === 1) pointsRef.current.unshift({ x: 0, y: H });
      }
      drawCanvas();
    });

    socket.on('crash:crashed', (data) => {
      setGameState('crashed');
      setCrashPoint(data.crashPoint);
      const canvas = canvasRef.current;
      const last = pointsRef.current[pointsRef.current.length - 1];
      if (last) spawnExplosion(last.x, last.y);
      triggerCrashEffect(last?.x || 0, last?.y || 0);
      sfx.crashBoom();
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
      sfx.cashout();
      toast.success(`🎉 Retiré à ${formatMultiplier(data.multiplier)} ! Gain : ${formatBalance(data.winAmount)}`);
    });

    socket.on('error', (data) => toast.error(data.message));

    socket.on('crash:reaction', (data: { id: string; pseudo: string; emoji: string }) => {
      setReactions(prev => [...prev.slice(-10), data]);
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== data.id)), 2500);
    });

    return () => {
      socket.off('init'); socket.off('crash:waiting'); socket.off('crash:started');
      socket.off('crash:tick'); socket.off('crash:crashed'); socket.off('crash:bet_placed');
      socket.off('crash:cashed_out'); socket.off('crash:bet_confirmed');
      socket.off('crash:cashout_confirmed'); socket.off('error'); socket.off('crash:reaction');
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [socket, hasBet, myCashedOut, myBetAmount, drawCanvas, updateUser, triggerCrashEffect, spawnExplosion]);

  const placeBet = () => {
    if (!socket || hasBet || gameState !== 'waiting') return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Montant invalide'); return; }
    if (amount > (user?.balance || 0)) { toast.error('Solde insuffisant'); return; }
    sfx.click();
    socket.emit('crash:bet', { amount });
  };

  const cashOut = () => {
    if (!socket || !hasBet || myCashedOut || gameState !== 'running') return;
    socket.emit('crash:cashout');
  };

  const multColor =
    gameState === 'crashed' ? '#ef4444' :
    multiplier >= 10 ? '#f59e0b' :
    multiplier >= 5  ? '#34d399' :
    multiplier >= 2  ? '#10b981' : '#ffffff';

  const multGlow =
    gameState === 'crashed' ? '0 0 40px rgba(239,68,68,0.9), 0 0 80px rgba(239,68,68,0.5)' :
    multiplier >= 10 ? '0 0 40px rgba(245,158,11,0.9), 0 0 80px rgba(245,158,11,0.5)' :
    multiplier >= 5  ? '0 0 30px rgba(52,211,153,0.8), 0 0 60px rgba(52,211,153,0.4)' :
    '0 0 20px rgba(16,185,129,0.6)';

  if (!user) return null;

  const hasMoney = (user.balance || 0) >= parseFloat(betAmount || '0');

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #000008 0%, #000d1a 50%, #00080d 100%)' }}>
      <Navbar />

      {/* Red flash overlay on crash */}
      {flashRed && (
        <div
          className="fixed inset-0 z-40 pointer-events-none"
          style={{ background: 'rgba(239,68,68,0.15)', animation: 'crash-flash 0.6s ease-out forwards' }}
        />
      )}

      <div className="max-w-7xl mx-auto px-3 pt-16 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Main arena ──────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-3">

            {/* Canvas + HUD */}
            <div
              className={clsx('relative rounded-2xl overflow-hidden', shaking && 'crash-shake')}
              style={{
                background: 'linear-gradient(180deg, #000818 0%, #000510 100%)',
                border: crashed
                  ? '1px solid rgba(239,68,68,0.4)'
                  : '1px solid rgba(16,185,129,0.2)',
                boxShadow: crashed
                  ? '0 0 40px rgba(239,68,68,0.2), inset 0 0 60px rgba(239,68,68,0.05)'
                  : '0 0 40px rgba(16,185,129,0.1), inset 0 0 60px rgba(16,185,129,0.03)',
                transition: 'border-color 0.3s, box-shadow 0.3s',
              }}
            >
              {/* Stars */}
              <Stars />

              {/* Neon scan line */}
              <div
                className="neon-scan absolute left-0 right-0 h-px pointer-events-none z-10"
                style={{ background: crashed ? 'linear-gradient(90deg,transparent,rgba(239,68,68,0.4),transparent)' : 'linear-gradient(90deg,transparent,rgba(16,185,129,0.3),transparent)' }}
              />

              {/* Canvas */}
              <div className="relative" style={{ paddingBottom: '44%' }}>
                <canvas
                  ref={canvasRef}
                  width={700}
                  height={308}
                  className="absolute inset-0 w-full h-full"
                />

                {/* City skyline */}
                <div className="absolute inset-0 pointer-events-none">
                  <CitySkyline crashed={crashed} />
                </div>

                {/* Neon grid floor */}
                <div className="absolute inset-0 pointer-events-none">
                  <NeonGrid crashed={crashed} />
                </div>

                {/* Rocket SVG overlay — follows curve tip */}
                {gameState === 'running' && rocketPos.x > 0 && (
                  <div
                    className="absolute pointer-events-none z-20"
                    style={{
                      left: `${rocketPos.x}%`,
                      top: `${rocketPos.y}%`,
                      transform: `translate(-50%, -50%) rotate(${rocketPos.angle}deg)`,
                      transition: 'left 0.08s linear, top 0.08s linear',
                    }}
                  >
                    <RocketSVG size={40} crashed={false} />
                  </div>
                )}
                {gameState === 'crashed' && rocketPos.x > 0 && (
                  <div
                    className="absolute pointer-events-none z-20"
                    style={{ left: `${rocketPos.x}%`, top: `${rocketPos.y}%`, transform: 'translate(-50%,-50%) rotate(90deg)' }}
                  >
                    <RocketSVG size={44} crashed />
                  </div>
                )}

                {/* Central multiplier overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                  {gameState === 'waiting' ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative w-28 h-28">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"/>
                          <circle
                            cx="50" cy="50" r="44" fill="none"
                            stroke="#f59e0b" strokeWidth="7"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 44}`}
                            strokeDashoffset={`${2 * Math.PI * 44 * (1 - countdown / waitTime)}`}
                            style={{ transition: 'stroke-dashoffset 0.9s linear', filter: 'drop-shadow(0 0 6px #f59e0b)' }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-4xl font-black text-white leading-none">{countdown}</div>
                          <div className="text-xs text-gray-400 mt-0.5 font-medium">sec</div>
                        </div>
                      </div>
                      <div className="text-gray-300 text-sm font-semibold tracking-wider uppercase">Prochaine partie</div>
                      {hasBet && (
                        <div
                          className="text-casino-gold text-xs font-black px-4 py-1.5 rounded-full border"
                          style={{ borderColor: 'rgba(245,158,11,0.5)', background: 'rgba(245,158,11,0.1)', boxShadow: '0 0 15px rgba(245,158,11,0.3)', animation: 'bet-glow 1.5s ease-in-out infinite' }}
                        >
                          ✓ MISE PLACÉE — EN ATTENTE
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div
                        className="font-black tabular-nums tracking-tight"
                        style={{
                          color: multColor,
                          fontSize: multiplier >= 100 ? '4rem' : multiplier >= 10 ? '5rem' : '6rem',
                          textShadow: multGlow,
                          animation: gameState === 'running' ? 'multiplier-pulse 0.5s ease-in-out infinite' : undefined,
                        }}
                      >
                        {formatMultiplier(multiplier)}
                      </div>
                      {gameState === 'crashed' && (
                        <div
                          className="text-red-400 text-2xl font-black tracking-widest uppercase mt-1"
                          style={{ animation: 'crash-text 0.3s ease-out', textShadow: '0 0 20px rgba(239,68,68,0.8)' }}
                        >
                          💥 CRASHED
                        </div>
                      )}
                      {myCashedOut && gameState === 'running' && (
                        <div className="text-green-400 text-sm font-black mt-2 bg-green-400/10 px-4 py-1 rounded-full border border-green-400/30">
                          ✓ Retiré !
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Floating emoji reactions */}
                <div className="absolute bottom-4 left-4 flex gap-2 flex-wrap z-20 pointer-events-none">
                  {reactions.map(r => (
                    <span
                      key={r.id}
                      className="text-2xl"
                      style={{ animation: 'float-reaction 2.5s ease-out forwards' }}
                    >
                      {r.emoji}
                    </span>
                  ))}
                </div>

                {/* Live badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 z-20">
                  <div className={clsx('w-2 h-2 rounded-full', gameState === 'running' ? 'bg-red-500' : 'bg-gray-500')} style={gameState === 'running' ? { animation: 'multiplier-pulse 0.8s infinite' } : {}}/>
                  <span className="text-xs font-bold text-gray-300 tracking-widest uppercase">Live</span>
                </div>

                {/* Reaction buttons */}
                <div className="absolute top-3 right-3 flex gap-1 z-20">
                  {['😱','🔥','💀','🚀','😂','💸'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => socket?.emit('crash:reaction', { emoji })}
                      className="text-lg hover:scale-125 transition-transform active:scale-90 select-none"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* History bar */}
              <div className="flex gap-1.5 px-4 py-3 border-t flex-wrap" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                {history.slice(0, 15).map((h, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-md font-black"
                    style={{
                      background: h < 2 ? 'rgba(239,68,68,0.15)' : h < 5 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: h < 2 ? '#f87171' : h < 5 ? '#34d399' : '#fbbf24',
                      border: `1px solid ${h < 2 ? 'rgba(239,68,68,0.2)' : h < 5 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    }}
                  >
                    {formatMultiplier(h)}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Betting controls ──────────────────────────────────── */}
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{
                background: 'rgba(0,8,24,0.9)',
                border: '1px solid rgba(16,185,129,0.15)',
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* Amount row */}
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={betAmount}
                    onChange={e => setBetAmount(e.target.value)}
                    disabled={hasBet || gameState !== 'waiting'}
                    className="w-full rounded-xl px-4 py-3 text-white font-black text-lg focus:outline-none disabled:opacity-40 transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                    }}
                    min="1"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-sm font-bold">F€</span>
                </div>
                <div className="text-right text-xs text-gray-500">
                  Solde<br/>
                  <span className="text-casino-gold font-bold">{formatBalance(user.balance)}</span>
                </div>
              </div>

              {/* Quick bet chips */}
              <div className="grid grid-cols-5 gap-2">
                {['50','100','500','1000','5000'].map(v => (
                  <button
                    key={v}
                    onClick={() => setBetAmount(v)}
                    disabled={hasBet || gameState !== 'waiting'}
                    className="py-2 rounded-xl text-xs font-black transition-all disabled:opacity-30"
                    style={{
                      background: betAmount === v ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                      border: betAmount === v ? '1px solid rgba(16,185,129,0.6)' : '1px solid rgba(255,255,255,0.08)',
                      color: betAmount === v ? '#34d399' : '#9ca3af',
                      boxShadow: betAmount === v ? '0 0 12px rgba(16,185,129,0.3)' : 'none',
                    }}
                  >
                    {parseInt(v) >= 1000 ? `${parseInt(v)/1000}k` : v}
                  </button>
                ))}
              </div>

              {/* CTA button */}
              {gameState === 'waiting' && !hasBet && (
                <button
                  onClick={placeBet}
                  disabled={!hasMoney}
                  className="w-full py-4 rounded-xl font-black text-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #065f46, #10b981)',
                    color: '#fff',
                    boxShadow: '0 0 25px rgba(16,185,129,0.4), 0 4px 15px rgba(0,0,0,0.5)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(52,211,153,0.4)',
                  }}
                >
                  🚀 &nbsp;Miser {parseFloat(betAmount || '0').toLocaleString('fr-FR')} F€
                </button>
              )}

              {hasBet && !myCashedOut && gameState === 'running' && (
                <button
                  onClick={cashOut}
                  className="cashout-btn w-full py-5 rounded-xl font-black text-xl transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #065f46, #059669)',
                    color: '#fff',
                    border: '2px solid rgba(52,211,153,0.7)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  💰 &nbsp;RETIRER — {formatMultiplier(multiplier)}
                  <div className="text-sm font-bold opacity-75 mt-0.5">
                    {formatBalance(myBetAmount * multiplier)}
                  </div>
                </button>
              )}

              {hasBet && gameState === 'waiting' && (
                <div
                  className="w-full text-center font-black py-3 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', animation: 'bet-glow 1.5s ease-in-out infinite' }}
                >
                  ✓ Mise de {formatBalance(myBetAmount)} placée
                </div>
              )}

              {myCashedOut && (
                <div
                  className="w-full text-center font-black py-3 rounded-xl"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}
                >
                  ✓ Retiré avec succès !
                </div>
              )}

              {gameState === 'crashed' && !myCashedOut && hasBet && (
                <div
                  className="w-full text-center font-black py-3 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                >
                  💥 Perdu — {formatBalance(myBetAmount)}
                </div>
              )}
            </div>

            {/* ── Players table ─────────────────────────────────────── */}
            <div
              className="rounded-2xl p-4"
              style={{ background: 'rgba(0,8,24,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Joueurs</h3>
                <span className="text-xs font-black text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">{bets.length} actifs</span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {bets.length === 0 && <p className="text-gray-600 text-xs text-center py-4">Aucune mise pour l&apos;instant</p>}
                {bets.map(bet => (
                  <div
                    key={bet.userId}
                    className="flex items-center justify-between text-sm rounded-lg px-3 py-2"
                    style={{
                      background: bet.cashedOut ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                      border: bet.cashedOut ? '1px solid rgba(16,185,129,0.15)' : '1px solid transparent',
                    }}
                  >
                    <span className={bet.cashedOut ? 'text-green-400 font-bold' : 'text-gray-300'}>{bet.pseudo}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-casino-gold font-bold">{formatBalance(bet.amount)}</span>
                      {bet.cashedOut && <span className="text-green-400 text-xs font-black">✓ OUT</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Chat ─────────────────────────────────────────────────── */}
          <div className="hidden lg:block h-[calc(100vh-8rem)] min-h-[500px]">
            <ChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
