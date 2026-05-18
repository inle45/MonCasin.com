'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', () => setConnected(false));

    newSocket.on('achievement:unlocked', (data) => {
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

    newSocket.on('pay:received', (data) => {
      toast.success(`💸 ${data.from} t'a envoyé ${data.amount.toLocaleString('fr-FR')} F€ !`, { duration: 5000 });
    });

    newSocket.on('loan:repaid', (data) => {
      toast(`🏦 ${data.deducted.toLocaleString('fr-FR')} F€ déduits pour le remboursement du prêt`, {
        icon: '🏦',
        duration: 4000,
      });
    });

    newSocket.on('pay:confirmed', (data) => {
      toast.success(`💸 ${data.amount.toLocaleString('fr-FR')} F€ envoyés à ${data.to} !`);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
