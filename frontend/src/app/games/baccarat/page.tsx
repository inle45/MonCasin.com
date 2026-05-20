'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import toast from 'react-hot-toast';
import { sfx } from '@/lib/sfx';

interface Card { rank: string; suit: string; }
interface Result {
  playerCards: Card[]; bankerCards: Card[];
  playerTotal: number; bankerTotal: number;
  winner: 'player' | 'banker' | 'tie';
  betOn: string; payout: number; profit: number;
  newBalance: number; natural?: boolean;
}

const SUIT_COLOR: Record<string, string> = { '♥': '#ef4444', '♦': '#ef4444', '♠': '#fff', '♣': '#fff' };
const BETS = [100, 250, 500, 1000, 2500, 5000];

function CardComp({ card, hidden }: { card: Card; hidden?: boolean }) {
  return (
    <motion.div initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ duration: 0.35 }}
      className="w-12 h-16 rounded-lg flex flex-col items-center justify-center text-sm font-black shadow-lg"
      style={{ background: hidden ? 'linear-gradient(135deg,#1e1b4b,#312e81)' : '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
      {hidden ? <span className="text-indigo-400 text-xl">🂠</span> : (
        <>
          <span style={{ color: SUIT_COLOR[card.suit] }}>{card.rank}</span>
          <span style={{ color: SUIT_COLOR[card.suit] }}>{card.suit}</span>
        </>
      )}
    </motion.div>
  );
}

