'use client';

import { useState, useRef, useEffect } from 'react';
import { Music, Volume2, VolumeX, ChevronUp, ChevronDown } from 'lucide-react';

const TRACKS = [
  { id: 'jazz',   label: '🎷 Jazz Casino',   src: 'https://stream.zeno.fm/yn65f9gynhzuv' },
  { id: 'lofi',   label: '☕ Lo-Fi Chill',    src: 'https://stream.zeno.fm/f3wvbbqmdg8uv' },
  { id: 'electro',label: '⚡ Electro Night',  src: 'https://stream.zeno.fm/4d5dxpvdf5zuv' },
];

export default function MusicPlayer() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [track, setTrack] = useState(0);
  const [volume, setVolume] = useState(0.3);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
    }
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.src = TRACKS[track].src;
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  const changeTrack = (i: number) => {
    setTrack(i);
    if (audioRef.current && playing) {
      audioRef.current.src = TRACKS[i].src;
      audioRef.current.play().catch(() => {});
    }
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  return (
    <div className="fixed bottom-24 right-5 z-40">
      {open && (
        <div className="mb-2 rounded-2xl p-4 flex flex-col gap-3 w-56 shadow-2xl"
          style={{ background: 'rgba(18,18,31,0.97)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">🎵 Ambiance</div>
          {TRACKS.map((t, i) => (
            <button key={t.id} onClick={() => changeTrack(i)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left"
              style={{ background: track === i ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)', color: track === i ? '#f59e0b' : '#9ca3af', border: track === i ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent' }}>
              {t.label}
              {track === i && playing && <span className="ml-auto animate-pulse">▶</span>}
            </button>
          ))}
          <div className="flex items-center gap-2 pt-1 border-t border-white/5">
            <VolumeX className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <input type="range" min="0" max="1" step="0.05" value={volume}
              onChange={e => changeVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-casino-gold" />
            <Volume2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 justify-end">
        <button onClick={() => setOpen(o => !o)}
          className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
          style={{ background: 'rgba(18,18,31,0.95)', border: '1px solid rgba(245,158,11,0.2)' }}>
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </button>
        <button onClick={togglePlay}
          className="w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110"
          style={{ background: playing ? 'linear-gradient(135deg,#b45309,#f59e0b)' : 'rgba(18,18,31,0.95)', border: playing ? 'none' : '1px solid rgba(245,158,11,0.2)' }}>
          <Music className={`w-5 h-5 ${playing ? 'text-black animate-pulse' : 'text-gray-400'}`} />
        </button>
      </div>
    </div>
  );
}
