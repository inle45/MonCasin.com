'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Navbar from '@/components/layout/Navbar';
import ChatPanel from '@/components/chat/ChatPanel';
import { formatBalance } from '@/lib/api';
import { RouletteBetItem } from '@/types';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { sfx } from '@/lib/sfx';

// ── Roulette constants ───────────────────────────────────────────────────────
const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const WHEEL_ORDER  = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const NUMBERS_LAYOUT = [
  [3,6,9,12,15,18,21,24,27,30,33,36],
  [2,5,8,11,14,17,20,23,26,29,32,35],
  [1,4,7,10,13,16,19,22,25,28,31,34],
];
const SEG  = (Math.PI * 2) / 37;
const TILT = 0.50; // Y-scale factor → 60° perspective tilt

const CHIP_DEFS = [
  { value: 10,   bg: '#475569', glow: '#94a3b8', label: '10'  },
  { value: 50,   bg: '#1e40af', glow: '#3b82f6', label: '50'  },
  { value: 100,  bg: '#991b1b', glow: '#ef4444', label: '100' },
  { value: 500,  bg: '#065f46', glow: '#10b981', label: '500' },
  { value: 1000, bg: '#92400e', glow: '#f59e0b', label: '1K'  },
  { value: 5000, bg: '#5b21b6', glow: '#8b5cf6', label: '5K'  },
];

function numColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
}

const PLAYER_COLORS: Record<string, string> = {
  'Inlé':'#f59e0b','Louis':'#ef4444','Amaury':'#8b5cf6','Noah':'#3b82f6','Matthieu':'#10b981',
};
function getPC(pseudo: string) { return PLAYER_COLORS[pseudo] || '#06b6d4'; }

interface ChipStack { userId: string; pseudo: string; amount: number; color: string; }

interface WheelAnim {
  wheelAngle:    number;
  ballAngle:     number;
  ballFalling:   number;   // 0 = outer track, 1 = inside slot
  wheelVel:      number;
  ballVel:       number;
  phase:         'idle' | 'spinning' | 'decelerating' | 'landing' | 'stopped';
  winSegIdx:     number;
  decelFrames:   number;
  landingFrames: number;
}

