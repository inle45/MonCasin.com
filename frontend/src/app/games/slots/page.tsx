'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import BigWinOverlay from '@/components/games/BigWinOverlay';
import WheelOfFortune from '@/components/games/WheelOfFortune';
import ChestGame from '@/components/games/ChestGame';

// ── Symboles ──────────────────────────────────────────────────────────────────
const SYMBOLES: Record<string, { emoji: string; couleur: string }> = {
  TEN:     { emoji: '🔟', couleur: '#6b7280' },
  JACK:    { emoji: '🎴', couleur: '#6b7280' },
  QUEEN:   { emoji: '♛',  couleur: '#8b5cf6' },
  KING:    { emoji: '♚',  couleur: '#3b82f6' },
  ACE:     { emoji: '🅰️', couleur: '#f97316' },
  CROWN:   { emoji: '👑', couleur: '#f59e0b' },
  DIAMOND: { emoji: '💎', couleur: '#06b6d4' },
  WILD:    { emoji: '🌟', couleur: '#fbbf24' },
  SCATTER: { emoji: '⭐', couleur: '#fbbf24' },
};

const MISES_PRESETS = [1, 5, 10, 25, 50, 100, 250, 500];

const LIGNES_DE_PAIEMENT = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,0,1,0],
  [2,1,2,1,2],[1,0,1,0,1],[1,2,1,2,1],[0,0,0,1,2],[2,2,2,1,0],
  [0,1,1,1,2],[2,1,1,1,0],[1,1,0,1,1],[1,1,2,1,1],[0,2,1,0,2],
];

