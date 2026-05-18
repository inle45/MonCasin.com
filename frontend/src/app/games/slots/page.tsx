'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import { formatBalance } from '@/lib/api';
import { SlotResult } from '@/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '🎰', '7️⃣', '💎'];

const WIN_MESSAGES: Record<string, string> = {
  jackpot: '🎊 JACKPOT ! Combinaison parfaite !',
  pair: '🎉 Paire ! Une belle combinaison !',
  cherry: '🍒 Les cerises portent chance !',
};

export default function SlotsPage() {
  const { user, updateUser, isLoading } = useAuth();
  const router = useRouter();

  const [reels, setReels] = useState(['🎰', '🎰', '🎰']);
  const [spinning, setSpinning] = useState(false);
  const [betAmount, setBetAmount] = useState('50');
  const [lastResult, setLastResult] = useState<SlotResult | null>(null);
  const [autoSpin, setAutoSpin] = useState(false);
  const [spinCount, setSpinCount] = useState(0);
  const autoRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    autoRef.current = autoSpin;
  }, [autoSpin]);

  const spin = async () => {
    if (spinning) return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Montant invalide'); return; }
    if (amount > (user?.balance || 0)) { toast.error('Solde insuffisant'); setAutoSpin(false); return; }

    setSpinning(true);
    setLastResult(null);

    // Animation des rouleaux
    let animTick = 0;
    const animInterval = setInterval(() => {
      setReels([
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      ]);
      animTick++;
      if (animTick > 12) clearInterval(animInterval);
    }, 80);

    try {
      const res = await api.post('/games/slots/spin', { amount });
      const result: SlotResult = res.data;

      // Attendre la fin de l'animation puis afficher le résultat
      setTimeout(() => {
        setReels(result.reels.map(r => r.emoji));
        setLastResult(result);
        updateUser({ balance: result.newBalance });
        setSpinCount(c => c + 1);

        if (result.won) {
          toast.success(WIN_MESSAGES[result.winType || ''] || '🎉 Gagné !');
        }
        setSpinning(false);

        // Auto-spin
        if (autoRef.current && result.newBalance >= amount) {
          setTimeout(() => { if (autoRef.current) spin(); }, 1000);
        } else if (autoRef.current) {
          setAutoSpin(false);
        }
      }, 1200);
    } catch (err: any) {
      clearInterval(animInterval);
      toast.error(err.response?.data?.error || 'Erreur lors du spin');
      setSpinning(false);
      setAutoSpin(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-casino-dark">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-8">
        <div className="casino-card p-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center justify-center gap-2">
            🎰 Machine à Sous
          </h1>
          <p className="text-gray-400 text-sm mb-6">TRJ : 86% • Conforme à la loi française</p>

          {/* Solde */}
          <div className="text-casino-gold text-3xl font-black mb-6">
            {formatBalance(user.balance)}
          </div>

          {/* Machine */}
          <div className={clsx(
            'bg-gradient-to-b from-yellow-900/30 to-casino-darker rounded-2xl border-2 p-6 mb-6',
            lastResult?.won ? 'border-casino-gold animate-pulse-gold' : 'border-casino-border',
          )}>
            {/* Rouleaux */}
            <div className="flex justify-center gap-4 mb-6">
              {reels.map((symbol, i) => (
                <div
                  key={i}
                  className={clsx(
                    'w-24 h-24 bg-casino-darker rounded-xl border-2 flex items-center justify-center text-5xl',
                    spinning ? 'border-casino-gold/50 animate-bounce' : 'border-casino-border',
                    lastResult?.won && !spinning ? 'border-casino-gold shadow-[0_0_20px_rgba(245,158,11,0.5)]' : '',
                  )}
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  {symbol}
                </div>
              ))}
            </div>

            {/* Résultat */}
            <div className="min-h-[40px] flex items-center justify-center">
              {lastResult && !spinning && (
                <div className={clsx(
                  'text-lg font-bold animate-fade-in',
                  lastResult.won ? 'text-casino-gold' : 'text-red-400'
                )}>
                  {lastResult.won
                    ? `+${formatBalance(lastResult.winAmount)} (${lastResult.multiplier}x)`
                    : `−${formatBalance(parseFloat(betAmount))}`}
                </div>
              )}
              {spinning && <div className="text-gray-400 animate-pulse">Rotation en cours...</div>}
            </div>
          </div>

          {/* Contrôles */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Mise par spin (F€)</label>
              <div className="flex gap-2 justify-center">
                {[10, 50, 100, 500, 1000].map(v => (
                  <button
                    key={v}
                    onClick={() => setBetAmount(v.toString())}
                    disabled={spinning}
                    className={clsx(
                      'px-3 py-2 rounded-lg text-sm font-bold border transition-colors',
                      betAmount === v.toString()
                        ? 'border-casino-gold bg-casino-gold/20 text-casino-gold'
                        : 'border-casino-border text-gray-400 hover:border-casino-gold',
                      spinning && 'opacity-50'
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={betAmount}
                onChange={e => setBetAmount(e.target.value)}
                disabled={spinning}
                className="w-full mt-2 bg-casino-darker border border-casino-border rounded-lg px-4 py-2 text-white text-center focus:outline-none focus:border-casino-gold"
                min="1"
              />
            </div>

            <button
              onClick={spin}
              disabled={spinning || autoSpin}
              className={clsx(
                'w-full py-4 rounded-xl font-black text-xl transition-all',
                spinning || autoSpin
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-casino-gold hover:bg-casino-gold-light text-black hover:scale-105 shadow-[0_0_20px_rgba(245,158,11,0.4)]'
              )}
            >
              {spinning ? '🎰 Rotation...' : '🎰 TOURNER !'}
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => { setAutoSpin(!autoSpin); if (!autoSpin && !spinning) spin(); }}
                className={clsx(
                  'flex-1 py-2 rounded-lg font-bold text-sm border transition-colors',
                  autoSpin
                    ? 'border-red-500 bg-red-500/20 text-red-400'
                    : 'border-casino-border text-gray-400 hover:border-casino-gold'
                )}
              >
                {autoSpin ? '⏹ Arrêter l\'auto' : '▶ Auto-spin'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="bg-casino-darker rounded-lg p-3">
              <div className="text-gray-400">Spins joués</div>
              <div className="text-white font-bold">{spinCount}</div>
            </div>
            <div className="bg-casino-darker rounded-lg p-3">
              <div className="text-gray-400">TRJ</div>
              <div className="text-white font-bold">86%</div>
            </div>
          </div>

          {/* Tableau des gains */}
          <div className="mt-6 text-left">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Tableau des gains</h3>
            <div className="bg-casino-darker rounded-lg p-3 space-y-1 text-xs">
              <div className="flex justify-between"><span>💎 💎 💎</span><span className="text-casino-gold">100x</span></div>
              <div className="flex justify-between"><span>7️⃣ 7️⃣ 7️⃣</span><span className="text-casino-gold">50x</span></div>
              <div className="flex justify-between"><span>🎰 🎰 🎰</span><span className="text-casino-gold">25x</span></div>
              <div className="flex justify-between"><span>🔔 🔔 🔔</span><span className="text-casino-gold">15x</span></div>
              <div className="flex justify-between"><span>🍇 🍇 🍇</span><span className="text-casino-gold">8x</span></div>
              <div className="flex justify-between"><span>🍊 🍊 🍊</span><span className="text-casino-gold">5x</span></div>
              <div className="flex justify-between"><span>Paire (hors 🍒)</span><span className="text-green-400">~30% sym</span></div>
              <div className="flex justify-between"><span>🍒 (1-3x)</span><span className="text-green-400">0.5x - 2x</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
