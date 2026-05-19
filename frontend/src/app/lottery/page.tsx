'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import toast from 'react-hot-toast';
import { sfx } from '@/lib/sfx';

type Participant = { pseudo: string; avatar: string | null; grade: string };
type DrawResult = {
  id: string;
  day: string;
  jackpot: number;
  noWinner: boolean;
  winner?: { pseudo: string; avatar: string | null } | null;
  drawnAt: string;
};

type LotteryState = {
  day: string;
  jackpot: number;
  ticketPrice: number;
  hasTicket: boolean;
  participants: Participant[];
  history: DrawResult[];
};

const GRADE_COLORS: Record<string, string> = {
  NONE: '#9ca3af', SILVER: '#94a3b8', GOLD: '#f59e0b', PLATINUM: '#7dd3fc', DIAMOND: '#c084fc',
};

function MidnightCountdown() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      setSecs(Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return <span className="font-mono text-casino-gold">{String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</span>;
}

export default function LotteryPage() {
  const { user, updateUser } = useAuth();
  const { socket } = useSocket();
  const [state, setState] = useState<LotteryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  const fetchState = useCallback(() => {
    api.get('/lottery')
      .then(r => setState(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchState(); }, [fetchState]);

  useEffect(() => {
    if (!socket) return;

    socket.on('lottery:joined', (data: Participant) => {
      setState(prev => prev ? { ...prev, participants: [...prev.participants, data] } : prev);
    });

    socket.on('lottery:result', (data: { day: string; noWinner: boolean; jackpot: number; winner?: { id: string; pseudo: string } }) => {
      sfx.win();
      if (data.noWinner) {
        toast(`🎟️ Personne n'a gagné la loterie du ${data.day} — jackpot reporté !`, { icon: '😅', duration: 6000 });
      } else {
        toast.success(`🎉 ${data.winner?.pseudo} remporte ${formatBalance(data.jackpot)} F€ à la loterie !`, { duration: 8000 });
        if (data.winner?.id === user?.id) sfx.bigWin();
      }
      fetchState();
    });

    return () => {
      socket.off('lottery:joined');
      socket.off('lottery:result');
    };
  }, [socket, user, fetchState]);

  async function buyTicket() {
    if (buying || state?.hasTicket) return;
    setBuying(true);
    try {
      const r = await api.post('/lottery/ticket');
      sfx.coin();
      toast.success('🎟️ Ticket acheté ! Bonne chance ce soir !');
      updateUser({ balance: r.data.newBalance });
      setState(prev => prev ? { ...prev, hasTicket: true } : prev);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Impossible d\'acheter un ticket');
    } finally {
      setBuying(false);
    }
  }

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-20 pb-10 flex flex-col gap-5">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-black text-casino-gold">🎟️ Loterie Quotidienne</h1>
          <p className="text-gray-400 text-sm mt-1">
            Tirage dans <MidnightCountdown /> · 25% de chance que personne ne gagne
          </p>
        </div>

        {/* Jackpot */}
        {state && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-6 text-center"
            style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(192,132,252,0.12))', border: '2px solid rgba(245,158,11,0.3)', boxShadow: '0 0 40px rgba(245,158,11,0.15)' }}
          >
            <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">Jackpot du soir</div>
            <motion.div
              key={state.jackpot}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className="text-5xl font-black text-casino-gold"
              style={{ textShadow: '0 0 30px rgba(245,158,11,0.5)' }}
            >
              {formatBalance(state.jackpot)}
            </motion.div>
            <div className="text-sm text-gray-400 mt-1">{state.participants.length} participant{state.participants.length !== 1 ? 's' : ''}</div>

            {/* Bouton ticket */}
            <div className="mt-5">
              {state.hasTicket ? (
                <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 font-bold">
                  ✓ Ticket acheté — bonne chance !
                </div>
              ) : (
                <button
                  onClick={buyTicket}
                  disabled={buying || (user?.balance ?? 0) < state.ticketPrice}
                  className="px-8 py-3 rounded-xl font-bold text-black text-base transition-all disabled:opacity-50 bg-casino-gold hover:bg-yellow-400 active:scale-95"
                  style={{ boxShadow: '0 0 20px rgba(245,158,11,0.4)' }}
                >
                  {buying ? 'Achat...' : `Acheter mon ticket — ${formatBalance(state.ticketPrice)}`}
                </button>
              )}
              <div className="text-xs text-gray-500 mt-2">1 ticket par joueur par jour</div>
            </div>
          </motion.div>
        )}

        {/* Participants */}
        {state && state.participants.length > 0 && (
          <div>
            <div className="text-sm text-gray-400 font-medium uppercase tracking-wider px-1 mb-2">
              Participants ({state.participants.length})
            </div>
            <div className="rounded-xl p-3 flex flex-wrap gap-2"
              style={{ background: 'rgba(30,27,75,0.5)', border: '1px solid rgba(245,158,11,0.1)' }}>
              <AnimatePresence>
                {state.participants.map((p, i) => (
                  <motion.div
                    key={`${p.pseudo}-${i}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                    style={{ background: 'rgba(0,0,0,0.3)' }}
                  >
                    <img
                      src={p.avatar || '/avatars/default-1.png'}
                      className="w-5 h-5 rounded-full"
                      onError={e => { (e.target as HTMLImageElement).src = '/avatars/default-1.png'; }}
                    />
                    <span className="text-xs font-medium" style={{ color: GRADE_COLORS[p.grade] || '#9ca3af' }}>
                      {p.pseudo}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {state && state.participants.length === 0 && !loading && (
          <div className="rounded-xl py-8 text-center text-gray-500"
            style={{ background: 'rgba(30,27,75,0.4)', border: '1px solid rgba(245,158,11,0.1)' }}>
            Aucun participant pour l'instant.<br />
            <span className="text-casino-gold font-bold">Sois le premier !</span>
          </div>
        )}

        {/* Historique */}
        {state && state.history.length > 0 && (
          <div>
            <div className="text-sm text-gray-400 font-medium uppercase tracking-wider px-1 mb-2">Historique</div>
            <div className="flex flex-col gap-2">
              {state.history.map((draw, i) => (
                <motion.div
                  key={draw.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{ background: 'rgba(30,27,75,0.4)', border: `1px solid ${draw.noWinner ? 'rgba(107,114,128,0.2)' : 'rgba(245,158,11,0.2)'}` }}
                >
                  <span className="text-2xl">{draw.noWinner ? '😅' : '🎉'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">
                      {draw.noWinner ? 'Personne n\'a gagné' : draw.winner?.pseudo ?? 'Gagnant'}
                    </div>
                    <div className="text-xs text-gray-500">{draw.day}</div>
                  </div>
                  <div className={`font-black text-sm ${draw.noWinner ? 'text-gray-500' : 'text-casino-gold'}`}>
                    {draw.noWinner ? 'Reporté' : `+${formatBalance(draw.jackpot)}`}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-600 mt-2">
          Le tirage est effectué automatiquement à minuit chaque jour.<br />
          25% de chance que personne ne gagne — le jackpot est reporté au lendemain.
        </p>
      </div>
    </div>
  );
}
