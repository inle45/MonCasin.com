'use client';

import { useSocket } from '@/context/SocketContext';
import { useEffect, useState } from 'react';

function Countdown({ target }: { target: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const tick = () => setSecs(Math.max(0, Math.floor((new Date(target).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return <span className="font-mono">{String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</span>;
}

export default function HappyHourBanner() {
  const { happyHour } = useSocket();

  if (happyHour.active) {
    return (
      <div className="fixed top-14 left-0 right-0 z-40 text-center py-1.5 text-sm font-black text-orange-900"
        style={{ background: 'linear-gradient(90deg,#f97316,#fbbf24,#f97316)', backgroundSize: '200% 100%', animation: 'shimmer 2s infinite' }}>
        🎉 HAPPY HOUR — +50% sur tous les gains ! Reste <Countdown target={happyHour.endsAt!} />
      </div>
    );
  }

  return null;
}
