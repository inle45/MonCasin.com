'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api, { formatBalance, getAvatarUrl } from '@/lib/api';
import { getPlayerTitle } from '@/lib/playerTitle';
import { Swords, Trophy, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';

const GRADE_ICONS: Record<string, string> = { NONE: '', SILVER: '🥈', GOLD: '🥇', PLATINUM: '💠', DIAMOND: '💎' };
const GAME_LABELS: Record<string, string> = { CRASH: 'Crash', ROULETTE: 'Roulette', SLOTS: 'Slots', DICE: 'Dés', MINES: 'Mines', HILO: 'Hi-Lo', LIMBO: 'Limbo', PLINKO: 'Plinko', BLACKJACK: 'Blackjack' };

export default function VisitCardPage() {
  const params = useParams();
  const pseudo = decodeURIComponent(params.pseudo as string);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get(`/users/public/${encodeURIComponent(pseudo)}`)
      .then(r => setProfile(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pseudo]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="min-h-screen bg-casino-dark flex items-center justify-center">
      <div className="text-casino-gold animate-pulse">Chargement...</div>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-casino-dark flex items-center justify-center flex-col gap-4">
      <div className="text-5xl">🎰</div>
      <div className="text-white font-black text-xl">Joueur introuvable</div>
      <Link href="/" className="text-casino-gold hover:underline">Retour à MonCasin.com</Link>
    </div>
  );

  const winRate = profile.stats.totalBets > 0
    ? Math.round((profile.stats.totalWon / profile.stats.totalBets) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-casino-dark flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        {/* Carte principale */}
        <div className="rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: 'linear-gradient(145deg,#12121f,#1a1a2e)', border: '1px solid rgba(245,158,11,0.2)' }}>

          {/* Header doré */}
          <div className="h-24 relative"
            style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.3),rgba(139,92,246,0.2),rgba(59,130,246,0.2))' }}>
            <div className="absolute inset-0 flex items-center justify-center opacity-20 text-6xl">🎰</div>
            <div className="absolute top-3 right-3 text-xs text-casino-gold/60 font-bold">MonCasin.com</div>
          </div>

          {/* Avatar */}
          <div className="flex flex-col items-center -mt-12 pb-5 px-6">
            <img src={getAvatarUrl(profile.avatar)} alt={profile.pseudo}
              className="w-24 h-24 rounded-full border-4 border-casino-dark shadow-xl object-cover"
              onError={e => { (e.target as HTMLImageElement).src = '/avatars/default-1.svg'; }} />

            <div className="mt-3 text-center">
              <div className="flex items-center gap-2 justify-center">
                {GRADE_ICONS[profile.grade] && <span>{GRADE_ICONS[profile.grade]}</span>}
                <h1 className="text-2xl font-black text-white">{profile.pseudo}</h1>
              </div>
              {profile.title && <div className="text-casino-gold/70 text-sm italic mt-0.5">{profile.title}</div>}
              <div className="flex items-center gap-2 justify-center mt-2 flex-wrap">
                {profile.grade !== 'NONE' && (
                  <span className="text-xs bg-casino-gold/15 text-casino-gold border border-casino-gold/25 px-2 py-0.5 rounded-full">{profile.grade}</span>
                )}
                <span className="text-xs bg-purple-500/15 text-purple-300 border border-purple-500/25 px-2 py-0.5 rounded-full">Niv. {profile.level}</span>
                {profile.streak > 1 && <span className="text-xs bg-orange-500/15 text-orange-300 border border-orange-500/25 px-2 py-0.5 rounded-full">🔥 {profile.streak}j</span>}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 w-full mt-5">
              {[
                { label: 'Parties', value: profile.stats.totalBets.toLocaleString('fr-FR') },
                { label: 'Taux victoire', value: `${winRate}%` },
                { label: 'Meilleur ×', value: profile.stats.bestMultiplier > 0 ? `${profile.stats.bestMultiplier.toFixed(1)}x` : '—' },
              ].map(s => (
                <div key={s.label} className="text-center p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="text-casino-gold font-black text-lg">{s.value}</div>
                  <div className="text-gray-500 text-xs">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Meilleur gain */}
            {profile.stats.biggestWin > 0 && (
              <div className="w-full mt-3 p-3 rounded-xl text-center"
                style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <div className="text-xs text-gray-400">🏆 Plus gros gain</div>
                <div className="text-green-400 font-black text-lg">{formatBalance(profile.stats.biggestWin)}</div>
              </div>
            )}

            {/* Activité récente */}
            {profile.activity && profile.activity.length > 0 && (
              <div className="w-full mt-3">
                <div className="text-xs text-gray-500 mb-2">⚡ Récent</div>
                <div className="flex flex-col gap-1.5">
                  {profile.activity.slice(0, 3).map((a: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span>{a.icon}</span>
                      <span className="text-gray-400 flex-1 truncate">{a.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 w-full mt-5">
              <button onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copié !' : 'Partager'}
              </button>
              <Link href={`/duel?target=${encodeURIComponent(pseudo)}`} className="flex-1">
                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black"
                  style={{ background: 'linear-gradient(135deg,#b45309,#f59e0b)', color: '#000' }}>
                  <Swords className="w-4 h-4" />
                  Défier
                </button>
              </Link>
            </div>

            {/* Lien retour */}
            <Link href="/dashboard" className="text-gray-600 text-xs mt-4 hover:text-gray-400">
              Jouer sur MonCasin.com →
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
