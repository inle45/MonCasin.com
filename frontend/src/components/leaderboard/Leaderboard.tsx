'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/context/SocketContext';
import { LeaderboardUser } from '@/types';
import { formatBalance } from '@/lib/api';
import { Trophy } from 'lucide-react';
import { clsx } from 'clsx';

const RANK_STYLES = [
  'text-yellow-400',
  'text-gray-300',
  'text-amber-600',
];

export default function Leaderboard({ initial = [] }: { initial?: LeaderboardUser[] }) {
  const { socket } = useSocket();
  const [users, setUsers] = useState<LeaderboardUser[]>(initial);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: LeaderboardUser[]) => setUsers(data);
    socket.on('leaderboard:update', handler);
    return () => { socket.off('leaderboard:update', handler); };
  }, [socket]);

  return (
    <div className="casino-card">
      <div className="p-3 border-b border-casino-border flex items-center gap-2">
        <Trophy className="w-4 h-4 text-casino-gold" />
        <span className="text-sm font-medium text-white">Classement</span>
      </div>

      <div className="p-2 space-y-1">
        {users.map((u, idx) => (
          <div
            key={u.id}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <span className={clsx('text-xs font-bold w-5 text-center', RANK_STYLES[idx] || 'text-gray-500')}>
              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
            </span>
            <img
              src={u.avatar || '/avatars/default-1.png'}
              alt={u.pseudo}
              className="w-6 h-6 rounded-full"
              onError={e => { (e.target as HTMLImageElement).src = '/avatars/default-1.png'; }}
            />
            <span className="text-sm text-white flex-1 truncate">{u.pseudo}</span>
            <span className="text-xs text-casino-gold font-medium">{formatBalance(u.balance)}</span>
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-gray-500 text-xs text-center py-4">Aucun joueur</p>
        )}
      </div>
    </div>
  );
}