// ── 3-D wheel drawing function (module-level, pure canvas) ───────────────────
function drawRouletteWheel(
  ctx:    CanvasRenderingContext2D,
  W:      number,
  H:      number,
  ws:     WheelAnim,
) {
  const { wheelAngle, ballAngle, ballFalling, phase, winSegIdx } = ws;
  const cx = W / 2;
  const cy = H * 0.52;
  // Radius bounded so the full ellipse fits in the canvas
  const R = Math.min(W * 0.43, (H * 0.88) / (2 * TILT));

  ctx.clearRect(0, 0, W, H);

  // ── Deep green felt background ──────────────────────────────────────────
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.9);
  bg.addColorStop(0,   '#081508');
  bg.addColorStop(0.6, '#040c04');
  bg.addColorStop(1,   '#020502');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Everything inside this save/restore is perspective-projected ─────────
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, TILT);

  // Outer ambient glow
  const aura = ctx.createRadialGradient(0, 0, R * 0.7, 0, 0, R * 1.25);
  aura.addColorStop(0, 'rgba(245,158,11,0.0)');
  aura.addColorStop(1, 'rgba(245,158,11,0.12)');
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.25, 0, Math.PI * 2);
  ctx.fillStyle = aura;
  ctx.fill();

  // Drop shadow under wheel
  ctx.beginPath();
  ctx.arc(0, R * 0.06, R * 1.05, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 35;
  ctx.shadowColor = 'rgba(0,0,0,1)';
  ctx.fill();
  ctx.shadowBlur = 0;

  // Mahogany outer surround
  const wood = ctx.createRadialGradient(-R * 0.12, -R * 0.12, 0, 0, 0, R * 1.05);
  wood.addColorStop(0,   '#7c3a00');
  wood.addColorStop(0.4, '#4a1f00');
  wood.addColorStop(1,   '#1a0800');
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.04, 0, Math.PI * 2);
  ctx.fillStyle = wood;
  ctx.fill();

  // Gold outer ring
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.03, 0, Math.PI * 2);
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.975, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(251,191,36,0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Ball track channel (dark)
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.94, 0, Math.PI * 2);
  const track = ctx.createRadialGradient(0, 0, R * 0.83, 0, 0, R * 0.96);
  track.addColorStop(0, '#0f0500');
  track.addColorStop(1, '#1a0800');
  ctx.fillStyle = track;
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,50,0,0.6)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // ── Colored number segments ─────────────────────────────────────────────
  for (let i = 0; i < 37; i++) {
    const a0   = wheelAngle + i * SEG - Math.PI / 2;
    const a1   = a0 + SEG;
    const n    = WHEEL_ORDER[i];
    const win  = (phase === 'landing' || phase === 'stopped') && winSegIdx === i;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R * 0.88, a0, a1);
    ctx.closePath();

    if      (n === 0)                    ctx.fillStyle = win ? '#22c55e' : '#15803d';
    else if (RED_NUMBERS.includes(n))    ctx.fillStyle = win ? '#f87171' : '#991b1b';
    else                                 ctx.fillStyle = win ? '#4b5563' : '#0f172a';

    if (win) { ctx.shadowBlur = 20; ctx.shadowColor = n === 0 ? '#22c55e' : '#ef4444'; }
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Thin dividers between segments
  for (let i = 0; i < 37; i++) {
    const a = wheelAngle + i * SEG - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(R * 0.47 * Math.cos(a), R * 0.47 * Math.sin(a));
    ctx.lineTo(R * 0.88 * Math.cos(a), R * 0.88 * Math.sin(a));
    ctx.strokeStyle = 'rgba(212,175,55,0.22)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  // Fret pins (metal separator between each slot and track)
  for (let i = 0; i < 37; i++) {
    const a  = wheelAngle + (i + 0.5) * SEG - Math.PI / 2;
    const fx = R * 0.895 * Math.cos(a);
    const fy = R * 0.895 * Math.sin(a);
    const fg = ctx.createRadialGradient(fx - R*0.004, fy - R*0.004, 0, fx, fy, R * 0.014);
    fg.addColorStop(0, '#e8c96e');
    fg.addColorStop(1, '#8b6914');
    ctx.beginPath();
    ctx.arc(fx, fy, R * 0.014, 0, Math.PI * 2);
    ctx.fillStyle = fg;
    ctx.fill();
  }

  // ── Inner hub area ──────────────────────────────────────────────────────
  const hub = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.45);
  hub.addColorStop(0,   '#5c2a0a');
  hub.addColorStop(0.6, '#2d1000');
  hub.addColorStop(1,   '#100600');
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = hub;
  ctx.fill();
  ctx.strokeStyle = 'rgba(245,158,11,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 8 decorative spokes
  for (let i = 0; i < 8; i++) {
    const sa = wheelAngle + i * Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(R * 0.17 * Math.cos(sa), R * 0.17 * Math.sin(sa));
    ctx.lineTo(R * 0.42 * Math.cos(sa), R * 0.42 * Math.sin(sa));
    ctx.strokeStyle = '#c07a30bb';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Gold center boss with radial gradient
  const boss = ctx.createRadialGradient(-R * 0.04, -R * 0.04, 0, 0, 0, R * 0.15);
  boss.addColorStop(0,   '#fef3c7');
  boss.addColorStop(0.5, '#d97706');
  boss.addColorStop(1,   '#78350f');
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = boss;
  ctx.shadowBlur = 18;
  ctx.shadowColor = 'rgba(245,158,11,0.7)';
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(0, 0, R * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = '#0f0600';
  ctx.fill();

  ctx.restore(); // end perspective transform

  // ── Number labels (drawn in screen space to avoid squished text) ─────────
  const fontSize = Math.max(9, Math.floor(R * 0.068));
  for (let i = 0; i < 37; i++) {
    const midA  = wheelAngle + i * SEG + SEG / 2 - Math.PI / 2;
    const textR = R * 0.685;
    const tx    = cx + textR * Math.cos(midA);
    const ty    = cy + textR * Math.sin(midA) * TILT;
    const n     = WHEEL_ORDER[i];
    const win   = (phase === 'landing' || phase === 'stopped') && winSegIdx === i;

    ctx.save();
    ctx.translate(tx, ty);
    // Rotate text to face "outward" in the perspective-projected plane
    const projA = Math.atan2(Math.sin(midA) * TILT, Math.cos(midA));
    ctx.rotate(projA + Math.PI / 2);
    // Un-squish vertically so text reads naturally
    ctx.scale(1, 1 / TILT);

    ctx.font        = `bold ${win ? Math.floor(fontSize * 1.15) : fontSize}px Arial`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    if (win) {
      ctx.shadowBlur  = 12;
      ctx.shadowColor = n === 0 ? '#22c55e' : RED_NUMBERS.includes(n) ? '#f87171' : '#ffffff';
      ctx.fillStyle   = '#ffffff';
    } else {
      ctx.fillStyle   = 'rgba(255,255,255,0.88)';
      ctx.shadowBlur  = 2;
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
    }
    ctx.fillText(n.toString(), 0, 0);
    ctx.restore();
  }

  // ── Ball ─────────────────────────────────────────────────────────────────
  if (phase !== 'idle') {
    const outerR  = R * 0.925;
    const slotR   = R * 0.71;
    const currentR = outerR - ballFalling * (outerR - slotR);
    const heightAbove = (1 - ballFalling) * R * 0.16;

    // Interpolate ballAngle → target slot angle as it falls
    let ba = ballAngle;
    if (ballFalling > 0 && winSegIdx >= 0) {
      const targetA = wheelAngle + winSegIdx * SEG + SEG / 2 - Math.PI / 2;
      let diff = targetA - ballAngle;
      while (diff > Math.PI)  diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ba = ballAngle + diff * ballFalling;
    }

    const bx = cx + currentR * Math.cos(ba);
    const by = cy + currentR * Math.sin(ba) * TILT - heightAbove * TILT;

    // Elliptical shadow under ball
    ctx.beginPath();
    ctx.ellipse(bx, by + heightAbove * TILT * 0.5 + 2, 6.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();

    // Ball with glossy gradient
    const ballG = ctx.createRadialGradient(bx - 2, by - 2.5, 0.5, bx, by, 7);
    ballG.addColorStop(0,   '#ffffff');
    ballG.addColorStop(0.45, '#d8d8d8');
    ballG.addColorStop(1,   '#808080');
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fillStyle = ballG;
    ctx.shadowBlur  = 16;
    ctx.shadowColor = 'rgba(255,255,255,0.6)';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Specular highlight
    ctx.beginPath();
    ctx.arc(bx - 2.2, by - 2.8, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
  }
}

// ── Chip button component ────────────────────────────────────────────────────
function ChipBtn({ chip, selected, onClick }: { chip: typeof CHIP_DEFS[0]; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative w-12 h-12 rounded-full flex items-center justify-center font-black text-xs text-white transition-all"
      style={{
        background: `radial-gradient(circle at 35% 30%, ${chip.bg}ee, ${chip.bg}99)`,
        border: `3px dashed ${chip.glow}bb`,
        boxShadow: selected
          ? `0 0 22px ${chip.glow}, 0 0 8px ${chip.glow}, 0 4px 12px rgba(0,0,0,0.6)`
          : '0 4px 12px rgba(0,0,0,0.5)',
        transform: selected ? 'translateY(-5px) scale(1.12)' : undefined,
      }}
    >
      {chip.label}
      {/* Chip edge segments decoration */}
      <div className="absolute inset-0.5 rounded-full" style={{ border: `1px solid ${chip.glow}44`, pointerEvents: 'none' }} />
    </button>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function RoulettePage() {
  const { user, updateUser, isLoading } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastSegRef   = useRef(-1);
  const spinSoundRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animState = useRef<WheelAnim>({
    wheelAngle: 0, ballAngle: 0, ballFalling: 0,
    wheelVel: 0, ballVel: 0,
    phase: 'idle', winSegIdx: -1,
    decelFrames: 0, landingFrames: 0,
  });

  const [gameState,  setGameState]  = useState<'betting' | 'spinning' | 'result'>('betting');
  const [countdown,  setCountdown]  = useState(15);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [winColor,   setWinColor]   = useState<string | null>(null);
  const [history,    setHistory]    = useState<{ number: number; color: string }[]>([]);
  const [showResult, setShowResult] = useState(false);

  const [selectedBets, setSelectedBets] = useState<RouletteBetItem[]>([]);
  const [chipAmount,   setChipAmount]   = useState(100);
  const [betSent,      setBetSent]      = useState(false);
  const [lastResult,   setLastResult]   = useState<{ win: number; bet: number } | null>(null);
  const [playerChips,  setPlayerChips]  = useState<Record<string, ChipStack[]>>({});

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  // CSS animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes result-pop {
        0%   { transform:scale(0.3) rotate(-10deg); opacity:0; }
        70%  { transform:scale(1.15) rotate(2deg); opacity:1; }
        100% { transform:scale(1) rotate(0deg); }
      }
      @keyframes chip-drop {
        0%   { transform:translateY(-8px) scale(0.8); opacity:0; }
        100% { transform:translateY(0) scale(1); opacity:1; }
      }
      @keyframes number-glow {
        0%,100% { box-shadow:0 0 8px rgba(245,158,11,0.4); }
        50%      { box-shadow:0 0 20px rgba(245,158,11,0.9), 0 0 40px rgba(245,158,11,0.4); }
      }
      @keyframes felt-pulse {
        0%,100% { opacity:1; }
        50%     { opacity:0.85; }
      }
      @keyframes winning-flash {
        0%,100% { background: rgba(239,68,68,0.15); }
        50%     { background: rgba(239,68,68,0.3); }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // ── Animation loop ─────────────────────────────────────────────────────────
  const animLoop = useCallback(() => {
    const ws = animState.current;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Update physics
        if (ws.phase === 'spinning') {
          ws.wheelAngle += ws.wheelVel;
          ws.ballAngle  += ws.ballVel;
          // Tick sound when ball crosses a new segment boundary
          const seg = (((-ws.ballAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / SEG) | 0;
          if (seg !== lastSegRef.current) {
            sfx.tick(1);
            lastSegRef.current = seg;
          }
        } else if (ws.phase === 'decelerating') {
          ws.wheelVel   *= 0.987;
          ws.ballVel    *= 0.984;
          ws.wheelAngle += ws.wheelVel;
          ws.ballAngle  += ws.ballVel;
          ws.decelFrames--;
          // Tick sound, slowing
          const seg = (((-ws.ballAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / SEG) | 0;
          if (seg !== lastSegRef.current) {
            sfx.tick(1);
            lastSegRef.current = seg;
          }
          if (ws.decelFrames <= 0 || Math.abs(ws.ballVel) < 0.004) {
            ws.phase        = 'landing';
            ws.landingFrames = 50;
          }
        } else if (ws.phase === 'landing') {
          ws.landingFrames--;
          ws.ballFalling = 1 - ws.landingFrames / 50;
          if (ws.landingFrames <= 0) {
            ws.ballFalling = 1;
            ws.phase       = 'stopped';
            setShowResult(true);
          }
        }
        drawRouletteWheel(ctx, canvas.width, canvas.height, ws);
      }
    }
    animFrameRef.current = requestAnimationFrame(animLoop);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(animLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [animLoop]);

  // ── Socket events ──────────────────────────────────────────────────────────
  const clearAllChips = useCallback(() => setPlayerChips({}), []);

  useEffect(() => {
    if (!socket) return;

    socket.on('init', (data) => {
      if (data.rouletteState) {
        setGameState(data.rouletteState.state);
        setCountdown(data.rouletteState.countdown);
        setHistory(data.rouletteState.history || []);
      }
    });

    socket.on('roulette:betting', (data) => {
      setGameState('betting');
      setCountdown(data.countdown);
      setHistory(data.history || []);
      setWinningNumber(null);
      setWinColor(null);
      setSelectedBets([]);
      setBetSent(false);
      setLastResult(null);
      setShowResult(false);
      clearAllChips();
      const ws = animState.current;
      ws.phase        = 'idle';
      ws.ballFalling  = 0;
      ws.winSegIdx    = -1;
      ws.wheelVel     = 0;
      ws.ballVel      = 0;
    });

    socket.on('roulette:countdown', (data) => setCountdown(data.countdown));

    socket.on('roulette:spinning', () => {
      setGameState('spinning');
      setShowResult(false);
      const ws         = animState.current;
      ws.phase         = 'spinning';
      ws.ballFalling   = 0;
      ws.winSegIdx     = -1;
      ws.wheelVel      =  0.055;
      ws.ballVel       = -0.095;
      ws.ballAngle     = Math.random() * Math.PI * 2;
      lastSegRef.current = -1;
    });

    socket.on('roulette:result', (data) => {
      if (spinSoundRef.current) clearTimeout(spinSoundRef.current);
      setGameState('result');
      setWinningNumber(data.winningNumber);
      setWinColor(data.winColor);
      setHistory(prev => [{ number: data.winningNumber, color: data.winColor }, ...prev.slice(0, 19)]);

      // Start deceleration in animation, aiming for correct slot
      const winIdx         = WHEEL_ORDER.indexOf(data.winningNumber);
      const ws             = animState.current;
      ws.phase             = 'decelerating';
      ws.winSegIdx         = winIdx;
      ws.decelFrames       = 140; // ~2.3s at 60fps

      const myResult = data.results?.find((r: { userId: string; totalWin: number; totalBet: number }) => r.userId === user?.id);
      if (myResult) {
        setLastResult({ win: myResult.totalWin, bet: myResult.totalBet });
        updateUser({ balance: user!.balance - myResult.totalBet + myResult.totalWin });
        if (myResult.totalWin > 0) {
          myResult.totalWin >= 1000 ? sfx.bigWin() : sfx.win();
        } else if (myResult.totalBet > 0) {
          sfx.lose();
        }
      }
    });

    socket.on('roulette:bet_confirmed', (data) => {
      sfx.ping();
      updateUser({ balance: data.newBalance });
      setBetSent(true);
      toast.success(`Mise de ${formatBalance(data.totalBet)} confirmée !`);
    });

    socket.on('roulette:bet_placed', (data: { userId: string; pseudo: string; bets: RouletteBetItem[] }) => {
      const color = getPC(data.pseudo);
      setPlayerChips(prev => {
        const next = { ...prev };
        for (const bet of data.bets) {
          const key = `${bet.type}-${bet.value}`;
          const ex  = next[key] || [];
          const idx = ex.findIndex(c => c.userId === data.userId);
          if (idx >= 0) {
            const upd = [...ex];
            upd[idx] = { ...upd[idx], amount: upd[idx].amount + bet.amount };
            next[key] = upd;
          } else {
            next[key] = [...ex, { userId: data.userId, pseudo: data.pseudo, amount: bet.amount, color }];
          }
        }
        return next;
      });
    });

    socket.on('error', (data) => toast.error(data.message));

    return () => {
      socket.off('init'); socket.off('roulette:betting'); socket.off('roulette:countdown');
      socket.off('roulette:spinning'); socket.off('roulette:result');
      socket.off('roulette:bet_confirmed'); socket.off('roulette:bet_placed'); socket.off('error');
      if (spinSoundRef.current) clearTimeout(spinSoundRef.current);
    };
  }, [socket, user, updateUser, clearAllChips]);

  // ── Betting logic ──────────────────────────────────────────────────────────
  const addBet = (type: RouletteBetItem['type'], value: string | number) => {
    if (betSent || gameState !== 'betting') return;
    const total = selectedBets.reduce((s, b) => s + b.amount, 0);
    if (total + chipAmount > (user?.balance || 0)) { toast.error('Solde insuffisant'); return; }
    sfx.click();
    setSelectedBets(prev => {
      const ex = prev.find(b => b.type === type && b.value === value);
      if (ex) return prev.map(b => b.type === type && b.value === value ? { ...b, amount: b.amount + chipAmount } : b);
      return [...prev, { type, value, amount: chipAmount }];
    });
  };

  const clearBets = () => { if (!betSent) setSelectedBets([]); };

  const placeBets = () => {
    if (!socket || betSent || selectedBets.length === 0 || gameState !== 'betting') return;
    sfx.cashout();
    socket.emit('roulette:bet', { bets: selectedBets });
  };

  const myBetOn = (type: RouletteBetItem['type'], value: string | number) =>
    selectedBets.find(b => b.type === type && b.value === value)?.amount || 0;

  const othersOn = (type: string, value: string | number): ChipStack[] =>
    playerChips[`${type}-${value}`] || [];

  // Render chips overlay for a cell
  const renderChips = (type: string, value: string | number, myBet: number) => {
    const mine   = myBet > 0 ? [{ userId: user!.id, pseudo: user!.pseudo, amount: myBet, color: '#ffffff' }] : [];
    const others = othersOn(type, value).filter(c => c.userId !== user!.id);
    const all    = [...mine, ...others];
    if (all.length === 0) return null;
    return (
      <div className="absolute top-0.5 right-0.5 flex flex-col-reverse gap-px pointer-events-none z-10">
        {all.slice(0, 3).map((c, i) => (
          <div
            key={`${c.userId}-${i}`}
            title={`${c.pseudo}: ${c.amount} F€`}
            className="w-3 h-3 rounded-full border border-black/60 shadow"
            style={{
              background: c.color,
              boxShadow: `0 0 5px ${c.color}99`,
              animation: 'chip-drop 0.25s ease-out',
            }}
          />
        ))}
        {all.length > 3 && <span className="text-[8px] text-white font-black">+{all.length-3}</span>}
      </div>
    );
  };

  const totalBet = selectedBets.reduce((s, b) => s + b.amount, 0);

  if (!user) return null;

  const canBet = gameState === 'betting' && !betSent;

  return (
    <div className="min-h-screen" style={{ background: '#030d03' }}>
      <Navbar />
      <div className="max-w-7xl mx-auto px-3 pt-16 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Left: Wheel + Betting ──────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-3">

            {/* ── 3D Wheel canvas ─────────────────────────────────────────── */}
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #081508 0%, #030d03 100%)',
                border: '1px solid rgba(212,175,55,0.25)',
                boxShadow: '0 0 50px rgba(212,175,55,0.08), inset 0 0 80px rgba(0,0,0,0.4)',
              }}
            >
              {/* Live badge */}
              <div className="absolute top-3 left-4 flex items-center gap-1.5 z-20">
                <div className="w-2 h-2 rounded-full bg-red-500" style={{ animation: gameState === 'spinning' ? 'felt-pulse 0.6s infinite' : undefined }} />
                <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">Roulette Européenne</span>
              </div>

              {/* Phase badge + countdown */}
              <div className="absolute top-3 right-4 z-20">
                {gameState === 'betting' && (
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-black text-sm"
                    style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}
                  >
                    <div className="relative w-6 h-6">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(245,158,11,0.2)" strokeWidth="2.5"/>
                        <circle cx="12" cy="12" r="10" fill="none" stroke="#f59e0b" strokeWidth="2.5"
                          strokeDasharray={`${2*Math.PI*10}`}
                          strokeDashoffset={`${2*Math.PI*10*(1-countdown/15)}`}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black">{countdown}</span>
                    </div>
                    Mises ouvertes
                  </div>
                )}
                {gameState === 'spinning' && (
                  <div className="px-3 py-1.5 rounded-xl font-black text-sm text-blue-300"
                    style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
                    🎡 La bille tourne…
                  </div>
                )}
                {gameState === 'result' && winningNumber !== null && (
                  <div
                    className="px-3 py-1.5 rounded-xl font-black text-sm text-white"
                    style={{
                      background: winColor === 'red' ? 'rgba(185,28,28,0.3)' : winColor === 'green' ? 'rgba(22,101,52,0.3)' : 'rgba(30,30,30,0.5)',
                      border: `1px solid ${winColor === 'red' ? 'rgba(239,68,68,0.5)' : winColor === 'green' ? 'rgba(22,163,74,0.5)' : 'rgba(100,100,100,0.4)'}`,
                    }}
                  >
                    Résultat : {winningNumber}
                  </div>
                )}
              </div>

              {/* Canvas */}
              <canvas
                ref={canvasRef}
                width={600}
                height={350}
                className="w-full"
              />

              {/* Result overlay */}
              {showResult && winningNumber !== null && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                  <div
                    className="flex flex-col items-center gap-2"
                    style={{ animation: 'result-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
                  >
                    <div
                      className="w-28 h-28 rounded-full flex items-center justify-center text-6xl font-black text-white border-4"
                      style={{
                        background: winColor === 'red' ? 'radial-gradient(circle,#b91c1c,#7f1d1d)' :
                                     winColor === 'green' ? 'radial-gradient(circle,#15803d,#14532d)' :
                                     'radial-gradient(circle,#1f2937,#111827)',
                        borderColor: winColor === 'red' ? '#ef4444' : winColor === 'green' ? '#22c55e' : '#4b5563',
                        boxShadow: `0 0 40px ${winColor === 'red' ? 'rgba(239,68,68,0.7)' : winColor === 'green' ? 'rgba(34,197,94,0.7)' : 'rgba(75,85,99,0.5)'}`,
                      }}
                    >
                      {winningNumber}
                    </div>
                    {lastResult && (
                      <div
                        className="font-black text-xl px-5 py-2 rounded-xl"
                        style={{
                          background: lastResult.win > 0 ? 'rgba(21,128,61,0.9)' : 'rgba(153,27,27,0.9)',
                          color: lastResult.win > 0 ? '#86efac' : '#fca5a5',
                          boxShadow: lastResult.win > 0 ? '0 0 20px rgba(34,197,94,0.5)' : '0 0 20px rgba(239,68,68,0.5)',
                        }}
                      >
                        {lastResult.win > 0 ? `🎉 +${formatBalance(lastResult.win)}` : `💸 -${formatBalance(lastResult.bet)}`}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* History bar */}
              <div
                className="flex gap-1.5 px-4 py-2.5 flex-wrap border-t"
                style={{ borderColor: 'rgba(212,175,55,0.12)' }}
              >
                {history.slice(0, 16).map((h, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                    style={{
                      background: h.color === 'red' ? '#991b1b' : h.color === 'green' ? '#15803d' : '#111827',
                      border: `1px solid ${h.color === 'red' ? 'rgba(239,68,68,0.4)' : h.color === 'green' ? 'rgba(34,197,94,0.4)' : 'rgba(75,85,99,0.4)'}`,
                      boxShadow: i === 0 ? `0 0 10px ${h.color === 'red' ? 'rgba(239,68,68,0.6)' : h.color === 'green' ? 'rgba(34,197,94,0.6)' : 'rgba(75,85,99,0.5)'}` : 'none',
                    }}
                  >
                    {h.number}
                  </div>
                ))}
                {history.length === 0 && <span className="text-gray-600 text-xs">Aucun historique</span>}
              </div>
            </div>

            {/* ── Betting Table (felt) ─────────────────────────────────────── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'radial-gradient(ellipse at 50% 0%, #0d3d0d 0%, #072007 50%, #030d03 100%)',
                border: '2px solid rgba(212,175,55,0.3)',
                boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5), 0 0 30px rgba(0,0,0,0.4)',
              }}
            >
              {/* Chip selector */}
              <div
                className="px-4 py-3 flex items-center gap-3 border-b flex-wrap"
                style={{ borderColor: 'rgba(212,175,55,0.2)' }}
              >
                <span className="text-xs font-bold text-yellow-600 uppercase tracking-widest">Jeton</span>
                {CHIP_DEFS.map(chip => (
                  <ChipBtn
                    key={chip.value}
                    chip={chip}
                    selected={chipAmount === chip.value}
                    onClick={() => setChipAmount(chip.value)}
                  />
                ))}
                {betSent && (
                  <span className="ml-auto text-xs font-black text-green-400 bg-green-400/10 px-3 py-1 rounded-full border border-green-400/30">
                    ✓ Mises confirmées
                  </span>
                )}
              </div>

              <div className="p-3">
                {/* Number grid */}
                <div className="overflow-x-auto">
                  <div className="min-w-[400px]">
                    <div className="flex gap-[2px] mb-[2px]">
                      {/* Zero */}
                      <button
                        onClick={() => addBet('number', 0)}
                        disabled={!canBet}
                        className="relative flex items-center justify-center font-black text-sm text-white rounded transition-all disabled:opacity-50"
                        style={{
                          width: 44, minHeight: 90,
                          background: gameState === 'result' && winningNumber === 0
                            ? 'linear-gradient(135deg,#22c55e,#15803d)'
                            : 'linear-gradient(135deg,#166534,#14532d)',
                          border: myBetOn('number', 0) > 0 ? '2px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.15)',
                          boxShadow: gameState === 'result' && winningNumber === 0 ? '0 0 20px rgba(34,197,94,0.7)' : 'none',
                        }}
                      >
                        0
                        {renderChips('number', 0, myBetOn('number', 0))}
                      </button>

                      {/* 1-36 grid (3 rows × 12 cols) */}
                      <div className="flex-1 grid grid-cols-12 gap-[2px]">
                        {NUMBERS_LAYOUT.map((row, rIdx) => (
                          row.map(num => {
                            const isRed = RED_NUMBERS.includes(num);
                            const isWin = gameState === 'result' && winningNumber === num;
                            const hasBet = myBetOn('number', num) > 0;
                            return (
                              <button
                                key={num}
                                onClick={() => addBet('number', num)}
                                disabled={!canBet}
                                className="relative flex items-center justify-center font-black text-xs text-white rounded transition-all disabled:opacity-50"
                                style={{
                                  minHeight: 28,
                                  background: isWin
                                    ? `linear-gradient(135deg,${isRed ? '#f87171,#b91c1c' : '#6b7280,#374151'})`
                                    : isRed ? 'linear-gradient(135deg,#991b1b,#7f1d1d)' : 'linear-gradient(135deg,#111827,#0f172a)',
                                  border: hasBet ? '1.5px solid rgba(255,255,255,0.7)' : '1px solid rgba(255,255,255,0.08)',
                                  boxShadow: isWin ? `0 0 14px ${isRed ? 'rgba(239,68,68,0.7)' : 'rgba(107,114,128,0.7)'}` : 'none',
                                }}
                              >
                                {num}
                                {renderChips('number', num, myBetOn('number', num))}
                              </button>
                            );
                          })
                        ))}
                      </div>

                      {/* 2:1 column bets */}
                      <div className="flex flex-col gap-[2px]" style={{ width: 38 }}>
                        {[1,2,3].map(col => (
                          <button
                            key={col}
                            onClick={() => addBet('column', col)}
                            disabled={!canBet}
                            className="relative flex items-center justify-center text-[10px] font-black text-yellow-400 rounded flex-1 disabled:opacity-50"
                            style={{
                              background: myBetOn('column', col) > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.06)',
                              border: myBetOn('column', col) > 0 ? '1.5px solid rgba(245,158,11,0.5)' : '1px solid rgba(245,158,11,0.15)',
                            }}
                          >
                            2:1
                            {renderChips('column', col, myBetOn('column', col))}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* External bets */}
                    <div className="grid grid-cols-3 gap-[2px] mt-[2px]">
                      {[
                        { label: '1—12',  type: 'dozen',    val: 1 },
                        { label: '13—24', type: 'dozen',    val: 2 },
                        { label: '25—36', type: 'dozen',    val: 3 },
                      ].map(({ label, type, val }) => (
                        <button
                          key={label}
                          onClick={() => addBet(type as RouletteBetItem['type'], val)}
                          disabled={!canBet}
                          className="relative py-2 text-xs font-bold text-white rounded disabled:opacity-50"
                          style={{
                            background: myBetOn(type as RouletteBetItem['type'], val) > 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                            border: myBetOn(type as RouletteBetItem['type'], val) > 0 ? '1.5px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                          }}
                        >
                          {label}
                          {renderChips(type, val, myBetOn(type as RouletteBetItem['type'], val))}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-6 gap-[2px] mt-[2px]">
                      {([
                        { label: '1—18',  type: 'half',     val: 'first',  red: false },
                        { label: 'Pair',  type: 'even_odd', val: 'even',   red: false },
                        { label: '🔴',    type: 'color',    val: 'red',    red: true  },
                        { label: '⚫',   type: 'color',    val: 'black',  red: false },
                        { label: 'Impair',type: 'even_odd', val: 'odd',    red: false },
                        { label: '19—36', type: 'half',     val: 'second', red: false },
                      ] as { label: string; type: string; val: string; red: boolean }[]).map(({ label, type, val, red }) => {
                        const mb = myBetOn(type as RouletteBetItem['type'], val);
                        return (
                          <button
                            key={label}
                            onClick={() => addBet(type as RouletteBetItem['type'], val)}
                            disabled={!canBet}
                            className="relative py-2 text-xs font-bold text-white rounded disabled:opacity-50"
                            style={{
                              background: red
                                ? (mb > 0 ? 'rgba(185,28,28,0.7)' : 'rgba(153,27,27,0.5)')
                                : type === 'color' && val === 'black'
                                  ? (mb > 0 ? 'rgba(30,30,30,0.9)' : 'rgba(15,23,42,0.7)')
                                  : (mb > 0 ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)'),
                              border: mb > 0
                                ? red ? '1.5px solid rgba(239,68,68,0.6)' : '1.5px solid rgba(255,255,255,0.4)'
                                : red ? '1px solid rgba(185,28,28,0.4)' : '1px solid rgba(255,255,255,0.1)',
                            }}
                          >
                            {label}
                            {renderChips(type, val, mb)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions bar */}
              <div
                className="flex items-center gap-3 px-4 py-3 border-t flex-wrap"
                style={{ borderColor: 'rgba(212,175,55,0.2)' }}
              >
                <div className="text-sm text-gray-400">
                  Mise totale : <span
                    className="font-black"
                    style={{ color: totalBet > 0 ? '#f59e0b' : '#4b5563', textShadow: totalBet > 0 ? '0 0 12px rgba(245,158,11,0.5)' : 'none' }}
                  >
                    {formatBalance(totalBet)}
                  </span>
                </div>

                <button
                  onClick={clearBets}
                  disabled={betSent || selectedBets.length === 0}
                  className="text-sm text-red-400 hover:text-red-300 disabled:opacity-30 transition-colors"
                >
                  Effacer
                </button>

                <button
                  onClick={placeBets}
                  disabled={betSent || selectedBets.length === 0 || gameState !== 'betting'}
                  className="ml-auto px-6 py-2.5 rounded-xl font-black text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: betSent
                      ? 'rgba(21,128,61,0.3)'
                      : 'linear-gradient(135deg,#92400e,#d97706)',
                    color: betSent ? '#86efac' : '#fff',
                    border: betSent ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(251,191,36,0.5)',
                    boxShadow: !betSent && selectedBets.length > 0 ? '0 0 20px rgba(217,119,6,0.4)' : 'none',
                  }}
                >
                  {betSent ? '✓ Mises placées' : '🎲 Placer les mises'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Chat ──────────────────────────────────────────────────────── */}
          <div className="hidden lg:block h-[calc(100vh-8rem)] min-h-[500px]">
            <ChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
