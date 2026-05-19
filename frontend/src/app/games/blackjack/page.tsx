'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import toast from 'react-hot-toast';
import { sfx } from '@/lib/sfx';

type Card = { rank: string; suit: string };
type GameStatus = 'playing' | 'win' | 'lose' | 'push' | 'bust' | 'blackjack' | null;

type Session = {
  playerHand: Card[];
  dealerHand: Card[];
  playerTotal: number;
  dealerTotal: number;
  status: string;
  bet: number;
  doubled: boolean;
  happyHour: boolean;
};

const RED_SUITS = ['♥', '♦'];

function CardView({ card, hidden }: { card: Card; hidden?: boolean }) {
  const isRed = RED_SUITS.includes(card.suit);
  if (hidden) {
    return (
      <div className="w-14 h-20 rounded-xl flex items-center justify-center text-3xl"
        style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)', border: '2px solid rgba(99,102,241,0.4)' }}>
        🂠
      </div>
    );
  }
  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      className="w-14 h-20 rounded-xl flex flex-col items-center justify-center gap-0.5 font-black select-none"
      style={{ background: '#fff', color: isRed ? '#dc2626' : '#111', border: '2px solid rgba(0,0,0,0.1)' }}
    >
      <span className="text-xl leading-none">{card.rank}</span>
      <span className="text-2xl leading-none">{card.suit}</span>
    </motion.div>
  );
}

function Hand({ cards, total, label, result }: { cards: Card[]; total: number; label: string; result?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
        <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${total > 21 ? 'bg-red-500/20 text-red-400' : total === 21 ? 'bg-yellow-500/20 text-casino-gold' : 'bg-white/10 text-white'}`}>
          {total > 21 ? `${total} Bust` : total === 21 ? '21 !' : total}
        </span>
        {result && <span className="text-sm font-black text-casino-gold">{result}</span>}
      </div>
      <div className="flex gap-2 flex-wrap">
        {cards.map((card, i) => (
          <CardView key={i} card={card} hidden={card.rank === '?'} />
        ))}
      </div>
    </div>
  );
}

const RESULT_LABELS: Record<string, { text: string; color: string }> = {
  blackjack: { text: '🃏 BLACKJACK !', color: '#f59e0b' },
  win:       { text: '✅ Gagné !',     color: '#22c55e' },
  push:      { text: '🤝 Égalité',     color: '#60a5fa' },
  lose:      { text: '❌ Perdu',       color: '#ef4444' },
  bust:      { text: '💥 Bust !',      color: '#ef4444' },
};

export default function BlackjackPage() {
  const { user, updateUser } = useAuth();
  const { happyHour } = useSocket();
  const [session, setSession] = useState<Session | null>(null);
  const [bet, setBet] = useState('100');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: string; payout: number } | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const betVal = parseFloat(bet) || 0;

  const fetchState = useCallback(async () => {
    try {
      const r = await api.get('/games/blackjack/state');
      if (r.data.session) setSession(r.data.session);
    } catch {}
  }, []);

  useEffect(() => { fetchState(); }, [fetchState]);

  async function doAction(action: string, body?: object) {
    setLoading(true);
    try {
      const r = await api.post(`/games/blackjack/${action}`, body || {});
      setSession(r.data.session);
      if (r.data.newBalance !== undefined) updateUser({ balance: r.data.newBalance });
      if (r.data.result) {
        const res = r.data.result;
        setResult(res);
        setHistory(prev => [res.status, ...prev].slice(0, 20));
        if (res.status === 'blackjack' || res.status === 'win') { sfx.win(); if (res.payout >= 500) sfx.bigWin(); }
        else if (res.status === 'push') sfx.click();
        else sfx.lose();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  const gameOver = session && session.status !== 'playing';
  const canDouble = session?.playerHand.length === 2 && session.status === 'playing' && (user?.balance ?? 0) >= session.bet;

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-20 pb-10 flex flex-col gap-4">

        <div className="text-center">
          <h1 className="text-3xl font-black text-casino-gold">🃏 Blackjack</h1>
          <p className="text-gray-400 text-sm mt-1">Approchez le plus près de 21 sans dépasser</p>
        </div>

        {happyHour.active && (
          <div className="rounded-xl px-4 py-2.5 text-center font-bold text-orange-400 text-sm animate-pulse"
            style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)' }}>
            🎉 Happy Hour — +50% sur les gains !
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl p-5 flex flex-col gap-5 min-h-[300px]"
          style={{ background: 'linear-gradient(135deg,rgba(5,46,22,0.8),rgba(20,83,45,0.6))', border: '2px solid rgba(34,197,94,0.2)' }}>

          {session ? (
            <>
              {/* Dealer */}
              <Hand
                cards={session.dealerHand}
                total={session.dealerTotal}
                label="Croupier"
                result={gameOver ? RESULT_LABELS[result?.status ?? '']?.text : undefined}
              />

              <div className="border-t border-white/10" />

              {/* Joueur */}
              <Hand cards={session.playerHand} total={session.playerTotal} label="Toi" />

              {/* Résultat */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-3 rounded-xl"
                    style={{ background: `${RESULT_LABELS[result.status]?.color}22`, border: `1px solid ${RESULT_LABELS[result.status]?.color}44` }}
                  >
                    <div className="text-xl font-black" style={{ color: RESULT_LABELS[result.status]?.color }}>
                      {RESULT_LABELS[result.status]?.text}
                    </div>
                    {result.payout > 0 && (
                      <div className="text-casino-gold font-bold text-sm mt-1">+{formatBalance(result.payout)} F€</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-5xl">
              🃏
            </div>
          )}
        </div>

        {/* Actions */}
        {session && session.status === 'playing' ? (
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => doAction('hit')} disabled={loading}
              className="py-3.5 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 active:scale-95 transition-all">
              Tirer
            </button>
            <button onClick={() => doAction('stand')} disabled={loading}
              className="py-3.5 rounded-xl font-black text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 active:scale-95 transition-all">
              Rester
            </button>
            <button onClick={() => doAction('double')} disabled={loading || !canDouble}
              className="py-3.5 rounded-xl font-black text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 active:scale-95 transition-all">
              Doubler
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider">Mise</label>
              <div className="flex gap-2 mt-1">
                <input type="number" value={bet} onChange={e => setBet(e.target.value)} min="1"
                  className="flex-1 bg-black/30 border border-green-500/30 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:border-green-400" />
                {[100, 500, 1000, 5000].map(v => (
                  <button key={v} onClick={() => setBet(String(v))}
                    className="px-2.5 py-2 rounded-xl bg-green-500/15 text-green-400 text-xs font-bold hover:bg-green-500/25">
                    {v >= 1000 ? `${v/1000}k` : v}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => { setResult(null); doAction('start', { bet: betVal }); }}
              disabled={loading || betVal <= 0 || (user?.balance ?? 0) < betVal}
              className="w-full py-4 rounded-xl font-black text-black text-lg disabled:opacity-50 active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', boxShadow: '0 0 20px rgba(245,158,11,0.3)' }}
            >
              {loading ? 'Donne les cartes...' : 'Nouvelle partie'}
            </button>
          </div>
        )}

        {/* Historique */}
        {history.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {history.map((h, i) => (
              <span key={i} className="px-2 py-1 rounded-lg text-xs font-bold"
                style={{ background: `${RESULT_LABELS[h]?.color}22`, color: RESULT_LABELS[h]?.color }}>
                {h === 'blackjack' ? 'BJ' : h === 'win' ? 'W' : h === 'push' ? 'P' : h === 'bust' ? 'B' : 'L'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
