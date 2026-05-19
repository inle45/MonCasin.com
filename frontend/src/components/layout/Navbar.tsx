'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { formatBalance } from '@/lib/api';
import { Zap, Home, ShoppingBag, LogOut, Package } from 'lucide-react';
import { clsx } from 'clsx';

const GRADE_COLORS: Record<string, string> = {
  NONE: '',
  SILVER: 'text-gray-300',
  GOLD: 'text-yellow-400',
  PLATINUM: 'text-cyan-300',
  DIAMOND: 'text-blue-300',
};

const GRADE_ICONS: Record<string, string> = {
  NONE: '',
  SILVER: '🥈',
  GOLD: '🥇',
  PLATINUM: '💠',
  DIAMOND: '💎',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const pathname = usePathname();

  if (!user) return null;

  const navLinks = [
    { href: '/dashboard', label: 'Accueil', icon: Home },
    { href: '/games/crash', label: 'Crash', icon: Zap },
    { href: '/games/roulette', label: 'Roulette', icon: () => <span className="text-base">🎡</span> },
    { href: '/games/slots', label: 'Slots', icon: () => <span className="text-base">🎰</span> },
    { href: '/shop', label: 'Boutique', icon: ShoppingBag },
    { href: '/bonuses', label: 'Bonus', icon: () => <span className="text-base">🎁</span> },
    { href: '/inventory', label: 'Sac', icon: Package },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-casino-card/95 backdrop-blur border-b border-casino-border">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">🎰</span>
          <span className="font-bold text-casino-gold hidden sm:block">MonCasin.com</span>
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-casino-gold/10 text-casino-gold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden md:block">{label}</span>
            </Link>
          ))}
        </div>

        {/* Profil & Solde */}
        <div className="flex items-center gap-3">
          {/* Statut connexion */}
          <div className={clsx(
            'w-2 h-2 rounded-full hidden sm:block',
            connected ? 'bg-green-400 shadow-[0_0_6px_#10b981]' : 'bg-red-400'
          )} title={connected ? 'Connecté' : 'Déconnecté'} />

          {/* Solde */}
          <div className="hidden sm:block text-right">
            <div className="text-casino-gold font-bold text-sm">{formatBalance(user.balance)}</div>
          </div>

          {/* Avatar & menu */}
          <div className="flex items-center gap-2">
            <Link href="/profile" className="relative">
              <div className={clsx(
                'w-9 h-9 rounded-full overflow-hidden',
                user.avatarBorder === 'flame' && 'border-flame',
                user.avatarBorder === 'neon' && 'border-neon',
                user.avatarBorder === 'diamond' && 'border-diamond',
                !user.avatarBorder && 'border-2 border-casino-border',
              )}>
                <img
                  src={user.avatar || '/avatars/default-1.png'}
                  alt={user.pseudo}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = '/avatars/default-1.png'; }}
                />
              </div>
              {user.grade !== 'NONE' && (
                <span className="absolute -top-1 -right-1 text-xs">{GRADE_ICONS[user.grade]}</span>
              )}
            </Link>

            <button
              onClick={logout}
              className="text-gray-500 hover:text-red-400 transition-colors p-1"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
