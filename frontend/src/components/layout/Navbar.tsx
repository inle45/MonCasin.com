'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { formatBalance, getAvatarUrl } from '@/lib/api';
import { sfx } from '@/lib/sfx';
import { LogOut, ShoppingBag, Gift, Package, Trophy, ClipboardList, Volume2, VolumeX, BarChart2, Star, Ticket, RotateCcw, Flag, ChevronDown, Gamepad2, Menu, Swords, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

const GRADE_ICONS: Record<string, string> = {
  NONE: '', SILVER: '🥈', GOLD: '🥇', PLATINUM: '💠', DIAMOND: '💎',
};

const GAMES = [
  { href: '/dashboard',      emoji: '🏠', label: 'Accueil'  },
  { href: '/games/crash',    emoji: '⚡', label: 'Crash'    },
  { href: '/games/roulette', emoji: '🎡', label: 'Roulette' },
  { href: '/games/slots',    emoji: '🎰', label: 'Slots'    },
  { href: '/games/dice',     emoji: '🎲', label: 'Dice'     },
  { href: '/games/mines',    emoji: '💣', label: 'Mines'    },
  { href: '/games/hilo',     emoji: '🃏', label: 'Hi-Lo'    },
  { href: '/games/limbo',      emoji: '🌙', label: 'Limbo'      },
  { href: '/games/plinko',     emoji: '🪙', label: 'Plinko'     },
  { href: '/games/blackjack',  emoji: '🃏', label: 'Blackjack'  },
];

const MORE_LINKS = [
  { href: '/duel',       label: 'Duels',       icon: Swords        },
  { href: '/battlepass', label: 'Battle Pass', icon: Trophy        },
  { href: '/challenge',  label: 'Défi du jour', icon: Gamepad2     },
  { href: '/scratch',    label: 'Grattage',    icon: Sparkles      },
  { href: '/quests',     label: 'Quêtes',      icon: ClipboardList },
  { href: '/race',       label: 'Wager Race',  icon: Flag          },
  { href: '/tournament', label: 'Tournoi',     icon: Star          },
  { href: '/lottery',    label: 'Loterie',     icon: Ticket        },
  { href: '/rakeback',   label: 'Rakeback',    icon: RotateCcw     },
  { href: '/grades',     label: 'Grades',      icon: BarChart2     },
  { href: '/stats',      label: 'Mes stats',   icon: BarChart2     },
  { href: '/leaderboard', label: 'Classements', icon: Trophy        },
  { href: '/shop',       label: 'Boutique',    icon: ShoppingBag   },
  { href: '/bonuses',    label: 'Bonus',       icon: Gift          },
  { href: '/inventory',  label: 'Mon sac',     icon: Package       },
];

function Dropdown({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="absolute top-12 left-0 rounded-2xl shadow-2xl overflow-hidden z-50 min-w-[160px]"
      style={{ background: '#131128', border: '1px solid rgba(245,158,11,0.2)' }}
    >
      {children}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected, jackpot } = useSocket();
  const pathname = usePathname();
  const [gamesOpen, setGamesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const gamesRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (gamesRef.current && !gamesRef.current.contains(e.target as Node)) setGamesOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const activeGame = GAMES.find(g => isActive(g.href));
  const activeMore = MORE_LINKS.find(l => isActive(l.href));

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-casino-card/95 backdrop-blur border-b border-casino-border">
      <div className="max-w-7xl mx-auto px-3 h-14 flex items-center justify-between gap-3">

        {/* Logo */}
        <Link href="/dashboard" className="flex-shrink-0 font-black text-casino-gold text-lg">
          🎰 <span className="hidden sm:inline">MonCasin</span>
        </Link>

        {/* Centre : menus déroulants */}
        <div className="flex items-center gap-2 flex-1">

          {/* Dropdown Jeux */}
          <div className="relative" ref={gamesRef}>
            <button
              onClick={() => { setGamesOpen(v => !v); setMenuOpen(false); }}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all',
                activeGame || gamesOpen
                  ? 'bg-casino-gold/15 text-casino-gold border border-casino-gold/30'
                  : 'text-gray-300 hover:text-white bg-white/5 hover:bg-white/10'
              )}
            >
              <span>{activeGame?.emoji ?? '🎮'}</span>
              <span className="hidden sm:inline">{activeGame?.label ?? 'Jeux'}</span>
              <ChevronDown className={clsx('w-3 h-3 transition-transform', gamesOpen && 'rotate-180')} />
            </button>

            <Dropdown open={gamesOpen}>
              <div className="grid grid-cols-3 gap-0 p-2">
                {GAMES.map(({ href, emoji, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setGamesOpen(false)}
                    className={clsx(
                      'flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium transition-all',
                      isActive(href)
                        ? 'bg-casino-gold/15 text-casino-gold'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <span className="text-2xl">{emoji}</span>
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            </Dropdown>
          </div>

          {/* Dropdown Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => { setMenuOpen(v => !v); setGamesOpen(false); }}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all',
                activeMore || menuOpen
                  ? 'bg-casino-gold/15 text-casino-gold border border-casino-gold/30'
                  : 'text-gray-300 hover:text-white bg-white/5 hover:bg-white/10'
              )}
            >
              {activeMore ? <activeMore.icon className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              <span className="hidden sm:inline">{activeMore?.label ?? 'Menu'}</span>
              <ChevronDown className={clsx('w-3 h-3 transition-transform', menuOpen && 'rotate-180')} />
            </button>

            <Dropdown open={menuOpen}>
              {MORE_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={clsx(
                    'flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors',
                    isActive(href)
                      ? 'text-casino-gold bg-casino-gold/10'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </Link>
              ))}
            </Dropdown>
          </div>

          {/* Jackpot slots */}
          {jackpot > 0 && (
            <span className="hidden md:flex items-center gap-1 text-xs font-black text-casino-gold bg-casino-gold/10 px-2 py-1 rounded-lg border border-casino-gold/20">
              🎰 {jackpot.toLocaleString('fr-FR')}
            </span>
          )}
        </div>

        {/* Droite */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Streak */}
          {(user.streak ?? 0) >= 2 && (
            <span className="flex items-center gap-1 text-xs font-black text-orange-400 bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/20">
              🔥{user.streak}
            </span>
          )}

          {/* Son */}
          <button onClick={() => setMuted(sfx.toggleMute())} className="text-gray-500 hover:text-casino-gold transition-colors p-1">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Connexion */}
          <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', connected ? 'bg-green-400' : 'bg-red-400')} />

          {/* Solde */}
          <span className="text-casino-gold font-bold text-sm">
            {formatBalance(user.balance)}
          </span>

          {/* Avatar */}
          <Link href="/profile" className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-casino-border">
              <img
                src={getAvatarUrl(user.avatar)}
                alt={user.pseudo}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = '/avatars/default-1.svg'; }}
              />
            </div>
            {user.grade !== 'NONE' && (
              <span className="absolute -top-1 -right-1 text-[10px] leading-none">{GRADE_ICONS[user.grade]}</span>
            )}
            {(user.level ?? 1) > 1 && (
              <span className="absolute -bottom-1 -right-1 text-[9px] font-black leading-none bg-purple-600 text-white rounded-full px-1">
                {user.level}
              </span>
            )}
          </Link>

          {/* Déco */}
          <button onClick={logout} className="text-gray-600 hover:text-red-400 transition-colors p-1">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
