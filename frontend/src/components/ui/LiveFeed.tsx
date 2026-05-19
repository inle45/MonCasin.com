'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSocket, LiveEvent } from '@/context/SocketContext';
import { formatBalance } from '@/lib/api';

export default function LiveFeed() {
  const { liveEvents } = useSocket();
  const [visible, setVisible] = useState<LiveEvent[]>([]);

  useEffect(() => {
    if (liveEvents.length === 0) return;
    const newest = liveEvents[0];
    setVisible(prev => {
      if (prev.find(e => e.id === newest.id)) return prev;
      return [newest, ...prev].slice(0, 5);
    });

    const timer = setTimeout(() => {
      setVisible(prev => prev.filter(e => e.id !== newest.id));
    }, 4500);
    return () => clearTimeout(timer);
  }, [liveEvents]);

  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 flex flex-col gap-2 pointer-events-none max-w-[240px]">
      <AnimatePresence mode="popLayout">
        {visible.map(ev => (
          <motion.div
            key={ev.id}
            layout
            initial={{ opacity: 0, x: -40, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -30, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="rounded-xl px-3 py-2 flex items-center gap-2 text-sm shadow-xl"
            style={{
              background: 'rgba(18,18,31,0.92)',
              border: '1px solid rgba(245,158,11,0.25)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span className="text-xl flex-shrink-0">{ev.emoji}</span>
            <div className="min-w-0">
              <div className="font-bold text-white text-xs truncate">{ev.pseudo}</div>
              <div className="text-gray-400 text-[11px] leading-tight truncate">{ev.message}</div>
            </div>
            <div className={`font-black text-xs flex-shrink-0 ${ev.positive ? 'text-green-400' : 'text-red-400'}`}>
              +{formatBalance(ev.amount)}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
