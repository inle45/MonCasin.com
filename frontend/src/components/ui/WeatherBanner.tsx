'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/context/SocketContext';
import api from '@/lib/api';

interface Weather {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  bonusType: string;
  changedAt: string;
}

export default function WeatherBanner() {
  const { socket } = useSocket();
  const [weather, setWeather] = useState<Weather | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    api.get('/weather').then(r => setWeather(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('weather:update', (w: Weather) => { setWeather(w); setVisible(true); });
    return () => { socket.off('weather:update'); };
  }, [socket]);

  if (!weather || weather.bonusType === 'none' || !visible) return null;

  return (
    <div className="fixed top-14 left-0 right-0 z-30 flex justify-center pointer-events-none">
      <div
        className="flex items-center gap-3 px-5 py-2 rounded-full text-sm font-bold shadow-xl pointer-events-auto"
        style={{ background: 'rgba(18,18,31,0.95)', border: '1px solid rgba(245,158,11,0.3)', backdropFilter: 'blur(10px)' }}
      >
        <span className="text-xl">{weather.emoji}</span>
        <span className="text-white">{weather.name}</span>
        <span className="text-casino-gold">·</span>
        <span className="text-gray-300 text-xs">{weather.desc}</span>
        <button onClick={() => setVisible(false)} className="text-gray-600 hover:text-gray-400 ml-1 text-xs">✕</button>
      </div>
    </div>
  );
}
