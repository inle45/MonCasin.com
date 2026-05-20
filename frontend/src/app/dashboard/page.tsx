'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Navbar from '@/components/layout/Navbar';
import ChatPanel from '@/components/chat/ChatPanel';
import Leaderboard from '@/components/leaderboard/Leaderboard';
import api, { formatBalance, getAvatarUrl } from '@/lib/api';
import { SkeletonDashboard } from '@/components/ui/Skeleton';

const GRADE_DATA: Record<string, { label: string; color: string; glow: string; ring: string }> = {
  NONE:     { label: 'Membre',  color: '#6b7280', glow: 'rgba(107,114,128,0.25)', ring: '#6b7280,#4b5563' },
  SILVER:   { label: 'Argent',  color: '#9ca3af', glow: 'rgba(156,163,175,0.30)', ring: '#9ca3af,#6b7280' },
  GOLD:     { label: 'Or',      color: '#f59e0b', glow: 'rgba(245,158,11,0.40)',  ring: '#f59e0b,#d97706,#f59e0b' },
  PLATINUM: { label: 'Platine', color: '#a78bfa', glow: 'rgba(167,139,250,0.40)', ring: '#a78bfa,#7c3aed,#a78bfa' },
  DIAMOND:  { label: 'Diamant', color: '#38bdf8', glow: 'rgba(56,189,248,0.50)',  ring: '#38bdf8,#0ea5e9,#e0f2fe,#38bdf8' },
};

const GAMES = [
  { href: '/games/crash',     title: 'Crash Game',          icon: '🚀', badge: 'MULTI', neon: '#10b981', desc: 'Multiplie tes gains avant le crash !',         bg: 'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(6,78,59,0.08))'    },
  { href: '/games/roulette',  title: 'Roulette',            icon: '🎡', badge: 'MULTI', neon: '#ef4444', desc: 'Roulette européenne classique.',                 bg: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(127,29,29,0.08))'   },
  { href: '/games/slots',     title: 'Machine à Sous',      icon: '🎰', badge: 'SOLO',  neon: '#a855f7', desc: 'Jackpot progressif, bonus coffres & roue.',      bg: 'linear-gradient(135deg,rgba(168,85,247,0.12),rgba(76,29,149,0.08))'  },
  { href: '/games/blackjack', title: 'Blackjack',           icon: '🃏', badge: 'SOLO',  neon: '#f59e0b', desc: 'Battez le croupier sans dépasser 21.',           bg: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(120,53,15,0.08))'  },
  { href: '/games/mines',     title: 'Mines',               icon: '💣', badge: 'SOLO',  neon: '#f97316', desc: 'Évite les mines, cashout quand tu veux.',         bg: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(124,45,18,0.08))'  },
  { href: '/games/plinko',    title: 'Plinko',              icon: '🪙', badge: 'SOLO',  neon: '#ec4899', desc: 'Rebondis vers des multiplicateurs fous !',        bg: 'linear-gradient(135deg,rgba(236,72,153,0.12),rgba(131,24,67,0.08))'  },
  { href: '/games/dice',      title: 'Dice',                icon: '🎲', badge: 'SOLO',  neon: '#3b82f6', desc: 'Lance 2 dés, multiplicateurs jusqu\'à ×17.',     bg: 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(30,58,138,0.08))'  },
  { href: '/games/hilo',      title: 'Hi-Lo',               icon: '🎴', badge: 'SOLO',  neon: '#06b6d4', desc: 'Plus haut ou plus bas ? Enchaîne les combos !',  bg: 'linear-gradient(135deg,rgba(6,182,212,0.12),rgba(21,94,117,0.08))'   },
  { href: '/games/limbo',     title: 'Limbo',               icon: '🌙', badge: 'SOLO',  neon: '#6366f1', desc: 'Choisis ton multiplicateur cible ×1 000 000.',    bg: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(49,46,129,0.08))'  },
  { href: '/games/wheel',     title: 'Roue de la Richesse', icon: '🎡', badge: 'SOLO',  neon: '#eab308', desc: '12 segments dorés, jusqu\'à ×50.',                bg: 'linear-gradient(135deg,rgba(234,179,8,0.12),rgba(113,63,18,0.08))'   },
  { href: '/games/baccarat',  title: 'Baccarat',            icon: '🎴', badge: 'SOLO',  neon: '#34d399', desc: 'Joueur vs Banquier avec règles officielles.',     bg: 'linear-gradient(135deg,rgba(52,211,153,0.12),rgba(6,78,59,0.08))'   },
  { href: '/games/horses',    title: 'Courses Hippiques',   icon: '🏇', badge: 'SOLO',  neon: '#84cc16', desc: '6 chevaux avec cotes dynamiques en direct !',     bg: 'linear-gradient(135deg,rgba(132,204,22,0.12),rgba(54,83,20,0.08))'  },
];

