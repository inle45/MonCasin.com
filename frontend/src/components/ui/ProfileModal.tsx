'use client';

import { useEffect, useState } from 'react';
import api, { formatBalance } from '@/lib/api';
import { X, Swords, Trophy } from 'lucide-react';

const GRADE_ICONS: Record<string, string> = {
  NONE: '',
  SILVER: '🥈',
  GOLD: '🥇',
  PLATINUM: '💠',
  DIAMOND: '💎',
};

interface ActivityItem {
  type: 'achievement' | 'win';
  icon: string;
  label: string;
  date: string;
}

interface PublicProfile {
  pseudo: string;
  avatar: string;
  grade: string;
  level: number;
  title?: string;
  xp: number;
  streak: number;
  createdAt: string;
  stats: {
    totalBets: number;
    totalWon: number;
    biggestWin: number;
    bestMultiplier: number;
    favoriteGame: string;
  };
  activity?: ActivityItem[];
}

export default function ProfileModal({
  pseudo,
  onClose,
}: {
  pseudo: string;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/users/public/${encodeURIComponent(pseudo)}`)
      .then((res) => setProfile(res.data))
      .catch(() => setError('Profil introuvable'))
      .finally(() => setLoading(false));
  }, [pseudo]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const joinDate = profile
    ? new Date(profile.createdAt).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const GAME_LABELS: Record<string, string> = {
    CRASH: 'Crash',
    ROULETTE: 'Roulette',
    SLOTS: 'Slots',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4 bg-casino-dark border border-casino-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          aria-label="Fermer le profil"
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {loading && (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Chargement…
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-48 text-red-400 text-sm">
            {error}
          </div>
        )}

        {profile && !loading && (
          <>
            {/* Header */}
            <div className="flex flex-col items-center gap-2 p-6 pb-4 bg-gradient-to-b from-casino-darker to-casino-dark">
              <img
                src={profile.avatar || '/avatars/default-1.svg'}
                alt={profile.pseudo}
                className="w-20 h-20 rounded-full border-2 border-casino-gold object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/avatars/default-1.svg';
                }}
              />
              <div className="flex items-center gap-2">
                {GRADE_ICONS[profile.grade] && (
                  <span className="text-lg">{GRADE_ICONS[profile.grade]}</span>
                )}
                <span className="text-white font-bold text-lg">{profile.pseudo}</span>
              </div>
              {profile.title && (
                <span className="text-xs text-casino-gold/70 italic">{profile.title}</span>
              )}
              <div className="flex items-center gap-2 flex-wrap justify-center">
                {profile.grade !== 'NONE' && (
                  <span className="text-xs bg-casino-gold/20 text-casino-gold border border-casino-gold/30 px-2 py-0.5 rounded-full">
                    {profile.grade}
                  </span>
                )}
                <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                  Niv. {profile.level}
                </span>
                {profile.streak > 0 && (
                  <span className="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">
                    🔥 {profile.streak}j
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-xs">Membre depuis le {joinDate}</p>
            </div>

            {/* Stats */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Trophy className="w-4 h-4 text-casino-gold" />
                <span className="text-xs font-semibold text-casino-gold uppercase tracking-wider">
                  Statistiques
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-casino-darker rounded-xl p-3 text-center">
                  <p className="text-gray-400 text-xs mb-1">Paris totaux</p>
                  <p className="text-white font-bold">{profile.stats.totalBets.toLocaleString('fr-FR')}</p>
                </div>
                <div className="bg-casino-darker rounded-xl p-3 text-center">
                  <p className="text-gray-400 text-xs mb-1">Paris gagnés</p>
                  <p className="text-green-400 font-bold">{profile.stats.totalWon.toLocaleString('fr-FR')}</p>
                </div>
                <div className="bg-casino-darker rounded-xl p-3 text-center">
                  <p className="text-gray-400 text-xs mb-1">Plus grand gain</p>
                  <p className="text-casino-gold font-bold text-sm">
                    {profile.stats.biggestWin > 0
                      ? formatBalance(profile.stats.biggestWin)
                      : '—'}
                  </p>
                </div>
                <div className="bg-casino-darker rounded-xl p-3 text-center">
                  <p className="text-gray-400 text-xs mb-1">Meilleur mult.</p>
                  <p className="text-blue-400 font-bold">
                    {profile.stats.bestMultiplier > 0
                      ? `${profile.stats.bestMultiplier.toFixed(2)}x`
                      : '—'}
                  </p>
                </div>
                <div className="bg-casino-darker rounded-xl p-3 text-center col-span-2">
                  <p className="text-gray-400 text-xs mb-1">Jeu favori</p>
                  <p className="text-white font-bold">
                    {profile.stats.favoriteGame
                      ? (GAME_LABELS[profile.stats.favoriteGame] ?? profile.stats.favoriteGame)
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Activité récente */}
            {profile.activity && profile.activity.length > 0 && (
              <div className="px-5 pb-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">⚡ Activité récente</div>
                <div className="flex flex-col gap-1.5">
                  {profile.activity.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
                      style={{ background: a.type === 'achievement' ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${a.type === 'achievement' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)'}` }}>
                      <span className="text-base flex-shrink-0">{a.icon}</span>
                      <span className="text-gray-300 flex-1 leading-tight">{a.label}</span>
                      <span className="text-gray-600 flex-shrink-0">{new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duel button */}
            <div className="px-5 pb-5 pt-2">
              <button
                onClick={() => {
                  window.location.href = `/duel?target=${encodeURIComponent(pseudo)}`;
                }}
                className="w-full flex items-center justify-center gap-2 bg-casino-gold hover:bg-casino-gold-light text-black font-semibold py-2.5 rounded-xl transition-colors"
              >
                <Swords className="w-4 h-4" />
                Défier en duel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
