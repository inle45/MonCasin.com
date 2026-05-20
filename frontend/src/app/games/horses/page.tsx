'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import toast from 'react-hot-toast';
import { sfx } from '@/lib/sfx';

interface Horse { id: number; name: string; emoji: string; color: string; odds: number; }
interface RaceResult {
  winner: Horse; chosenHorse: Horse; ranking: (Horse & { position: number })[];
  won: boolean; payout: number; profit: number; mise: number; odds: number; newBalance: number;
}

const BETS = [100, 500, 1000, 2500, 5000];

const JOCKEY_COLORS = ['#a855f7','#f59e0b','#ef4444','#06b6d4','#10b981','#f97316'];

// ── Inline CSS injected once ──────────────────────────────────────
const STYLES = `
@keyframes gallop {
  0%,100%{transform:scaleX(-1) translateY(0px) rotate(0deg)}
  20%{transform:scaleX(-1) translateY(-5px) rotate(2deg)}
  50%{transform:scaleX(-1) translateY(-2px) rotate(-1deg)}
  75%{transform:scaleX(-1) translateY(-6px) rotate(1deg)}
}
@keyframes dash-scroll {
  from{background-position:0 0}
  to{background-position:-80px 0}
}
@keyframes finish-pulse {
  0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(255,255,255,0.6),0 0 20px #f59e0b}
  50%{opacity:0.7;box-shadow:0 0 0 8px rgba(255,255,255,0),0 0 40px #fbbf24}
}
@keyframes crowd-sway {
  0%,100%{transform:scaleY(1)}
  50%{transform:scaleY(1.03)}
}
@keyframes star-twinkle {
  0%,100%{opacity:0.9;transform:scale(1)}
  50%{opacity:0.2;transform:scale(0.6)}
}
@keyframes dust {
  0%{opacity:0.7;transform:translateX(0) translateY(0) scale(1)}
  100%{opacity:0;transform:translateX(-40px) translateY(-8px) scale(0.1)}
}
@keyframes winner-burst {
  0%{opacity:0;transform:scale(0.5)}
  60%{transform:scale(1.15)}
  100%{opacity:1;transform:scale(1)}
}
@keyframes lane-glow {
  0%,100%{opacity:0.3}
  50%{opacity:0.7}
}
.horse-gallop{animation:gallop 0.35s ease-in-out infinite}
.dash-moving{animation:dash-scroll 0.3s linear infinite}
.finish-glow{animation:finish-pulse 1s ease-in-out infinite}
.star{animation:star-twinkle var(--dur,3s) ease-in-out infinite;animation-delay:var(--delay,0s)}
`;