const FEATURED = GAMES.slice(0, 3);

// ─── Animated balance counter ─────────────────────────────────────────────────
function AnimatedBalance({ target }: { target: number }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    startRef.current = null;
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min((ts - startRef.current) / 1600, 1);
      setDisplay(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [target]);
  return <>{formatBalance(display)}</>;
}

// ─── 3D Tilt card ─────────────────────────────────────────────────────────────
function TiltCard({ children, className = '', style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, sx: 50, sy: 50, op: 0 });
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    setTilt({ rx: -dy * 7, ry: dx * 7, sx: ((e.clientX - r.left) / r.width) * 100, sy: ((e.clientY - r.top) / r.height) * 100, op: 0.18 });
  }, []);
  const onLeave = useCallback(() => setTilt({ rx: 0, ry: 0, sx: 50, sy: 50, op: 0 }), []);
  const idle = tilt.rx === 0;
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={className}
      style={{ ...style, transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`, transition: idle ? 'transform 0.5s cubic-bezier(0.23,1,0.32,1)' : 'transform 0.1s ease', position: 'relative', overflow: 'hidden' }}>
      {children}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', background: `radial-gradient(circle at ${tilt.sx}% ${tilt.sy}%, rgba(255,255,255,${tilt.op}), transparent 65%)` }} />
    </div>
  );
}

// ─── Floating orbs ────────────────────────────────────────────────────────────
function ParticleOrbs() {
  const orbs = [
    { s: 380, c: 'rgba(16,185,129,0.055)',  x: 8,  y: 15, d: 22 },
    { s: 500, c: 'rgba(168,85,247,0.045)',  x: 82, y: 8,  d: 28 },
    { s: 300, c: 'rgba(245,158,11,0.05)',   x: 48, y: 65, d: 19 },
    { s: 420, c: 'rgba(239,68,68,0.035)',   x: 18, y: 78, d: 24 },
    { s: 260, c: 'rgba(56,189,248,0.045)',  x: 88, y: 55, d: 17 },
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      {orbs.map((o, i) => (
        <div key={i} style={{ position: 'absolute', width: o.s, height: o.s, borderRadius: '50%', background: `radial-gradient(circle, ${o.c} 0%, transparent 70%)`, left: `${o.x}%`, top: `${o.y}%`, transform: 'translate(-50%,-50%)', animation: `db-orb ${o.d}s ease-in-out ${i * 3}s infinite alternate`, filter: 'blur(2px)' }} />
      ))}
    </div>
  );
}

// ─── Live ticker ──────────────────────────────────────────────────────────────
function LiveTicker() {
  const { liveEvents } = useSocket();
  if (liveEvents.length === 0) return null;
  const items = [...liveEvents, ...liveEvents, ...liveEvents];
  return (
    <div style={{ background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(245,158,11,0.15)', overflow: 'hidden', padding: '7px 0' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 48, animation: 'db-ticker 25s linear infinite', whiteSpace: 'nowrap', paddingLeft: '100%' }}>
        {items.map((ev, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
            <span style={{ fontSize: 15 }}>{ev.emoji}</span>
            <span style={{ color: '#9ca3af', fontWeight: 600 }}>{ev.pseudo}</span>
            <span style={{ color: ev.positive ? '#10b981' : '#ef4444', fontWeight: 700 }}>{ev.message}</span>
            {ev.amount > 0 && <span style={{ color: '#f59e0b', fontWeight: 800 }}>+{formatBalance(ev.amount)}</span>}
            <span style={{ color: 'rgba(255,255,255,0.1)', marginLeft: 4 }}>•</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Hero section ─────────────────────────────────────────────────────────────
function HeroSection({ user, jackpot, happyHour }: {
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
  jackpot: number;
  happyHour: ReturnType<typeof useSocket>['happyHour'];
}) {
  const gradeData = GRADE_DATA[user.grade] ?? GRADE_DATA.NONE;
  const level = user.level ?? 1;
  const xp = user.xp ?? 0;
  const xpNext = level * 1000;
  const xpPct = Math.min((xp % xpNext) / xpNext * 100, 100);
  const streak = user.streak ?? 0;

  return (
    <div style={{ position: 'relative', background: 'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 20, backdropFilter: 'blur(20px)', overflow: 'hidden' }}>
      {/* bg glow */}
      <div style={{ position: 'absolute', top: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: `radial-gradient(circle,${gradeData.glow},transparent 70%)`, pointerEvents: 'none' }} />

      {/* Responsive row: stacks on mobile, side-by-side on sm+ */}
      <div className="db-hero-row">

        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }} className="db-avatar-wrap">
          <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', background: `conic-gradient(${gradeData.ring},transparent 30%,${gradeData.ring})`, animation: 'db-ring 3s linear infinite', filter: `blur(1px) drop-shadow(0 0 8px ${gradeData.color})` }} />
          <img src={getAvatarUrl(user.avatar)} alt={user.pseudo}
            style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid rgba(0,0,0,0.6)', position: 'relative', zIndex: 1, boxShadow: `0 0 20px ${gradeData.glow}` }}
            onError={e => { (e.target as HTMLImageElement).src = '/avatars/default-1.svg'; }} />
          {streak > 1 && (
            <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg,#f97316,#ef4444)', borderRadius: 12, padding: '2px 9px', fontSize: 11, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', zIndex: 2, boxShadow: '0 2px 8px rgba(249,115,22,0.6)' }}>🔥 ×{streak}</div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }} className="db-hero-info">
          {/* Name + grade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: user.pseudoColor ?? '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>{user.pseudo}</h1>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: `${gradeData.color}22`, color: gradeData.color, border: `1px solid ${gradeData.color}55`, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>{gradeData.label}</span>
            {happyHour.active && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.35)', animation: 'db-hh 1.4s ease-in-out infinite alternate' }}>⚡ HAPPY HOUR ×{happyHour.multiplier}</span>
            )}
          </div>
          {/* Balance */}
          <div className="db-balance-text" style={{ fontWeight: 900, letterSpacing: '-0.03em', background: 'linear-gradient(90deg,#f59e0b,#fde68a,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundSize: '200% 100%', animation: 'db-gold 3s linear infinite', lineHeight: 1.1, marginTop: 6 }}>
            <AnimatedBalance target={user.balance} />
          </div>
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Solde disponible en Euro Fictif</p>
          {/* XP bar */}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>Niv.{level}</span>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${xpPct}%`, background: `linear-gradient(90deg,${gradeData.color},#fff8)`, borderRadius: 10, boxShadow: `0 0 8px ${gradeData.color}88`, transition: 'width 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
            </div>
            <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{xp % xpNext}/{xpNext} XP</span>
          </div>
        </div>

        {/* Jackpot pill — hidden on very small screens via CSS */}
        {jackpot > 0 && (
          <div className="db-jackpot-pill" style={{ flexShrink: 0, textAlign: 'center', background: 'linear-gradient(135deg,rgba(168,85,247,0.15),rgba(99,102,241,0.1))', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 14, padding: '12px 16px', animation: 'db-jackpot-card 2s ease-in-out infinite alternate' }}>
            <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 4 }}>🎰 JACKPOT</div>
            <div style={{ fontSize: 18, fontWeight: 900, background: 'linear-gradient(90deg,#a855f7,#e879f9,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundSize: '200% 100%', animation: 'db-gold 2s linear infinite' }}>{formatBalance(jackpot)}</div>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        {[
          { href: '/bonuses', icon: '🎁', label: 'Bonus',    color: '#a855f7' },
          { href: '/shop',    icon: '🛍️', label: 'Boutique', color: '#f59e0b' },
          { href: '/profile', icon: '👤', label: 'Profil',   color: '#38bdf8' },
        ].map(l => (
          <Link key={l.href} href={l.href} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: `${l.color}11`, border: `1px solid ${l.color}33`, color: l.color, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            <span>{l.icon}</span>{l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Featured game card ───────────────────────────────────────────────────────
function FeaturedCard({ game }: { game: typeof GAMES[0] }) {
  return (
    <TiltCard style={{ background: game.bg, border: `1px solid ${game.neon}40`, borderRadius: 16, cursor: 'pointer', boxShadow: `0 0 20px ${game.neon}15, inset 0 1px 0 rgba(255,255,255,0.05)` }}>
      <Link href={game.href} style={{ textDecoration: 'none', display: 'block', padding: '18px 16px' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 70, height: 70, background: `radial-gradient(circle at top right,${game.neon}28,transparent 70%)`, borderRadius: '0 16px 0 0', pointerEvents: 'none' }} />
        <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 10, filter: `drop-shadow(0 0 10px ${game.neon}70)` }}>{game.icon}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{game.title}</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${game.neon}20`, color: game.neon, border: `1px solid ${game.neon}40`, letterSpacing: '0.04em' }}>{game.badge}</span>
        </div>
        <p style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>{game.desc}</p>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: game.neon }}>
          Jouer maintenant <span style={{ fontSize: 15 }}>›</span>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 12, right: 12, height: 2, background: `linear-gradient(90deg,transparent,${game.neon}70,transparent)`, borderRadius: 2, animation: 'db-neon-scan 3s ease-in-out infinite' }} />
      </Link>
    </TiltCard>
  );
}

// ─── Regular game card ────────────────────────────────────────────────────────
function GameCard({ game }: { game: typeof GAMES[0] }) {
  return (
    <TiltCard style={{ background: game.bg, border: `1px solid ${game.neon}28`, borderRadius: 12, cursor: 'pointer' }}>
      <Link href={game.href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px' }}>
        <span style={{ fontSize: 30, flexShrink: 0, filter: `drop-shadow(0 0 7px ${game.neon}55)` }}>{game.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{game.title}</span>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, flexShrink: 0, background: `${game.neon}18`, color: game.neon, border: `1px solid ${game.neon}30` }}>{game.badge}</span>
          </div>
          <p style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{game.desc}</p>
        </div>
        <span style={{ fontSize: 16, color: `${game.neon}70`, flexShrink: 0, fontWeight: 700 }}>›</span>
      </Link>
    </TiltCard>
  );
}

// ─── Fortune graph ────────────────────────────────────────────────────────────
function FortuneGraph() {
  const [points, setPoints] = useState<number[]>([]);
  useEffect(() => {
    api.get('/users/me/transactions').then(res => {
      const txs: { amount: number }[] = res.data.transactions || [];
      let bal = 50000;
      const curve = [bal];
      txs.slice(-29).forEach(tx => { bal += tx.amount; curve.push(Math.max(0, bal)); });
      setPoints(curve);
    }).catch(() => setPoints([50000]));
  }, []);
  if (points.length < 2) return null;
  const W = 300, H = 80;
  const min = Math.min(...points), max = Math.max(...points), range = max - min || 1;
  const px = (i: number) => (i / (points.length - 1)) * W;
  const py = (v: number) => H - ((v - min) / range) * (H - 8) - 4;
  const pathD = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
  const last = points[points.length - 1], first = points[0];
  const up = last >= first, col = up ? '#10b981' : '#ef4444';
  return (
    <div style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#d1d5db' }}>📈 Courbe de fortune</span>
        <span style={{ fontSize: 12, fontWeight: 900, color: col }}>{up ? '+' : ''}{formatBalance(last - first)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 64, display: 'block' }}>
        <defs>
          <linearGradient id="fgdb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={col} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={col} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={`${pathD} L ${px(points.length-1)} ${H} L 0 ${H} Z`} fill="url(#fgdb)"/>
        <path d={pathD} fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={px(points.length-1)} cy={py(last)} r="4" fill={col} style={{ filter: `drop-shadow(0 0 5px ${col})` }}/>
      </svg>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const { liveEvents: _live, jackpot, happyHour } = useSocket();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Layout responsive */
      .db-main-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 20px;
      }
      @media (min-width: 1024px) {
        .db-main-grid { grid-template-columns: 1fr 320px; gap: 24px; }
      }
      .db-featured-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        margin-top: 14px;
      }
      @media (min-width: 480px) {
        .db-featured-grid { grid-template-columns: repeat(3, 1fr); }
      }
      .db-games-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
        margin-top: 14px;
      }
      @media (min-width: 480px) {
        .db-games-grid { grid-template-columns: repeat(2, 1fr); }
      }
      /* Hero inner row */
      .db-hero-row {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        text-align: center;
      }
      @media (min-width: 480px) {
        .db-hero-row { flex-direction: row; align-items: flex-start; text-align: left; }
      }
      .db-hero-info {
        width: 100%;
      }
      .db-avatar-wrap {
        flex-shrink: 0;
      }
      .db-jackpot-pill {
        display: none;
      }
      @media (min-width: 600px) {
        .db-jackpot-pill { display: block; }
      }
      /* Balance font size */
      .db-balance-text { font-size: 28px; }
      @media (min-width: 480px) { .db-balance-text { font-size: 34px; } }
      @media (min-width: 768px) { .db-balance-text { font-size: 40px; } }
      /* Section title */
      .db-section-title {
        font-size: 15px;
        font-weight: 800;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 8px;
        letter-spacing: -0.01em;
      }
      /* Right column order on mobile: appears after left col */
      .db-right-col {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      /* Keyframes */
      @keyframes db-orb {
        from { transform: translate(-50%,-50%) scale(1); }
        to   { transform: translate(-50%,-50%) scale(1.2) translate(25px,-18px); }
      }
      @keyframes db-ring {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      @keyframes db-gold {
        from { background-position: 0% 50%; }
        to   { background-position: 200% 50%; }
      }
      @keyframes db-ticker {
        from { transform: translateX(0); }
        to   { transform: translateX(-33.333%); }
      }
      @keyframes db-hh {
        from { opacity: 0.8; box-shadow: 0 0 6px rgba(168,85,247,0.3); }
        to   { opacity: 1;   box-shadow: 0 0 14px rgba(168,85,247,0.7); }
      }
      @keyframes db-jackpot-card {
        from { box-shadow: 0 0 10px rgba(168,85,247,0.2); }
        to   { box-shadow: 0 0 24px rgba(168,85,247,0.5); }
      }
      @keyframes db-neon-scan {
        0%   { opacity: 0.4; transform: scaleX(0.3); }
        50%  { opacity: 1;   transform: scaleX(1); }
        100% { opacity: 0.4; transform: scaleX(0.3); }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-casino-dark">
        <Navbar />
        <SkeletonDashboard />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080811', position: 'relative' }}>
      <ParticleOrbs />
      <Navbar />

      {/* Live events ticker */}
      <div style={{ position: 'relative', zIndex: 10, paddingTop: 64 }}>
        <LiveTicker />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1440, margin: '0 auto', padding: '16px 12px 48px' }}>
        <div className="db-main-grid">

          {/* ── Left column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <HeroSection user={user} jackpot={jackpot} happyHour={happyHour} />

            <div>
              <div className="db-section-title">⚡ Jeux En Vedette</div>
              <div className="db-featured-grid">
                {FEATURED.map(g => <FeaturedCard key={g.href} game={g} />)}
              </div>
            </div>

            <div>
              <div className="db-section-title">🎮 Tous les Jeux</div>
              <div className="db-games-grid">
                {GAMES.map(g => <GameCard key={g.href} game={g} />)}
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="db-right-col">
            <FortuneGraph />
            <Leaderboard />
            <div style={{ minHeight: 380 }}>
              <ChatPanel />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
