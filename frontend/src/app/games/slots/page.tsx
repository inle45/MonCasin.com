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

// ── Confettis dorés ────────────────────────────────────────
const CONFETTI_COLORS = ['#f59e0b', '#fbbf24', '#fcd34d', '#fed7aa', '#fef08a', '#f97316', '#facc15'];

function Confetti({ active }: { active: boolean }) {
  const pieces = useRef(
    Array.from({ length: 55 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.65,
      duration: 0.85 + Math.random() * 0.75,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 5 + Math.random() * 6,
      shape: i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '0%',
    }))
  ).current;

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-10">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            top: '-8px',
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            borderRadius: p.shape,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function SlotsPage() {
  const { user, updateUser, isLoading } = useAuth();
  const router = useRouter();

  // displayReels = les symboles actuellement affichés
  const [displayReels, setDisplayReels] = useState(['🎰', '🎰', '🎰']);
  // stoppedReels[i] = true quand le rouleau i a fini de tourner
  const [stoppedReels, setStoppedReels] = useState([true, true, true]);
  const [spinning, setSpinning] = useState(false);
  const [betAmount, setBetAmount] = useState('50');
  const [lastResult, setLastResult] = useState<SlotResult | null>(null);
  const [autoSpin, setAutoSpin] = useState(false);
  const [spinCount, setSpinCount] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const autoRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => { autoRef.current = autoSpin; }, [autoSpin]);

  const spin = async () => {
    if (spinning) return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Montant invalide'); return; }
    if (amount > (user?.balance || 0)) { toast.error('Solde insuffisant'); setAutoSpin(false); return; }

    setSpinning(true);
    setStoppedReels([false, false, false]);
    setLastResult(null);
    setShowConfetti(false);

    // Ref mutable pour tracker les rouleaux arrêtés sans closure stale
    const stoppedRef = [false, false, false];

    const animInterval = setInterval(() => {
      setDisplayReels(prev => [
        stoppedRef[0] ? prev[0] : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        stoppedRef[1] ? prev[1] : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        stoppedRef[2] ? prev[2] : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      ]);
    }, 75);

    try {
      const res = await api.post('/games/slots/spin', { amount });
      const result: SlotResult = res.data;

      // ── Arrêt rouleau par rouleau (gauche → droite) ──────
      // Rouleau 0
      setTimeout(() => {
        stoppedRef[0] = true;
        setStoppedReels([true, false, false]);
        setDisplayReels(prev => [result.reels[0].emoji, prev[1], prev[2]]);
      }, 220);

      // Rouleau 1
      setTimeout(() => {
        stoppedRef[1] = true;
        setStoppedReels([true, true, false]);
        setDisplayReels(prev => [prev[0], result.reels[1].emoji, prev[2]]);
      }, 520);

      // Rouleau 2 + finalisation
      setTimeout(() => {
        stoppedRef[2] = true;
        clearInterval(animInterval);
        setStoppedReels([true, true, true]);
        setDisplayReels([
          result.reels[0].emoji,
          result.reels[1].emoji,
          result.reels[2].emoji,
        ]);
        setLastResult(result);
        updateUser({ balance: result.newBalance });
        setSpinCount(c => c + 1);

        if (result.won) {
          toast.success(WIN_MESSAGES[result.winType || ''] || '🎉 Gagné !');
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 2600);
        }
        setSpinning(false);

        if (autoRef.current && result.newBalance >= amount) {
          setTimeout(() => { if (autoRef.current) spin(); }, 800);
        } else if (autoRef.current) {
          setAutoSpin(false);
        }
      }, 870);

    } catch (err: unknown) {
      clearInterval(animInterval);
      setStoppedReels([true, true, true]);
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error.response?.data?.error || 'Erreur lors du spin');
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
          <div className="text-casino-gold text-3xl font-black mb-6"
            style={{ textShadow: '0 0 20px rgba(245,158,11,0.5)' }}>
            {formatBalance(user.balance)}
          </div>

          {/* ── Machine ───────────────────────────────────────── */}
          <div className={clsx(
            'relative rounded-2xl border-2 p-6 mb-6 overflow-hidden transition-all duration-300',
            'bg-gradient-to-b from-yellow-900/30 to-casino-darker',
            lastResult?.won && !spinning
              ? 'border-casino-gold shadow-glow-gold animate-[win-pulse_0.6s_ease-in-out_3]'
              : 'border-casino-border',
          )}>
            <Confetti active={showConfetti} />

            {/* Rouleaux */}
            <div className="flex justify-center gap-4 mb-6">
              {displayReels.map((symbol, i) => {
                const isSpinning = spinning && !stoppedReels[i];
                const justStopped = stoppedReels[i] && spinning;

                return (
                  <div
                    key={i}
                    className={clsx(
                      'w-24 h-24 bg-casino-darker rounded-xl border-2 flex items-center justify-center text-5xl select-none overflow-hidden',
                      isSpinning
                        ? 'border-casino-gold/40'
                        : 'border-casino-border',
                      // Glow doré sur les rouleaux d'une combinaison gagnante
                      stoppedReels[i] && !spinning && lastResult?.won
                        ? 'border-casino-gold shadow-[0_0_22px_rgba(245,158,11,0.6)]'
                        : '',
                      // Rebond élastique à l'arrêt
                      justStopped ? 'animate-bounce-in' : '',
                    )}
                    style={{
                      // Motion blur vertical pendant le spin
                      filter: isSpinning ? 'blur(5px) brightness(1.45) saturate(1.3)' : 'none',
                      transition: isSpinning
                        ? 'none'
                        : 'filter 0.18s ease-out, box-shadow 0.3s ease',
                      animationDelay: `${i * 0.04}s`,
                    }}
                  >
                    {symbol}
                  </div>
                );
              })}
            </div>

            {/* Résultat */}
            <div className="min-h-[40px] flex items-center justify-center">
              {lastResult && !spinning && (
                <div className={clsx(
                  'text-lg font-bold animate-fade-in',
                  lastResult.won ? 'text-casino-gold' : 'text-red-400'
                )}
                  style={lastResult.won ? { textShadow: '0 0 15px rgba(245,158,11,0.7)' } : {}}
                >
                  {lastResult.won
                    ? `+${formatBalance(lastResult.winAmount)} (${lastResult.multiplier}x)`
                    : `−${formatBalance(parseFloat(betAmount))}`}
                </div>
              )}
              {spinning && (
                <div className="text-gray-500 text-xs animate-pulse tracking-widest uppercase">
                  En rotation...
                </div>
              )}
            </div>
          </div>

          {/* ── Contrôles ─────────────────────────────────────── */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Mise par spin (F€)</label>
              <div className="flex gap-2 justify-center flex-wrap">
                {[10, 50, 100, 500, 1000].map(v => (
                  <button
                    key={v}
                    onClick={() => setBetAmount(v.toString())}
                    disabled={spinning}
                    className={clsx(
                      'px-3 py-2 rounded-lg text-sm font-bold border transition-all',
                      betAmount === v.toString()
                        ? 'border-casino-gold bg-casino-gold/20 text-casino-gold shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                        : 'border-casino-border text-gray-400 hover:border-casino-gold hover:text-white hover:bg-white/5',
                      spinning && 'opacity-50 cursor-not-allowed',
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
                className="w-full mt-2 bg-casino-darker border border-casino-border rounded-lg px-4 py-2 text-white text-center focus:outline-none focus:border-casino-gold focus:shadow-[0_0_12px_rgba(245,158,11,0.3)] transition-shadow"
                min="1"
              />
            </div>

            <button
              onClick={spin}
              disabled={spinning || autoSpin}
              className={clsx(
                'w-full py-4 rounded-xl font-black text-xl transition-all duration-150',
                spinning || autoSpin
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-casino-gold text-black btn-gold-glow active:scale-95',
              )}
            >
              {spinning ? '🎰 Rotation en cours...' : '🎰 TOURNER !'}
            </button>

            <button
              onClick={() => { setAutoSpin(!autoSpin); if (!autoSpin && !spinning) spin(); }}
              className={clsx(
                'w-full py-2 rounded-lg font-bold text-sm border transition-all',
                autoSpin
                  ? 'border-red-500 bg-red-500/15 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.35)]'
                  : 'border-casino-border text-gray-400 hover:border-casino-gold hover:text-white hover:bg-white/5',
              )}
            >
              {autoSpin ? '⏹ Arrêter l\'auto-spin' : '▶ Auto-spin'}
            </button>
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
            <div className="bg-casino-darker rounded-lg p-3 space-y-1.5 text-xs">
              {[
                ['💎 💎 💎', '100x'],
                ['7️⃣ 7️⃣ 7️⃣', '50x'],
                ['🎰 🎰 🎰', '25x'],
                ['🔔 🔔 🔔', '15x'],
                ['🍇 🍇 🍇', '8x'],
                ['🍊 🍊 🍊', '5x'],
              ].map(([combo, mult]) => (
                <div key={combo} className="flex justify-between items-center">
                  <span className="tracking-wider">{combo}</span>
                  <span className="text-casino-gold font-bold">{mult}</span>
                </div>
              ))}
              <div className="border-t border-casino-border pt-1.5 mt-1">
                <div className="flex justify-between"><span>Paire (hors 🍒)</span><span className="text-green-400">~30% sym</span></div>
                <div className="flex justify-between"><span>🍒 (1–3 cerises)</span><span className="text-green-400">0.5x – 2x</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