// ── SVG horse silhouette ──────────────────────────────────────────
function HorseSVG({ color, size = 52, racing = false }: { color: string; size?: number; racing?: boolean }) {
  return (
    <div style={{ width: size, height: size * 0.7, position: 'relative', filter: `drop-shadow(0 0 ${racing ? 12 : 4}px ${color})` }}
      className={racing ? 'horse-gallop' : ''}>
      <svg viewBox="0 0 80 52" width={size} height={size * 0.7} style={{ transform: 'scaleX(-1)' }}>
        {/* Body */}
        <ellipse cx="34" cy="32" rx="22" ry="11" fill={color} />
        {/* Hindquarters */}
        <ellipse cx="14" cy="30" rx="11" ry="10" fill={color} />
        {/* Neck */}
        <path d="M50,25 L56,13 L63,24 Z" fill={color} />
        {/* Head */}
        <ellipse cx="63" cy="20" rx="10" ry="8" fill={color} transform="rotate(-10 63 20)" />
        {/* Muzzle */}
        <ellipse cx="71" cy="25" rx="7" ry="5" fill={color} transform="rotate(-10 71 25)" />
        {/* Ear */}
        <polygon points="57,11 61,5 64,10" fill={color} />
        {/* Eye */}
        <circle cx="67" cy="17" r="2.5" fill="#000" />
        <circle cx="66" cy="16" r="1" fill="#fff" opacity="0.6" />
        {/* Nostril */}
        <ellipse cx="73" cy="27" rx="2" ry="1.5" fill={`${color}80`} />
        {/* Tail */}
        <path d="M5,24 Q-6,16 0,6" stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M5,24 Q-4,20 2,12" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.5" />
        {/* Front legs */}
        <line x1="46" y1="40" x2="40" y2="51" stroke={color} strokeWidth="4.5" strokeLinecap="round" />
        <line x1="54" y1="38" x2="60" y2="49" stroke={color} strokeWidth="4.5" strokeLinecap="round" />
        {/* Back legs */}
        <line x1="18" y1="38" x2="12" y2="50" stroke={color} strokeWidth="4.5" strokeLinecap="round" />
        <line x1="28" y1="39" x2="34" y2="50" stroke={color} strokeWidth="4.5" strokeLinecap="round" />
        {/* Mane */}
        <path d="M52,14 Q48,7 52,3 Q54,8 56,5 Q57,10 58,7" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7" />
        {/* Jockey body */}
        <ellipse cx="36" cy="20" rx="8" ry="6" fill={color} opacity="0.85" />
        {/* Jockey head */}
        <circle cx="40" cy="12" r="5.5" fill={color} opacity="0.9" />
        {/* Jockey helmet peak */}
        <path d="M35,10 Q40,6 45,10" stroke={`${color}cc`} strokeWidth="3" fill="none" />
        {/* Reins */}
        <path d="M44,14 Q52,11 58,18" stroke={`${color}60`} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ── Stars background ──────────────────────────────────────────────
function Stars() {
  const stars = Array.from({ length: 40 }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    dur: 2 + Math.random() * 4,
    delay: Math.random() * 4,
    size: Math.random() > 0.8 ? 2 : 1,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((s, i) => (
        <div key={i} className="absolute rounded-full bg-white star"
          style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            '--dur': `${s.dur}s`, '--delay': `${s.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ── City skyline (SVG) ────────────────────────────────────────────
function CitySkyline({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 800 80" preserveAspectRatio="none" className="absolute bottom-0 left-0 right-0 w-full" style={{ height: 70 }}>
      <defs>
        <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <path fill="url(#sky-grad)" d="M0,80 L0,60 L30,60 L30,45 L50,45 L50,35 L60,35 L60,55 L80,55 L80,40 L95,40 L95,30 L110,30 L110,50 L130,50 L130,20 L145,20 L145,35 L155,35 L155,25 L165,25 L165,50 L185,50 L185,38 L200,38 L200,22 L215,22 L215,42 L235,42 L235,15 L248,15 L248,32 L258,32 L258,8 L268,8 L268,30 L280,30 L280,48 L295,48 L295,33 L310,33 L310,52 L325,52 L325,28 L338,28 L338,45 L355,45 L355,20 L370,20 L370,38 L385,38 L385,25 L398,25 L398,48 L415,48 L415,35 L430,35 L430,18 L445,18 L445,40 L460,40 L460,55 L475,55 L475,30 L488,30 L488,45 L505,45 L505,22 L518,22 L518,38 L535,38 L535,50 L548,50 L548,32 L562,32 L562,48 L578,48 L578,25 L592,25 L592,42 L608,42 L608,18 L622,18 L622,35 L638,35 L638,50 L655,50 L655,28 L670,28 L670,45 L685,45 L685,35 L700,35 L700,55 L715,55 L715,40 L730,40 L730,22 L745,22 L745,48 L760,48 L760,38 L775,38 L775,55 L800,55 L800,80 Z" />
      {/* Windows */}
      {[140,142,162,164,262,264,356,358,432,434,510,512,596,598,626,628,736,738].map((x,i) => (
        <rect key={i} x={x} y={i%3===0?22:i%3===1?26:18} width="4" height="5" fill={color} opacity="0.8" />
      ))}
    </svg>
  );
}

// ── Dust particles ─────────────────────────────────────────────────
function DustTrail({ color }: { color: string }) {
  return (
    <div className="absolute right-full top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: 40, height: 20 }}>
      {[0,1,2,3].map(i => (
        <div key={i} className="absolute rounded-full" style={{
          width: 4 - i, height: 4 - i,
          background: color,
          top: `${20 + i * 15}%`,
          right: `${i * 22}%`,
          opacity: 0.7 - i * 0.15,
          animation: `dust ${0.5 + i * 0.1}s ease-out infinite`,
          animationDelay: `${i * 0.12}s`,
        }} />
      ))}
    </div>
  );
}

export default function HorsesPage() {
  const { user, updateUser } = useAuth();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loadingOdds, setLoadingOdds] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [bet, setBet] = useState(500);
  const [racing, setRacing] = useState(false);
  const [raceProgress, setRaceProgress] = useState<Record<number, number>>({});
  const [result, setResult] = useState<RaceResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [history, setHistory] = useState<{ name: string; won: boolean; payout: number; color: string }[]>([]);

  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = STYLES;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);

  const loadOdds = () => {
    setLoadingOdds(true);
    api.get('/games/horses/odds')
      .then(r => { setHorses(r.data.horses); })
      .catch(() => toast.error('Impossible de charger les chevaux'))
      .finally(() => setLoadingOdds(false));
  };

  useEffect(() => { loadOdds(); }, []);

  const startRace = async () => {
    if (racing || !selected || !user || user.balance < bet) return;
    setRacing(true);
    setResult(null);
    setShowResult(false);
    const init: Record<number, number> = {};
    horses.forEach(h => { init[h.id] = 2; });
    setRaceProgress(init);

    try {
      const res = await api.post('/games/horses/race', { horseId: selected, bet });
      const data: RaceResult = res.data;

      const duration = 4000;
      const interval = 50;
      const steps = duration / interval;
      let step = 0;

      const anim = setInterval(() => {
        step++;
        const t = step / steps;
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        const progress: Record<number, number> = {};
        data.ranking.forEach(h => {
          const rank = h.position;
          const targetPct = 100 - (rank - 1) * 12;
          const wobble = Math.sin(step * 0.8 + h.id * 1.3) * 2;
          progress[h.id] = Math.min(97, Math.max(2, eased * targetPct + wobble));
        });
        setRaceProgress(progress);

        if (step >= steps) {
          clearInterval(anim);
          const final: Record<number, number> = {};
          data.ranking.forEach(h => { final[h.id] = 100 - (h.position - 1) * 12; });
          // winner always at 100
          final[data.winner.id] = 100;
          setRaceProgress(final);

          setTimeout(() => {
            setResult(data);
            setShowResult(true);
            setRacing(false);
            updateUser({ balance: data.newBalance });
            setHistory(prev => [{ name: data.chosenHorse.name, won: data.won, payout: data.payout, color: data.chosenHorse.color }, ...prev].slice(0, 8));
            if (data.won) {
              sfx.win();
              if (data.payout >= 2000) sfx.bigWin();
            } else {
              sfx.lose();
            }
            api.get('/games/horses/odds').then(r => setHorses(r.data.horses)).catch(() => {});
          }, 600);
        }
      }, interval);

    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur');
      setRacing(false);
    }
  };

  const selectedHorse = horses.find(h => h.id === selected);

  return (
    <div className="min-h-screen text-white" style={{ background: '#070712' }}>
      <Navbar />

      <div className="pt-14 max-w-2xl mx-auto">

        {/* ── TRACK ARENA ─────────────────────────────────────── */}
        <div className="relative overflow-hidden" style={{ height: 420 }}>

          {/* Sky */}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, #050510 0%, #0d0d2a 35%, #0d1a0d 65%, #081208 100%)',
          }}>
            <Stars />
          </div>

          {/* City skyline */}
          <div className="absolute left-0 right-0" style={{ top: '18%', height: 80 }}>
            <CitySkyline color="#1a1a4a" />
          </div>

          {/* Crowd silhouette */}
          <div className="absolute left-0 right-0" style={{ top: '36%', height: 28 }}>
            <svg viewBox="0 0 800 28" preserveAspectRatio="none" className="w-full h-full" style={{ animation: 'crowd-sway 2s ease-in-out infinite' }}>
              <path fill="#0d1a0d" d="M0,28 L0,14 Q5,8 10,14 Q15,8 20,14 Q25,6 30,14 Q36,10 40,14 Q45,8 50,14 Q55,10 60,14 Q65,7 70,14 Q75,9 80,14 Q85,8 90,14 Q95,11 100,14 Q105,7 110,14 Q115,9 120,14 Q125,8 130,14 Q135,10 140,14 Q145,6 150,14 Q155,9 160,14 Q165,8 170,14 Q175,11 180,14 Q185,7 190,14 Q195,9 200,14 Q205,8 210,14 Q215,10 220,14 Q225,6 230,14 Q235,9 240,14 Q245,8 250,14 Q255,11 260,14 Q265,7 270,14 Q275,9 280,14 Q285,8 290,14 Q295,10 300,14 Q305,6 310,14 Q315,9 320,14 Q325,8 330,14 Q335,11 340,14 Q345,7 350,14 Q355,9 360,14 Q365,8 370,14 Q375,10 380,14 Q385,6 390,14 Q395,9 400,14 Q405,8 410,14 Q415,11 420,14 Q425,7 430,14 Q435,9 440,14 Q445,8 450,14 Q455,10 460,14 Q465,6 470,14 Q475,9 480,14 Q485,8 490,14 Q495,11 500,14 Q505,7 510,14 Q515,9 520,14 Q525,8 530,14 Q535,10 540,14 Q545,6 550,14 Q555,9 560,14 Q565,8 570,14 Q575,11 580,14 Q585,7 590,14 Q595,9 600,14 Q605,8 610,14 Q615,10 620,14 Q625,6 630,14 Q635,9 640,14 Q645,8 650,14 Q655,11 660,14 Q665,7 670,14 Q675,9 680,14 Q685,8 690,14 Q695,10 700,14 Q705,6 710,14 Q715,9 720,14 Q725,8 730,14 Q735,11 740,14 Q745,7 750,14 Q755,9 760,14 Q765,8 770,14 Q775,10 780,14 Q785,6 790,14 Q795,9 800,14 L800,28 Z" />
            </svg>
          </div>

          {/* Track ground */}
          <div className="absolute left-0 right-0 bottom-0" style={{ top: '40%', background: 'linear-gradient(to bottom, #0d1f0d, #081208)' }}>

            {/* Track lighting strip top */}
            <div style={{ height: 2, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent)' }} />

            {/* Lanes */}
            {loadingOdds ? (
              <div className="flex flex-col gap-0 p-4">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-14 rounded animate-pulse mb-1" style={{ background: 'rgba(255,255,255,0.03)' }} />
                ))}
              </div>
            ) : (
              horses.map((horse, laneIdx) => {
                const progress = raceProgress[horse.id] ?? 2;
                const isWinner = result?.winner.id === horse.id;
                const isSelected = selected === horse.id;
                const isLeading = racing && Object.entries(raceProgress).sort((a,b) => b[1]-a[1])[0]?.[0] === String(horse.id);

                return (
                  <div key={horse.id} style={{ position: 'relative', height: `${100/6}%` }}>
                    {/* Lane background — subtle glow for selected */}
                    <div className="absolute inset-0" style={{
                      background: isSelected
                        ? `linear-gradient(to right, ${horse.color}10, ${horse.color}18, ${horse.color}05)`
                        : 'transparent',
                      transition: 'background 0.3s',
                    }} />

                    {/* Moving dashes (speed effect during race) */}
                    <div className="absolute left-0 right-16 top-1/2 -translate-y-1/2" style={{ height: 1 }}>
                      <div className={racing ? 'dash-moving' : ''} style={{
                        height: '100%',
                        backgroundImage: `repeating-linear-gradient(to right, ${horse.color}40 0px, ${horse.color}40 20px, transparent 20px, transparent 60px)`,
                        backgroundSize: '80px 100%',
                        opacity: racing ? 0.6 : 0.2,
                        transition: 'opacity 0.3s',
                      }} />
                    </div>

                    {/* Lane divider */}
                    {laneIdx < horses.length - 1 && (
                      <div className="absolute bottom-0 left-4 right-4" style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />
                    )}

                    {/* Horse position marker */}
                    <motion.div
                      className="absolute top-1/2 -translate-y-1/2"
                      style={{ left: `${Math.max(2, Math.min(87, progress))}%` }}
                      animate={{ left: `${Math.max(2, Math.min(87, progress))}%` }}
                      transition={{ duration: 0.05 }}
                    >
                      <div style={{ position: 'relative' }}>
                        {racing && <DustTrail color={horse.color} />}
                        <HorseSVG color={horse.color} size={48} racing={racing} />
                        {isLeading && racing && (
                          <div className="absolute -top-1 -right-1 text-xs">👑</div>
                        )}
                      </div>
                    </motion.div>

                    {/* Horse info label (left) */}
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5" style={{ zIndex: 2 }}>
                      <span className="text-xs font-black" style={{ color: horse.color, textShadow: `0 0 8px ${horse.color}`, fontVariantNumeric: 'tabular-nums' }}>
                        {laneIdx + 1}
                      </span>
                    </div>

                    {/* Winner crown */}
                    {isWinner && showResult && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute right-20 top-1/2 -translate-y-1/2 text-2xl"
                        style={{ filter: 'drop-shadow(0 0 12px #f59e0b)' }}
                      >
                        🏆
                      </motion.div>
                    )}
                  </div>
                );
              })
            )}

            {/* Track lighting strip bottom */}
            <div style={{ height: 2, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)' }} />
          </div>

          {/* Finish line */}
          <div className="absolute right-16 top-0" style={{
            top: '40%', bottom: 0, width: 4,
            background: 'repeating-linear-gradient(to bottom, #ffffff 0px, #ffffff 8px, #000000 8px, #000000 16px)',
            opacity: 0.9,
            zIndex: 10,
          }}>
            <div className={`absolute inset-0 ${racing ? 'finish-glow' : ''}`} style={{ background: 'rgba(255,255,255,0.4)' }} />
          </div>
          <div className="absolute right-14 text-xs font-black text-white/50 tracking-widest" style={{ top: '41%', writingMode: 'vertical-rl', letterSpacing: '0.2em' }}>
            FINISH
          </div>

          {/* Phase HUD */}
          <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <div className="text-xs font-black px-3 py-1 rounded-full" style={{
                background: racing ? 'rgba(239,68,68,0.2)' : 'rgba(0,0,0,0.5)',
                border: `1px solid ${racing ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                color: racing ? '#fca5a5' : '#9ca3af',
              }}>
                {racing ? '🏁 EN COURSE' : showResult ? '🏆 RÉSULTAT' : '🎯 PARIS OUVERTS'}
              </div>
            </div>
            <div className="text-sm font-black" style={{ color: '#f59e0b', textShadow: '0 0 12px #f59e0b80' }}>
              🏟 HIPPODROME
            </div>
          </div>

          {/* Result overlay */}
          <AnimatePresence>
            {showResult && result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="absolute inset-x-4 bottom-4 z-30 rounded-2xl p-4 text-center"
                style={{
                  background: result.won
                    ? 'linear-gradient(135deg, rgba(5,46,22,0.97), rgba(20,83,45,0.97))'
                    : 'linear-gradient(135deg, rgba(60,10,10,0.97), rgba(100,20,20,0.97))',
                  border: `2px solid ${result.won ? '#16a34a' : '#dc2626'}`,
                  backdropFilter: 'blur(12px)',
                  boxShadow: result.won ? '0 0 40px rgba(34,197,94,0.3)' : '0 0 40px rgba(239,68,68,0.3)',
                }}
              >
                <div style={{ animation: 'winner-burst 0.5s ease-out forwards' }}>
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <HorseSVG color={result.winner.color} size={40} />
                    <div className="text-left">
                      <p className="text-xs text-gray-300 uppercase tracking-widest">Vainqueur</p>
                      <p className="text-xl font-black text-white" style={{ textShadow: `0 0 15px ${result.winner.color}` }}>
                        {result.winner.name}
                      </p>
                    </div>
                  </div>
                  <div className={`text-2xl font-black ${result.won ? 'text-green-400' : 'text-red-400'}`}>
                    {result.won
                      ? `+${formatBalance(result.payout)} (×${result.odds})`
                      : `-${formatBalance(result.mise)}`}
                  </div>
                  {!result.won && (
                    <p className="text-gray-400 text-xs mt-1">
                      Tu misais sur <span style={{ color: result.chosenHorse.color }}>{result.chosenHorse.name}</span>
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── BETTING PANEL ────────────────────────────────────── */}
        <div className="px-4 pb-8 space-y-4" style={{ background: '#0a0a16' }}>

          {/* Horse selection */}
          <div className="pt-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Choisir un cheval</p>
            {loadingOdds ? (
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#0d0d1e' }} />)}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {horses.map((horse) => (
                  <button
                    key={horse.id}
                    onClick={() => { if (!racing) { setSelected(horse.id); setShowResult(false); } }}
                    disabled={racing}
                    className="rounded-xl p-3 text-left transition-all"
                    style={{
                      background: selected === horse.id ? `${horse.color}18` : '#0d0d1e',
                      border: selected === horse.id ? `2px solid ${horse.color}` : '1px solid rgba(255,255,255,0.06)',
                      boxShadow: selected === horse.id ? `0 0 20px ${horse.color}30, inset 0 0 20px ${horse.color}05` : 'none',
                      transform: selected === horse.id ? 'translateY(-2px)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <HorseSVG color={horse.color} size={28} />
                    </div>
                    <p className="font-bold text-xs text-white truncate leading-tight">{horse.name}</p>
                    <p className="font-black text-sm" style={{ color: horse.color }}>×{horse.odds}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bet amounts */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Mise</p>
            <div className="flex gap-2">
              {BETS.map(b => (
                <button key={b} onClick={() => setBet(b)} disabled={racing}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all"
                  style={{
                    background: bet === b ? 'linear-gradient(135deg, #78350f, #f59e0b)' : 'rgba(255,255,255,0.04)',
                    color: bet === b ? '#000' : '#6b7280',
                    border: bet === b ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: bet === b ? '0 0 15px rgba(245,158,11,0.4)' : 'none',
                  }}>
                  {b >= 1000 ? `${b / 1000}k` : b}
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={startRace}
            disabled={racing || !selected || (user?.balance ?? 0) < bet || loadingOdds}
            className="w-full py-4 rounded-2xl font-black text-lg transition-all relative overflow-hidden"
            style={{
              background: racing
                ? 'rgba(20,20,40,0.8)'
                : !selected || (user?.balance ?? 0) < bet
                ? 'rgba(30,30,60,0.8)'
                : 'linear-gradient(135deg, #064e3b, #065f46, #059669)',
              color: racing || !selected ? '#4b5563' : '#fff',
              border: racing ? '1px solid rgba(255,255,255,0.05)' : !selected ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(16,185,129,0.4)',
              boxShadow: !racing && selected && (user?.balance ?? 0) >= bet ? '0 0 30px rgba(16,185,129,0.25)' : 'none',
            }}
          >
            {racing ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>🏁</motion.span>
                Course en cours…
              </span>
            ) : !selected ? (
              '← Choisissez un cheval'
            ) : (user?.balance ?? 0) < bet ? (
              'Solde insuffisant'
            ) : (
              <span>
                🏇 PARIER SUR <span style={{ color: selectedHorse?.color ?? '#fff' }}>{selectedHorse?.name}</span>
                <span className="ml-2 opacity-70">— {formatBalance(bet)}</span>
              </span>
            )}
          </motion.button>

          {/* Balance */}
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Solde : <span className="text-casino-gold font-black">{formatBalance(user?.balance ?? 0)}</span></span>
            {selectedHorse && (
              <span>Gain potentiel : <span className="font-black" style={{ color: selectedHorse.color }}>
                {formatBalance(bet * selectedHorse.odds)}
              </span></span>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">Historique</p>
              <div className="flex gap-1.5 flex-wrap">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{
                    background: h.won ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${h.won ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
                    color: h.won ? '#4ade80' : '#f87171',
                  }}>
                    <span style={{ color: h.color }}>●</span>
                    {h.won ? `+${formatBalance(h.payout)}` : 'Perdu'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
