'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { sfx } from '@/lib/sfx';
import { formatBalance } from '@/lib/api';

export interface LiveEvent {
  id: string;
  pseudo: string;
  emoji: string;
  message: string;
  amount: number;
  positive: boolean;
  ts: number;
}

export interface HappyHourStatus {
  active: boolean;
  endsAt?: string;
  nextAt?: string;
  multiplier?: number;
}

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  jackpot: number;
  liveEvents: LiveEvent[];
  happyHour: HappyHourStatus;
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false, jackpot: 0, liveEvents: [], happyHour: { active: false } });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, updateUser } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [jackpot, setJackpot] = useState(0);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [happyHour, setHappyHour] = useState<HappyHourStatus>({ active: false });

  useEffect(() => {
    if (!token) {
      if (socket) { socket.disconnect(); setSocket(null); setConnected(false); }
      return;
    }

    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const SOCKET_URL = isLocal ? 'http://localhost:3001' : 'https://moncasin-backend.onrender.com';
    const s = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    s.on('slots:jackpot', (data) => setJackpot(data.jackpot ?? 0));

    s.on('livefeed:event', (data) => {
      setLiveEvents(prev => [{ ...data, ts: Date.now() }, ...prev].slice(0, 8));
    });

    s.on('achievement:unlocked', (data) => {
      sfx.achievement();
      toast.custom(() => (
        <div className="bg-casino-card border border-casino-gold/50 rounded-xl px-5 py-4 shadow-xl flex items-center gap-3 max-w-sm">
          <span className="text-4xl">{data.icon}</span>
          <div>
            <div className="text-casino-gold font-bold text-sm">Succès débloqué !</div>
            <div className="text-white font-bold">{data.name}</div>
            <div className="text-gray-400 text-xs mt-0.5">{data.description}</div>
            {data.reward > 0 && (
              <div className="text-green-400 text-xs mt-1 font-bold">+{data.reward.toLocaleString('fr-FR')} F€</div>
            )}
          </div>
        </div>
      ), { duration: 6000 });
    });

    s.on('pay:received', (data) => {
      sfx.coin();
      toast.success(`💸 ${data.from} t'a envoyé ${data.amount.toLocaleString('fr-FR')} F€ !`, { duration: 5000 });
    });

    s.on('rain:received', (data) => {
      sfx.coin();
      updateUser({ balance: data.newBalance });
      toast.custom(() => (
        <div className="bg-casino-card border border-blue-400/50 rounded-xl px-5 py-4 shadow-xl flex items-center gap-3 max-w-sm">
          <span className="text-4xl">☔</span>
          <div>
            <div className="text-blue-400 font-bold text-sm">Il pleut des F€ !</div>
            <div className="text-white font-bold">{data.from} fait pleuvoir</div>
            <div className="text-green-400 text-xs mt-1 font-bold">+{data.amount.toLocaleString('fr-FR')} F€ pour toi !</div>
          </div>
        </div>
      ), { duration: 6000 });
    });

    s.on('loan:repaid', (data) => {
      toast(`🏦 ${data.deducted.toLocaleString('fr-FR')} F€ déduits pour le remboursement du prêt`, { icon: '🏦', duration: 4000 });
    });

    s.on('xp:levelup', (data: { level: number; xp: number; reward: number; chestReward: number }) => {
      sfx.achievement();
      updateUser({ level: data.level, xp: data.xp });
      toast.custom(() => (
        <div className="bg-casino-card border border-purple-500/50 rounded-xl px-5 py-4 shadow-xl flex items-center gap-3 max-w-sm">
          <span className="text-4xl">⭐</span>
          <div>
            <div className="text-purple-400 font-bold text-sm">Level Up !</div>
            <div className="text-white font-bold">Niveau {data.level} atteint</div>
            {data.reward > 0 && <div className="text-green-400 text-xs mt-1 font-bold">+{formatBalance(data.reward)} F€</div>}
          </div>
        </div>
      ), { duration: 4000 });

      if (data.chestReward > 0) {
        setTimeout(() => {
          sfx.coin();
          toast.custom(() => (
            <div className="bg-casino-card border border-yellow-500/50 rounded-xl px-5 py-4 shadow-xl flex items-center gap-3 max-w-sm">
              <span className="text-5xl animate-bounce">📦</span>
              <div>
                <div className="text-yellow-400 font-bold text-sm">Coffre de niveau !</div>
                <div className="text-white font-bold">Tu as ouvert un coffre</div>
                <div className="text-green-400 text-xs mt-1 font-bold">+{formatBalance(data.chestReward)} F€ à l'intérieur !</div>
              </div>
            </div>
          ), { duration: 6000 });
        }, 1500);
      }
    });

    s.on('happyhour:update', (data: HappyHourStatus) => {
      setHappyHour(data);
      if (data.active) {
        sfx.achievement();
        toast.custom(() => (
          <div className="bg-casino-card border border-orange-500/50 rounded-xl px-5 py-4 shadow-xl flex items-center gap-3 max-w-sm">
            <span className="text-4xl">🎉</span>
            <div>
              <div className="text-orange-400 font-bold text-sm">Happy Hour !</div>
              <div className="text-white font-bold">+50% sur tous les gains</div>
              <div className="text-gray-400 text-xs mt-1">Vendredi & Samedi soir</div>
            </div>
          </div>
        ), { duration: 8000 });
      }
    });

    s.on('pay:confirmed', (data) => {
      toast.success(`💸 ${data.amount.toLocaleString('fr-FR')} F€ envoyés à ${data.to} !`);
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, connected, jackpot, liveEvents, happyHour }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