function grilleVide(): string[][] {
  return Array.from({ length: 5 }, () => ['TEN', 'TEN', 'TEN']);
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface LigneGagnante {
  indexLigne: number;
  symbole: string;
  count: number;
  multiplicateur: number;
}

interface SpinResult {
  grille: string[][];
  gainTotal: number;
  lignesGagnantes: LigneGagnante[];
  multiplicateurTotal: number;
  scatters: number;
  bonus: { type: 'FREE_SPINS' | 'WHEEL_OF_FORTUNE' | 'CHEST_GAME'; freespins?: number } | null;
  jackpotWin: boolean;
  gagne: boolean;
  bigWin: boolean;
  estFreeSpin: boolean;
  spinsRestants?: number;
  multiplicateurFreeSpin?: number;
  gainTotalFreeSpins?: number;
  freeSpinsTermines?: boolean;
  newBalance: number;
  jackpot: number;
}

interface WheelResult {
  multiplicateur: number;
  gain: number;
  newBalance: number;
}

interface ChestResult {
  estAlarme: boolean;
  valeur: number;
  indexCoffre: number;
  gainTotal: number;
  termine: boolean;
  coffres: Array<{ estAlarme: boolean; valeur: number; revele: boolean }>;
  newBalance: number;
}

// ── Cellule de rouleau ────────────────────────────────────────────────────────
function CelluleRouleau({
  sym,
  isGagnant,
  isScatterTease,
}: {
  sym: string;
  isGagnant: boolean;
  isScatterTease: boolean;
}) {
  const def = SYMBOLES[sym] ?? { emoji: sym, couleur: '#6b7280' };
  return (
    <motion.div
      animate={isGagnant ? { scale: [1, 1.12, 1] } : {}}
      transition={isGagnant ? { duration: 0.65, repeat: Infinity } : {}}
      className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center text-2xl sm:text-3xl relative overflow-hidden"
      style={{
        background: isGagnant
          ? `radial-gradient(ellipse at center, ${def.couleur}44 0%, #1e1b4b 70%)`
          : 'rgba(30,27,75,0.7)',
        border: isGagnant
          ? `2px solid ${def.couleur}`
          : isScatterTease
          ? '2px solid #fbbf24'
          : '1px solid rgba(245,158,11,0.18)',
        boxShadow: isGagnant
          ? `0 0 18px ${def.couleur}99`
          : isScatterTease
          ? '0 0 14px rgba(251,191,36,0.7)'
          : 'none',
      }}
    >
      {def.emoji}
      {isGagnant && (
        <motion.div
          className="absolute inset-0 rounded-lg"
          animate={{ opacity: [0, 0.35, 0] }}
          transition={{ duration: 0.65, repeat: Infinity }}
          style={{ background: def.couleur, mixBlendMode: 'overlay' }}
        />
      )}
    </motion.div>
  );
}

// ── Rouleau ───────────────────────────────────────────────────────────────────
function Rouleau({
  col,
  reelIdx,
  spinning,
  stopped,
  teasing,
  lignesGagnantes,
}: {
  col: string[];
  reelIdx: number;
  spinning: boolean;
  stopped: boolean;
  teasing: boolean;
  lignesGagnantes: LigneGagnante[];
}) {
  const cellsGagnantes = new Set<number>();
  lignesGagnantes.forEach(({ indexLigne }) => {
    const ligne = LIGNES_DE_PAIEMENT[indexLigne];
    if (ligne !== undefined) cellsGagnantes.add(ligne[reelIdx]);
  });

  const isSpinning = spinning && !stopped;
  const isTease = teasing && !stopped;

  return (
    <motion.div
      animate={isSpinning ? { y: [0, -10, 0] } : {}}
      transition={isSpinning ? { duration: 0.11, repeat: Infinity, ease: 'linear' } : {}}
      className="flex flex-col gap-1.5"
      style={{
        filter: isSpinning
          ? 'blur(4px) brightness(1.4)'
          : isTease
          ? 'blur(1.5px) brightness(1.15) saturate(1.4)'
          : 'none',
        transition: isTease ? 'filter 0.3s' : undefined,
      }}
    >
      {col.map((sym, rowIdx) => (
        <CelluleRouleau
          key={rowIdx}
          sym={sym}
          isGagnant={!spinning && cellsGagnantes.has(rowIdx)}
          isScatterTease={isTease && sym === 'SCATTER'}
        />
      ))}
    </motion.div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
// Niveau de gain selon multiplicateur total
function getWinTier(mult: number): { label: string; couleur: string } | null {
  if (mult <= 0) return null;
  if (mult < 5)  return { label: 'MINI WIN',  couleur: '#6b7280' };
  if (mult < 10) return { label: 'MINOR WIN', couleur: '#3b82f6' };
  if (mult < 20) return { label: 'MAJOR WIN', couleur: '#8b5cf6' };
  return               { label: 'GRAND WIN', couleur: '#f59e0b' };
}

export default function SlotsPage() {
  const { user, updateUser } = useAuth();
  const { socket } = useSocket();

  const [grille, setGrille] = useState<string[][]>(grilleVide());
  const [mise, setMise] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [stoppedReels, setStoppedReels] = useState([true, true, true, true, true]);
  const [lignesGagnantes, setLignesGagnantes] = useState<LigneGagnante[]>([]);
  const [jackpot, setJackpot] = useState(50000);
  const [teasing, setTeasing] = useState(false);
  const [lastGain, setLastGain] = useState<number | null>(null);
  const [lastMult, setLastMult] = useState(0);

  // Free spins
  const [enModeFreeSpin, setEnModeFreeSpin] = useState(false);
  const [freeSpinsRestants, setFreeSpinsRestants] = useState(0);
  const [freeSpinMultiplicateur, setFreeSpinMultiplicateur] = useState(1);
  const [freeSpinsGainTotal, setFreeSpinsGainTotal] = useState(0);

  // Big Win overlay
  const [bigWinVisible, setBigWinVisible] = useState(false);
  const [bigWinMontant, setBigWinMontant] = useState(0);
  const [bigWinMultiplicateur, setBigWinMultiplicateur] = useState(0);

  // Roue bonus
  const [showWheel, setShowWheel] = useState(false);
  const [wheelResult, setWheelResult] = useState<WheelResult | null>(null);
  const [wheelMise, setWheelMise] = useState(0);

  // Coffres bonus
  const [showChest, setShowChest] = useState(false);
  const [chestData, setChestData] = useState<{
    coffres: ChestResult['coffres'];
    gainTotal: number;
    mise: number;
    termine: boolean;
  } | null>(null);

  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!socket) return;
    const handler = ({ jackpot: j }: { jackpot: number }) => setJackpot(j);
    socket.on('slots:jackpot', handler);
    return () => { socket.off('slots:jackpot', handler); };
  }, [socket]);

  useEffect(() => {
    api.get('/games/slots/jackpot')
      .then(res => setJackpot(res.data.jackpot))
      .catch(() => {});
  }, []);

  const clearTimers = () => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  };

  const handleSpin = useCallback(async () => {
    if (spinning || !user) return;
    if (!enModeFreeSpin && (user.balance ?? 0) < mise) return;

    setSpinning(true);
    setStoppedReels([false, false, false, false, false]);
    setLignesGagnantes([]);
    setTeasing(false);
    setLastGain(null);
    setLastMult(0);
    clearTimers();

    try {
      const res = await api.post('/games/slots/spin', { amount: mise });
      const data: SpinResult = res.data;

      updateUser({ balance: data.newBalance });
      setJackpot(data.jackpot);

      // Détecter scatters pour tease
      let scatterCount = 0;
      for (let r = 0; r < 5; r++)
        for (let row = 0; row < 3; row++)
          if (data.grille[r][row] === 'SCATTER') scatterCount++;

      const DELAYS = [350, 750, 1200, 1700, 2250];
      DELAYS.forEach((delay, reelIdx) => {
        const t = setTimeout(() => {
          setGrille(prev =>
            prev.map((col, i) => i === reelIdx ? data.grille[reelIdx] : col)
          );
          setStoppedReels(prev => {
            const next = [...prev];
            next[reelIdx] = true;
            return next;
          });

          if (reelIdx === 1 && scatterCount >= 2) setTeasing(true);

          if (reelIdx === 4) {
            setSpinning(false);
            setTeasing(false);
            setLignesGagnantes(data.lignesGagnantes);
            setLastGain(data.gainTotal > 0 ? data.gainTotal : null);
            setLastMult(data.multiplicateurTotal);

            if (data.estFreeSpin) {
              setFreeSpinsRestants(data.spinsRestants ?? 0);
              setFreeSpinMultiplicateur(data.multiplicateurFreeSpin ?? 1);
              setFreeSpinsGainTotal(data.gainTotalFreeSpins ?? 0);
              if (data.freeSpinsTermines) setEnModeFreeSpin(false);
            }

            if (data.jackpotWin) {
              setBigWinMontant(data.gainTotal);
              setBigWinMultiplicateur(9999);
              setBigWinVisible(true);
              return;
            }

            if (data.bigWin && !data.bonus) {
              setBigWinMontant(data.gainTotal);
              setBigWinMultiplicateur(data.multiplicateurTotal);
              setBigWinVisible(true);
            }

            if (data.bonus) {
              if (data.bonus.type === 'FREE_SPINS') {
                setEnModeFreeSpin(true);
                setFreeSpinsRestants(data.bonus.freespins ?? 10);
                setFreeSpinMultiplicateur(1);
                setFreeSpinsGainTotal(0);
              } else if (data.bonus.type === 'WHEEL_OF_FORTUNE') {
                setWheelMise(mise);
                setWheelResult(null);
                setShowWheel(true);
                setTimeout(() => {
                  api.post('/games/slots/bonus/wheel', { amount: mise })
                    .then(r => {
                      const wr: WheelResult = r.data;
                      setWheelResult(wr);
                      updateUser({ balance: wr.newBalance });
                    }).catch(() => {});
                }, 800);
              } else if (data.bonus.type === 'CHEST_GAME') {
                setChestData({
                  coffres: Array.from({ length: 12 }, () => ({ estAlarme: false, valeur: 0, revele: false })),
                  gainTotal: 0,
                  mise,
                  termine: false,
                });
                setShowChest(true);
              }
            }
          }
        }, delay);
        timerRefs.current.push(t);
      });
    } catch {
      setSpinning(false);
      setStoppedReels([true, true, true, true, true]);
    }
  }, [spinning, user, enModeFreeSpin, mise, updateUser]);

  const handleOpenChest = useCallback(async (indexCoffre: number) => {
    try {
      const res = await api.post('/games/slots/bonus/chest', { indexCoffre });
      const data: ChestResult = res.data;
      updateUser({ balance: data.newBalance });
      setChestData({
        coffres: data.coffres,
        gainTotal: data.gainTotal,
        mise,
        termine: data.termine,
      });
    } catch {}
  }, [mise, updateUser]);

  const allStopped = stoppedReels.every(Boolean);

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-lg mx-auto px-3 pt-20 pb-8 flex flex-col gap-4">

        {/* Titre + Jackpot */}
        <div className="text-center">
          <h1 className="text-2xl font-black text-casino-gold tracking-wide">🎰 Vegas Evolution</h1>
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="mt-1 text-xs font-bold"
            style={{ color: '#fbbf24', textShadow: '0 0 14px rgba(245,158,11,0.9)' }}
          >
            JACKPOT PROGRESSIF : {jackpot.toLocaleString('fr-FR')} F€ 🏆
          </motion.div>
        </div>

        {/* Bandeau Free Spins */}
        <AnimatePresence>
          {enModeFreeSpin && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="rounded-xl p-3 text-center"
              style={{ background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)', border: '2px solid #60a5fa' }}
            >
              <div className="text-blue-200 text-xs uppercase tracking-widest font-bold">Free Spins</div>
              <div className="text-3xl font-black text-white">{freeSpinsRestants} restants</div>
              <div className="flex justify-center gap-6 mt-1 text-sm">
                <span className="text-yellow-300 font-bold">×{freeSpinMultiplicateur.toFixed(1)}</span>
                <span className="text-green-400 font-bold">+{freeSpinsGainTotal.toLocaleString('fr-FR')} F€</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grille 5×3 */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg, #1a1630 0%, #0a0a1a 100%)',
            border: '2px solid rgba(245,158,11,0.35)',
            boxShadow: '0 0 40px rgba(245,158,11,0.08), inset 0 0 30px rgba(0,0,0,0.5)',
          }}
        >
          <div className="flex justify-center gap-2">
            {grille.map((col, reelIdx) => (
              <Rouleau
                key={reelIdx}
                col={col}
                reelIdx={reelIdx}
                spinning={spinning}
                stopped={stoppedReels[reelIdx]}
                teasing={teasing}
                lignesGagnantes={allStopped ? lignesGagnantes : []}
              />
            ))}
          </div>

          {/* Résultat — niveau de gain + montant */}
          <div className="min-h-14 mt-3 flex flex-col items-center justify-center gap-1">
            <AnimatePresence mode="wait">
              {allStopped && lastGain !== null && lastGain > 0 && (() => {
                const tier = getWinTier(lastMult);
                return (
                  <motion.div
                    key={`gain-${lastGain}`}
                    initial={{ opacity: 0, scale: 0.7, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 280 }}
                    className="flex flex-col items-center gap-0.5"
                  >
                    {tier && (
                      <div
                        className="text-xs font-black tracking-widest px-3 py-0.5 rounded-full"
                        style={{
                          background: `${tier.couleur}22`,
                          color: tier.couleur,
                          border: `1px solid ${tier.couleur}`,
                          textShadow: `0 0 8px ${tier.couleur}`,
                        }}
                      >
                        {tier.label}
                      </div>
                    )}
                    <motion.div
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ duration: 0.8, repeat: 3 }}
                      className="text-2xl font-black text-green-400"
                      style={{ textShadow: '0 0 12px rgba(74,222,128,0.7)' }}
                    >
                      +{formatBalance(lastGain)}
                    </motion.div>
                    <div className="text-xs text-gray-500">
                      ×{lastMult.toFixed(1)} — {lignesGagnantes.length} ligne{lignesGagnantes.length > 1 ? 's' : ''}
                    </div>
                  </motion.div>
                );
              })()}
              {allStopped && (lastGain === null || lastGain === 0) && !spinning && (
                <motion.div
                  key="noop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-gray-600 text-xs"
                >
                  Bonne chance au prochain spin !
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sélecteur de mise (masqué en free spin) */}
        {!enModeFreeSpin && (
          <div className="grid grid-cols-4 gap-2">
            {MISES_PRESETS.map(m => (
              <button
                key={m}
                onClick={() => !spinning && setMise(m)}
                disabled={spinning}
                className="py-2 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: mise === m
                    ? 'linear-gradient(135deg, #d97706, #f59e0b)'
                    : 'rgba(30,27,75,0.7)',
                  color: mise === m ? '#000' : '#9ca3af',
                  border: mise === m ? '2px solid #fbbf24' : '1px solid rgba(245,158,11,0.15)',
                  boxShadow: mise === m ? '0 0 14px rgba(245,158,11,0.45)' : 'none',
                }}
              >
                {m} F€
              </button>
            ))}
          </div>
        )}

        {/* Bouton SPIN */}
        <motion.button
          whileTap={!spinning ? { scale: 0.96 } : {}}
          onClick={handleSpin}
          disabled={spinning || (!enModeFreeSpin && (user?.balance ?? 0) < mise)}
          className="w-full py-4 rounded-2xl text-xl font-black transition-all"
          style={{
            background: spinning
              ? 'rgba(20,20,40,0.8)'
              : enModeFreeSpin
              ? 'linear-gradient(135deg, #1d4ed8, #7c3aed)'
              : 'linear-gradient(135deg, #b45309, #f59e0b, #b45309)',
            color: spinning ? '#4b5563' : '#000',
            boxShadow: spinning ? 'none' : enModeFreeSpin ? '0 0 24px rgba(99,102,241,0.6)' : '0 0 28px rgba(245,158,11,0.55)',
            cursor: spinning ? 'not-allowed' : 'pointer',
          }}
        >
          {spinning ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}>⚙️</motion.span>
              Rotation en cours...
            </span>
          ) : enModeFreeSpin ? (
            `🎁 SPIN GRATUIT — ${freeSpinsRestants} restants`
          ) : (
            `▶ SPIN — ${formatBalance(mise)}`
          )}
        </motion.button>

        {/* Solde */}
        <div className="text-center text-sm text-gray-400">
          Solde : <span className="text-casino-gold font-bold">{formatBalance(user?.balance ?? 0)}</span>
        </div>

        {/* Paytable */}
        <details className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(245,158,11,0.18)' }}>
          <summary className="px-4 py-2.5 cursor-pointer text-sm text-gray-400 bg-casino-darker hover:text-casino-gold transition-colors select-none">
            📋 Tableau des gains — 20 lignes de paiement
          </summary>
          <div className="px-4 py-3 bg-casino-darker grid grid-cols-2 gap-2 text-xs text-gray-300">
            {[
              { sym: 'WILD',    label: '🌟 Wild',    pays: '×15 / ×50 / ×200' },
              { sym: 'DIAMOND', label: '💎 Diamond', pays: '×8 / ×30 / ×90'   },
              { sym: 'CROWN',   label: '👑 Crown',   pays: '×3 / ×12 / ×35'   },
              { sym: 'ACE',     label: '🅰️ As',      pays: '×1.2 / ×4 / ×12'  },
              { sym: 'KING',    label: '♚ Roi',      pays: '×0.9 / ×2.5 / ×7' },
              { sym: 'QUEEN',   label: '♛ Dame',     pays: '×0.7 / ×2 / ×5'   },
              { sym: 'JACK',    label: '🎴 Valet',   pays: '×0.5 / ×1.5 / ×3' },
              { sym: 'TEN',     label: '🔟 10',      pays: '×0.4 / ×1.2 / ×2.5' },
            ].map(({ label, pays }) => (
              <div key={label} className="flex flex-col">
                <span className="text-white font-semibold">{label}</span>
                <span className="text-gray-500">{pays}</span>
              </div>
            ))}
            <div className="col-span-2 pt-2 border-t border-gray-700 space-y-1">
              <div className="text-yellow-400">⭐ 3+ Scatters = Bonus (Free Spins / Roue / Coffres)</div>
              <div className="text-yellow-300">🌟×5 ligne centrale = JACKPOT PROGRESSIF</div>
              <div className="text-gray-600">WILD substitue tous les symboles sauf Scatter</div>
            </div>
          </div>
        </details>
      </div>

      {/* Overlays */}
      <BigWinOverlay
        visible={bigWinVisible}
        montant={bigWinMontant}
        multiplicateur={bigWinMultiplicateur}
        onClose={() => setBigWinVisible(false)}
      />

      {showWheel && (
        <WheelOfFortune
          mise={wheelMise}
          multiplicateur={wheelResult?.multiplicateur ?? null}
          gain={wheelResult?.gain ?? 0}
          onClose={() => { setShowWheel(false); setWheelResult(null); }}
        />
      )}

      {showChest && chestData && (
        <ChestGame
          coffres={chestData.coffres}
          gainTotal={chestData.gainTotal}
          mise={chestData.mise}
          termine={chestData.termine}
          onPick={handleOpenChest}
          onClose={() => { setShowChest(false); setChestData(null); }}
        />
      )}
    </div>
  );
}
