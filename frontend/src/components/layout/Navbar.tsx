'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { formatBalance } from '@/lib/api';
import { Zap, LogOut, ShoppingBag, Gift, Package, MoreHorizontal, Trophy, ClipboardList } from 'lucide-react';
import { clsx } from 'clsx';

const GRADE_ICONS: Record<string, string> = {
  NONE: '', SILVER: '🥈', GOLD: '🥇', PLATINUM: '💠', DIAMOND: '💎',
};

// Jeux principaux — icônes uniquement dans la navbar
const GAMES = [
  { href: '/dashboard',     emoji: '🏠', label: 'Accueil'  },
  { href: '/games/crash',   emoji: '⚡', label: 'Crash'    },
  { href: '/games/roulette',emoji: '🎡', label: 'Roulette' },
  { href: '/games/slots',   emoji: '🎰', label: 'Slots'    },
  { href: '/games/dice',    emoji: '🎲', label: 'Dice'     },
  { href: '/games/mines',   emoji: '💣', label: 'Mines'    },
];

// Menu "Plus" — quêtes, tournoi, boutique, bonus, inventaire
const MORE_LINKS = [
  { href: '/quests',     label: 'Quêtes',   icon: ClipboardList },
  { href: '/tournament', label: 'Tournoi',  icon: Trophy        },
  { href: '/shop',       label: 'Boutique', icon: ShoppingBag   },
  { href: '/bonuses',    label: 'Bonus',    icon: Gift          },
  { href: '/inventory',  label: 'Mon sac',  icon: Package       },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu en cliquant ailleurs
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-casino-card/95 backdrop-blur border-b border-casino-border">
      <div className="max-w-7xl mx-auto px-3 h-14 flex items-center justify-between gap-2">

        {/* Logo */}
        <Link href="/dashboard" className="flex-shrink-0 text-xl font-black text-casino-gold hidden sm:block">
          MonCasin
        </Link>

        {/* Jeux — icônes uniquement */}
        <div className="flex items-center gap-0.5">
          {GAMES.map(({ href, emoji, label }) => (
            <Link
              key={href}
              href={href}
              title={label}
              className={clsx(
                'w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all',
                isActive(href)
                  ? 'bg-casino-gold/15 text-casino-gold ring-1 ring-casino-gold/40'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              {emoji}
            </Link>
          ))}

          {/* Bouton "Plus" */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              title="Plus"
              className={clsx(
                'w-9 h-9 rounded-lg flex items-center justify-center transition-all',
                MORE_LINKS.some(l => pathname.startsWith(l.href))
                  ? 'bg-casino-gold/15 text-casino-gold ring-1 ring-casino-gold/40'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute top-11 left-1/2 -translate-x-1/2 w-36 rounded-xl overflow-hidden shadow-xl"
                style={{ background: '#1a1730', border: '1px solid rgba(245,158,11,0.2)' }}>
                {MORE_LINKS.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors',
                      pathname.startsWith(href)
                        ? 'text-casino-gold bg-casino-gold/10'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Droite : solde + point connexion + avatar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Point connexion */}
          <div
            className={clsx('w-2 h-2 rounded-full', connected ? 'bg-green-400' : 'bg-red-400')}
            title={connected ? 'Connecté' : 'Déconnecté'}
          />

          {/* Solde */}
          <span className="text-casino-gold font-bold text-sm hidden sm:block">
            {formatBalance(user.balance)}
          </span>

          {/* Avatar → profil */}
          <Link href="/profile" className="relative flex-shrink-0">
            <div className={clsx(
              'w-8 h-8 rounded-full overflow-hidden',
              user.avatarBorder ? `border-${user.avatarBorder}` : 'border border-casino-border',
            )}>
              <img
                src={user.avatar || '/avatars/default-1.png'}
                alt={user.pseudo}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = '/avatars/default-1.png'; }}
              />
            </div>
            {user.grade !== 'NONE' && (
              <span className="absolute -top-1 -right-1 text-[10px] leading-none">{GRADE_ICONS[user.grade]}</span>
            )}
          </Link>

          {/* Déconnexion */}
          <button
            onClick={logout}
            className="text-gray-600 hover:text-red-400 transition-colors p-1"
            title="Déconnexion"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