export default function BaccaratPage() {
  const { user, updateUser } = useAuth();
  const [bet, setBet] = useState(500);
  const [betOn, setBetOn] = useState<'player' | 'banker' | 'tie'>('player');
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<('player'|'banker'|'tie')[]>([]);

  const play = async () => {
    if (playing || !user || user.balance < bet) return;
    setPlaying(true);
    setResult(null);
    try {
      const res = await api.post('/games/baccarat/play', { bet, betOn });
      const data: Result = res.data;
      setResult(data);
      updateUser({ balance: data.newBalance });
      setHistory(prev => [data.winner, ...prev].slice(0, 20));
      if (data.profit > 0) { sfx.win(); toast.success(`🎴 ${data.winner === 'tie' ? 'Égalité !' : data.winner === 'player' ? 'Joueur gagne !' : 'Banquier gagne !'} +${formatBalance(data.payout)}`); }
      else { sfx.lose(); toast.error(`💸 ${data.winner === 'player' ? 'Joueur' : data.winner === 'banker' ? 'Banquier' : 'Égalité'} gagne — Perdu`); }
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Erreur'); }
    finally { setPlaying(false); }
  };

  const winnerLabel = { player: 'Joueur', banker: 'Banquier', tie: 'Égalité' };
  const winnerColor = { player: '#3b82f6', banker: '#ef4444', tie: '#f59e0b' };

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-20 pb-10 flex flex-col gap-5">
        <div className="text-center">
          <h1 className="text-3xl font-black text-casino-gold">🎴 Baccarat</h1>
          <p className="text-gray-400 text-sm mt-1">Joueur vs Banquier — Règles officielles</p>
        </div>

        {/* Table */}
        <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(145deg,#064e3b,#065f46)', border: '2px solid rgba(34,197,94,0.3)' }}>
          {['banker', 'player'].map(side => {
            const cards: Card[] = result ? (side === 'banker' ? result.bankerCards : result.playerCards) : [];
            const total = result ? (side === 'banker' ? result.bankerTotal : result.playerTotal) : null;
            return (
              <div key={side} className={`mb-4 ${side === 'player' ? 'mt-4 pt-4 border-t border-white/10' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white/80">{side === 'banker' ? '🏦 Banquier' : '👤 Joueur'}</span>
                  {total !== null && (
                    <span className="text-xl font-black" style={{ color: result?.winner === side ? '#22c55e' : '#fff' }}>{total}</span>
                  )}
                </div>
                <div className="flex gap-2 min-h-16">
                  <AnimatePresence>
                    {cards.map((card, i) => <CardComp key={i} card={card} />)}
                    {!result && <div className="w-12 h-16 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center text-white/20 text-xs">?</div>}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}

          {result && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center mt-3 py-3 rounded-xl"
              style={{ background: `${winnerColor[result.winner]}20`, border: `1px solid ${winnerColor[result.winner]}40` }}>
              <div className="font-black text-lg" style={{ color: winnerColor[result.winner] }}>
                {winnerLabel[result.winner]} gagne !{result.natural ? ' (Natural)' : ''}
              </div>
              <div className={`text-sm font-bold mt-0.5 ${result.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {result.profit > 0 ? `+${formatBalance(result.payout)}` : `-${formatBalance(bet)}`}
              </div>
            </motion.div>
          )}
        </div>

        {/* Pari sur */}
        <div className="flex gap-3">
          {(['player', 'banker', 'tie'] as const).map(side => {
            const odds = side === 'tie' ? '×9' : side === 'banker' ? '×0.95' : '×2';
            const colors = { player: '#3b82f6', banker: '#ef4444', tie: '#f59e0b' };
            const labels = { player: '👤 Joueur', banker: '🏦 Banquier', tie: '🤝 Égalité' };
            return (
              <button key={side} onClick={() => setBetOn(side)}
                className="flex-1 py-3 rounded-xl text-sm font-black transition-all"
                style={{
                  background: betOn === side ? `${colors[side]}25` : 'rgba(255,255,255,0.04)',
                  border: betOn === side ? `2px solid ${colors[side]}` : '1px solid rgba(255,255,255,0.1)',
                  color: betOn === side ? colors[side] : '#6b7280',
                }}>
                <div>{labels[side]}</div>
                <div className="text-xs opacity-70">{odds}</div>
              </button>
            );
          })}
        </div>

        {/* Mise */}
        <div className="grid grid-cols-3 gap-2">
          {BETS.map(b => (
            <button key={b} onClick={() => setBet(b)}
              className="py-2 rounded-xl text-sm font-bold"
              style={{ background: bet === b ? 'linear-gradient(135deg,#b45309,#f59e0b)' : 'rgba(30,27,75,0.7)', color: bet === b ? '#000' : '#9ca3af', border: bet === b ? '2px solid #fbbf24' : '1px solid rgba(245,158,11,0.15)' }}>
              {b.toLocaleString('fr-FR')}
            </button>
          ))}
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={play}
          disabled={playing || (user?.balance ?? 0) < bet}
          className="w-full py-4 rounded-2xl text-xl font-black disabled:opacity-50"
          style={{ background: playing ? 'rgba(20,20,40,0.8)' : 'linear-gradient(135deg,#064e3b,#10b981)', color: '#fff', boxShadow: playing ? 'none' : '0 0 25px rgba(16,185,129,0.4)' }}>
          {playing ? '🎴 Distribution...' : `🎴 MISER SUR ${betOn === 'player' ? 'JOUEUR' : betOn === 'banker' ? 'BANQUIER' : 'ÉGALITÉ'} — ${formatBalance(bet)}`}
        </motion.button>

        {/* Historique */}
        {history.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {history.map((w, i) => (
              <div key={i} className="w-6 h-6 rounded-full text-xs flex items-center justify-center font-black"
                style={{ background: w === 'player' ? '#3b82f6' : w === 'banker' ? '#ef4444' : '#f59e0b', color: '#fff' }}>
                {w === 'player' ? 'J' : w === 'banker' ? 'B' : 'E'}
              </div>
            ))}
          </div>
        )}

        <div className="text-center text-sm text-gray-400">Solde : <span className="text-casino-gold font-bold">{formatBalance(user?.balance ?? 0)}</span></div>
      </div>
    </div>
  );
}
