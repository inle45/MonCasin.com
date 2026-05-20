'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import toast from 'react-hot-toast';
import { sfx } from '@/lib/sfx';

interface Horse { id: number; name: string; emoji: string; color: string; odds: number; }
interface RaceResult {
  winner: Horse; chosenHorse: Horse; ranking: (Horse & { position: number })[];
  won: boolean; payout: number; profit: number; mise: number; odds: number; newBalance: number;
}

const BETS = [100, 250, 500, 1000, 2500];

export default function HorsesPage() {
  const { user, updateUser } = useAuth();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [bet, setBet] = useState(250);
  const [racing, setRacing] = useState(false);
  const [raceProgress, setRaceProgress] = useState<Record<number, number>>({});
  const [result, setResult] = useState<RaceResult | null>(null);
  const [history, setHistory] = useState<{ name: string; won: boolean; payout: number }[]>([]);

  useEffect(() => {
    api.get('/games/horses/odds').then(r => setHorses(r.data.horses)).catch(() => {});
  }, []);

  const startRace = async () => {
    if (racing || !selected || !user || user.balance < bet) return;
    setRacing(true);
    setResult(null);
    const init: Record<number, number> = {};
    horses.forEach(h => { init[h.id] = 0; });
    setRaceProgress(init);

    try {
      const res = await api.post('/games/horses/race', { horseId: selected, bet });
      const data: RaceResult = res.data;

      // Animer la course
      const duration = 3000;
      const interval = 60;
      const steps = duration / interval;
      let step = 0;

      const anim = setInterval(() => {
        step++;
        const progress: Record<number, number> = {};
        data.ranking.forEach(h => {
          const targetPct = ((data.ranking.length - h.position + 1) / data.ranking.length);
          const wobble = Math.random() * 0.15 - 0.075;
          progress[h.id] = Math.min(1, (step / steps) * (targetPct + wobble) * 1.1);
        });
        setRaceProgress(progress);

        if (step >= steps) {
          clearInterval(anim);
          // Finir proprement
          const final: Record<number, number> = {};
          data.ranking.forEach(h => { final[h.id] = (data.ranking.length - h.position + 1) / data.ranking.length; });
          setRaceProgress(final);

          setTimeout(() => {
            setResult(data);
            updateUser({ balance: data.newBalance });
            setHistory(prev => [{ name: data.chosenHorse.name, won: data.won, payout: data.payout }, ...prev].slice(0, 10));
            if (data.won) { sfx.win(); if (data.payout >= 2000) sfx.bigWin(); toast.success(`🏆 ${data.winner.name} gagne ! +${formatBalance(data.payout)}`); }
            else { sfx.lose(); toast.error(`💸 ${data.winner.name} gagne... Tu as perdu`); }
            setRacing(false);
            // Rafraîchir les cotes
            api.get('/games/horses/odds').then(r => setHorses(r.data.horses)).catch(() => {});
          }, 500);
        }
      }, interval);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur');
      setRacing(false);
    }
  };

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 pt-20 pb-10 flex flex-col gap-5">
        <div className="text-center">
          <h1 className="text-3xl font-black text-casino-gold">🏇 Courses Hippiques</h1>
          <p className="text-gray-400 text-sm mt-1">Choisissez votre cheval et regardez la course</p>
        </div>

        {/* Piste de course */}
        <div className="rounded-2xl p-4 overflow-hidden"
          style={{ background: 'linear-gradient(145deg,#14532d,#166534)', border: '2px solid rgba(34,197,94,0.3)' }}>
          <div className="text-xs text-green-300/60 mb-3 font-bold uppercase tracking-wider">🏁 Piste</div>
          <div className="flex flex-col gap-2">
            {horses.map(horse => {
              const progress = raceProgress[horse.id] ?? 0;
              const isWinner = result?.winner.id === horse.id;
              const isChosen = selected === horse.id;
              return (
                <div key={horse.id} className="relative">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold w-4">{horse.id}</span>
                    <span className="text-sm font-bold flex-1" style={{ color: horse.color }}>{horse.name}</span>
                    <span className="text-xs text-gray-400">×{horse.odds}</span>
                  </div>
                  <div className="h-8 rounded-lg overflow-hidden relative" style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <motion.div
                      className="absolute top-0 bottom-0 left-0 rounded-lg flex items-center justify-end pr-1"
                      style={{ background: `${horse.color}40`, borderRight: `2px solid ${horse.color}` }}
                      animate={{ width: `${Math.max(5, progress * 100)}%` }}
                      transition={{ duration: 0.06 }}
                    >
                      <span className="text-lg">{horse.emoji}</span>
                    </motion.div>
                    {isWinner && result && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black text-yellow-400">🏆 1er</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Ligne d'arrivée */}
          <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
            <div className="flex-1 border-t border-dashed border-white/20" />
            <span>🏁 ARRIVÉE</span>
            <div className="flex-1 border-t border-dashed border-white/20" />
          </div>
        </div>

        {/* Résultat */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-4 text-center"
              style={{ background: result.won ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${result.won ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
              <div className="text-2xl mb-1">{result.winner.emoji}</div>
              <div className="font-black text-white">{result.winner.name} a gagné !</div>
              <div className={`text-lg font-black mt-1 ${result.won ? 'text-green-400' : 'text-red-400'}`}>
                {result.won ? `+${formatBalance(result.payout)} (×${result.odds})` : `-${formatBalance(result.mise)}`}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Classement : {result.ranking.map(h => h.name).join(' → ')}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Choix du cheval */}
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Choisissez votre cheval</div>
          <div className="grid grid-cols-2 gap-2">
            {horses.map(horse => (
              <button key={horse.id} onClick={() => { if (!racing) setSelected(horse.id); }}
                disabled={racing}
                className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                style={{
                  background: selected === horse.id ? `${horse.color}20` : 'rgba(30,27,75,0.5)',
                  border: selected === horse.id ? `2px solid ${horse.color}` : '1px solid rgba(255,255,255,0.07)',
                }}>
                <span className="text-2xl">{horse.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm truncate">{horse.name}</div>
                  <div className="text-xs" style={{ color: horse.color }}>Cote ×{horse.odds}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Mise */}
        <div className="flex gap-2">
          {BETS.map(b => (
            <button key={b} onClick={() => setBet(b)}
              className="flex-1 py-2 rounded-xl text-sm font-bold"
              style={{ background: bet === b ? 'linear-gradient(135deg,#b45309,#f59e0b)' : 'rgba(30,27,75,0.7)', color: bet === b ? '#000' : '#9ca3af', border: bet === b ? '2px solid #fbbf24' : '1px solid rgba(245,158,11,0.15)' }}>
              {b >= 1000 ? `${b / 1000}k` : b}
            </button>
          ))}
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={startRace}
          disabled={racing || !selected || (user?.balance ?? 0) < bet}
          className="w-full py-4 rounded-2xl text-xl font-black disabled:opacity-50"
          style={{ background: racing ? 'rgba(20,20,40,0.8)' : 'linear-gradient(135deg,#14532d,#22c55e)', color: racing ? '#4b5563' : '#fff', boxShadow: racing ? 'none' : '0 0 25px rgba(34,197,94,0.35)' }}>
          {racing ? '🏇 Course en cours...' : selected ? `🏇 PARIER SUR ${horses.find(h => h.id === selected)?.name} — ${formatBalance(bet)}` : '← Choisissez un cheval'}
        </motion.button>

        {/* Historique */}
        {history.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg"
                style={{ background: h.won ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${h.won ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'}` }}>
                <span className="text-gray-400">{h.name}</span>
                <span className={`font-bold ${h.won ? 'text-green-400' : 'text-red-400'}`}>
                  {h.won ? `+${formatBalance(h.payout)}` : `Perdu`}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="text-center text-sm text-gray-400">Solde : <span className="text-casino-gold font-bold">{formatBalance(user?.balance ?? 0)}</span></div>
      </div>
    </div>
  );
}
