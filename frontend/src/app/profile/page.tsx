'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import { formatBalance } from '@/lib/api';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { Camera, User } from 'lucide-react';

const GRADE_INFO: Record<string, { label: string; color: string; icon: string }> = {
  NONE: { label: 'Joueur', color: 'text-gray-400', icon: '👤' },
  SILVER: { label: 'Silver', color: 'text-gray-300', icon: '🥈' },
  GOLD: { label: 'Gold', color: 'text-yellow-400', icon: '🥇' },
  PLATINUM: { label: 'Platinum', color: 'text-cyan-300', icon: '💠' },
  DIAMOND: { label: 'Diamond', color: 'text-blue-300', icon: '💎' },
};

const DEFAULT_AVATARS = [1, 2, 3, 4, 5];

export default function ProfilePage() {
  const { user, updateUser, isLoading } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pseudo, setPseudo] = useState(user?.pseudo || '');
  const [savingPseudo, setSavingPseudo] = useState(false);

  if (!isLoading && !user) { router.push('/login'); return null; }
  if (!user) return null;

  const gradeInfo = GRADE_INFO[user.grade] || GRADE_INFO.NONE;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser({ avatar: res.data.avatar });
      toast.success('Photo de profil mise à jour !');
    } catch {
      toast.error('Erreur lors du téléchargement');
    } finally {
      setUploading(false);
    }
  };

  const selectDefaultAvatar = async (n: number) => {
    try {
      const res = await api.put('/auth/profile', { avatar: `/api/avatars/default-${n}.png` });
      updateUser({ avatar: res.data.user.avatar });
      toast.success('Avatar mis à jour !');
    } catch {
      toast.error('Erreur');
    }
  };

  const savePseudo = async () => {
    if (!pseudo.trim() || pseudo === user.pseudo) return;
    setSavingPseudo(true);
    try {
      const res = await api.put('/auth/profile', { pseudo: pseudo.trim() });
      updateUser({ pseudo: res.data.user.pseudo });
      toast.success('Pseudo mis à jour !');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur');
    } finally {
      setSavingPseudo(false);
    }
  };

  return (
    <div className="min-h-screen bg-casino-dark">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-8">
        <div className="casino-card p-6">
          <h1 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <User className="text-casino-gold" />
            Mon Profil
          </h1>

          {/* Avatar */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <div className={clsx(
                'w-24 h-24 rounded-full overflow-hidden',
                user.avatarBorder === 'flame' && 'border-flame',
                user.avatarBorder === 'neon' && 'border-neon',
                user.avatarBorder === 'diamond' && 'border-diamond',
                !user.avatarBorder && 'border-4 border-casino-gold',
              )}>
                <img
                  src={user.avatar || '/avatars/default-1.png'}
                  alt={user.pseudo}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = '/avatars/default-1.png'; }}
                />
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 bg-casino-gold text-black p-1.5 rounded-full hover:bg-casino-gold-light transition-colors"
              >
                <Camera className="w-3 h-3" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </div>

            <div className="mt-3 text-center">
              <div className="text-xl font-bold" style={{ color: user.pseudoColor && user.pseudoColor !== 'rainbow' ? user.pseudoColor : 'white' }}>
                {user.pseudo}
              </div>
              <div className={clsx('text-sm', gradeInfo.color)}>
                {gradeInfo.icon} {gradeInfo.label}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-casino-darker rounded-lg p-4 text-center">
              <div className="text-casino-gold text-2xl font-black">{formatBalance(user.balance)}</div>
              <div className="text-gray-400 text-xs mt-1">Solde actuel</div>
            </div>
            <div className="bg-casino-darker rounded-lg p-4 text-center">
              <div className="text-white text-2xl font-black">{gradeInfo.icon}</div>
              <div className="text-gray-400 text-xs mt-1">Grade {gradeInfo.label}</div>
            </div>
          </div>

          {/* Avatars par défaut */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Avatars par défaut</h3>
            <div className="flex gap-3">
              {DEFAULT_AVATARS.map(n => (
                <button
                  key={n}
                  onClick={() => selectDefaultAvatar(n)}
                  className="w-12 h-12 rounded-full overflow-hidden border-2 border-casino-border hover:border-casino-gold transition-colors"
                >
                  <img src={`/avatars/default-${n}.png`} alt={`Avatar ${n}`} className="w-full h-full object-cover"
                    onError={e => {
                      const el = e.target as HTMLImageElement;
                      el.parentElement!.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold">${n}</div>`;
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Modifier le pseudo */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Modifier le pseudo</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={pseudo}
                onChange={e => setPseudo(e.target.value)}
                className="flex-1 bg-casino-darker border border-casino-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-casino-gold"
                maxLength={20}
                minLength={2}
              />
              <button
                onClick={savePseudo}
                disabled={savingPseudo || pseudo === user.pseudo || pseudo.length < 2}
                className="bg-casino-gold hover:bg-casino-gold-light disabled:opacity-50 text-black font-bold px-4 py-2 rounded-lg transition-colors"
              >
                {savingPseudo ? '...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
