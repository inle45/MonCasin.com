'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Navbar from '@/components/layout/Navbar';
import ChatPanel from '@/components/chat/ChatPanel';
import { formatBalance } from '@/lib/api';
import { RouletteBetItem } from '@/types';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const NUMBERS_LAYOUT = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

function getNumberColor(n: number) {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
}

// Couleurs fixes par pseudo (palette casino)
const PLAYER_COLORS: Record<string, string> = {
  'Inlé':     '#f59e0b',
  'Louis':    '#ef4444',
  'Amaury':   '#8b5cf6',
  'Noah':     '#3b82f6',
  'Matthieu': '#10b981',
};
const DEFAULT_COLOR = '#06b6d4';

function getPlayerColor(pseudo: string) {
  return PLAYER_COLORS[pseudo] || DEFAULT_COLOR;
}

// Jetons miniatures empilés sur une case
interface ChipStack {
  userId: string;
  pseudo: string;
  amount: number;
  color: string;
}

// Roulette SVG simplifiée (indicateur visuel spinning)
function RouletteWheel({ spinning }: { spinning: boolean }) {
  return (
    <div className={clsx(
      'relative w-36 h-36 mx-auto',
      spinning && 'roulette-wheel-spinning',
    )}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
        <defs>
          <radialGradient id="wheelGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2d1f00" />
            <stop offset="100%" stopColor="#0a0a0f" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="49" fill="url(#wheelGrad)" stroke="#f59e0b" strokeWidth="1.5" />
        {[...Array(18)].map((_, i) => {
          const angle = (i * 360) / 18;
          const rad = (angle * Math.PI) / 180;
          return (
            <line
              key={i}
              x1="50" y1="50"
              x2={50 + 46 * Math.cos(rad)}
              y2={50 + 46 * Math.sin(rad)}
              stroke={i % 2 === 0 ? '#ef4444' : '#1a1a2e'}
              strokeWidth="2.8"
            />
          );
        })}
        <circle cx="50" cy="50" r="12" fill="#0a0a0f" stroke="#f59e0b" strokeWidth="2" />
        <circle cx="50" cy="50" r="4" fill="#f59e0b" />
      </svg>
    </div>
  );
}

export default function RoulettePage() {
  const { user, updateUser, isLoading } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();

  const [gameState, setGameState] = useState<'betting' | 'spinning' | 'result'>('betting');
  const [countdown, setCountdown] = useState(15);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [winColor, setWinColor] = useState<string | null>(null);
  const [history, setHistory] = useState<{ number: number; color: string }[]>([]);
  const [spinning, setSpinning] = useState(false);

  const [selectedBets, setSelectedBets] = useState<RouletteBetItem[]>([]);
  const [chipAmount, setChipAmount] = useState(50);
  const [betSent, setBetSent] = useState(false);
  const [lastResult, setLastResult] = useState<{ win: number; bet: number } | null>(null);

  // Jetons de tous les joueurs sur le tapis : key = "type-value"
  const [playerChips, setPlayerChips] = useState<Record<string, ChipStack[]>>({});

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  const getBetKey = (type: string, value: string | number) => `${type}-${value}`;

  const clearAllChips = useCallback(() => setPlayerChips({}), []);

  useEffect(() => {
    if (!socket) return;

    socket.on('init', (data) => {
      if (data.rouletteState) {
        setGameState(data.rouletteState.state);
        setCountdown(data.rouletteState.countdown);
        setHistory(data.rouletteState.history || []);
      }
    });

    socket.on('roulette:betting', (data) => {
      setGameState('betting');
      setCountdown(data.countdown);
      setHistory(data.history || []);
      setWinningNumber(null);
      setWinColor(null);
      setSelectedBets([]);
      setBetSent(false);
      setSpinning(false);
      setLastResult(null);
      clearAllChips();
    });

    socket.on('roulette:countdown', (data) => setCountdown(data.countdown));

    socket.on('roulette:spinning', () => {
      setGameState('spinning');
      setSpinning(true);
    });

    socket.on('roulette:result', (data) => {
      setGameState('result');
      setSpinning(false);
      setWinningNumber(data.winningNumber);
      setWinColor(data.winColor);
      setHistory(prev => [{ number: data.winningNumber, color: data.winColor }, ...prev.slice(0, 19)]);

      const myResult = data.results?.find((r: { userId: string; totalWin: number; totalBet: number }) => r.userId === user?.id);
      if (myResult) {
        setLastResult({ win: myResult.totalWin, bet: myResult.totalBet });
        updateUser({ balance: user!.balance - myResult.totalBet + myResult.totalWin });
        if (myResult.totalWin > 0) {
          toast.success(`🎉 Gagné ${formatBalance(myResult.totalWin)} !`);
        } else {
          toast.error(`Perdu ${formatBalance(myResult.totalBet)}`);
        }
      }
    });

    socket.on('roulette:bet_confirmed', (data) => {
      updateUser({ balance: data.newBalance });
      setBetSent(true);
      toast.success(`Mise de ${formatBalance(data.totalBet)} confirmée !`);
    });

    // Mise d'un autre joueur reçue — affichage des jetons
    socket.on('roulette:bet_placed', (data: { userId: string; pseudo: string; bets: RouletteBetItem[] }) => {
      const color = getPlayerColor(data.pseudo);
      setPlayerChips(prev => {
        const next = { ...prev };
        for (const bet of data.bets) {
          const key = getBetKey(bet.type, bet.value);
          const existing = next[key] || [];
          // Fusionner si même joueur, sinon ajouter
          const idx = existing.findIndex(c => c.userId === data.userId);
          if (idx >= 0) {
            const updated = [...existing];
            updated[idx] = { ...updated[idx], amount: updated[idx].amount + bet.amount };
            next[key] = updated;
          } else {
            next[key] = [...existing, { userId: data.userId, pseudo: data.pseudo, amount: bet.amount, color }];
          }
        }
        return next;
      });
    });

    socket.on('error', (data) => toast.error(data.message));

    return () => {
      socket.off('init');
      socket.off('roulette:betting');
      socket.off('roulette:countdown');
      socket.off('roulette:spinning');
      socket.off('roulette:result');
      socket.off('roulette:bet_confirmed');
      socket.off('roulette:bet_placed');
      socket.off('error');
    };
  }, [socket, user, updateUser, clearAllChips]);

  const addBet = (type: RouletteBetItem['type'], value: string | number) => {
    if (betSent || gameState !== 'betting') return;
    const totalBet = selectedBets.reduce((s, b) => s + b.amount, 0);
    if (totalBet + chipAmount > (user?.balance || 0)) { toast.error('Solde insuffisant'); return; }
    setSelectedBets(prev => {
      const existing = prev.find(b => b.type === type && b.value === value);
      if (existing) {
        return prev.map(b => b.type === type && b.value === value ? { ...b, amount: b.amount + chipAmount } : b);
      }
      return [...prev, { type, value, amount: chipAmount }];
    });
  };

  const clearBets = () => setSelectedBets([]);

  const placeBets = () => {
    if (!socket || betSent || selectedBets.length === 0) return;
    socket.emit('roulette:bet', { bets: selectedBets });
  };

  const totalBetAmount = selectedBets.reduce((s, b) => s + b.amount, 0);

  const getMyBetOnCell = (type: RouletteBetItem['type'], value: string | number) =>
    selectedBets.find(b => b.type === type && b.value === value)?.amount || 0;

  const getChipsOnCell = (type: string, value: string | number): ChipStack[] =>
    playerChips[getBetKey(type, value)] || [];

  // Rendu des jetons sur une case (max 3 affiché, avec badge "+N")
  const renderChips = (type: string, value: string | number, myBet: number) => {
    const chips = getChipsOnCell(type, value);
    const allChips = myBet > 0
      ? [{ userId: user!.id, pseudo: user!.pseudo, amount: myBet, color: '#ffffff' }, ...chips.filter(c => c.userId !== user!.id)]
      : chips;

    if (allChips.length === 0) return null;

    return (
      <div className="absolute bottom-0.5 right-0.5 flex flex-col-reverse items-end gap-px pointer-events-none">
        {allChips.slice(0, 4).map((chip, idx) => (
          <div
            key={`${chip.userId}-${idx}`}
            className="player-chip w-2.5 h-2.5 rounded-full border border-black/60 shadow-sm flex-shrink-0"
            style={{
              backgroundColor: chip.color,
              boxShadow: `0 0 4px ${chip.color}80`,
              animationDelay: `${idx * 0.05}s`,
            }}
            title={`${chip.pseudo}: ${chip.amount} F€`}
          />
        ))}
        {allChips.length > 4 && (
          <div className="text-[8px] text-white font-bold leading-none">
            +{allChips.length - 4}
          </div>
        )}
      </div>
    );
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-casino-dark">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 pt-20 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">

            {/* ── En-tête ──────────────────────────────────── */}
            <div className="casino-card p-4 flex items-center justify-between">
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                🎡 Roulette Européenne
                <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">LIVE</span>
              </h1>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className={clsx('text-2xl font-bold transition-colors',
                    gameState === 'betting' ? 'text-casino-gold' :
                    gameState === 'spinning' ? 'text-blue-400' : 'text-white'
                  )}
                    style={gameState === 'betting' ? { textShadow: '0 0 15px rgba(245,158,11,0.5)' } : {}}
                  >
                    {gameState === 'betting' ? `${countdown}s` :
                     gameState === 'spinning' ? '🎡' :
                     winningNumber !== null ? winningNumber : '-'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {gameState === 'betting' ? 'Mises ouvertes' :
                     gameState === 'spinning' ? 'La roulette tourne...' : 'Résultat'}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Roue visuelle ─────────────────────────────── */}
            <div className="casino-card p-6 text-center">
              {gameState === 'result' && winningNumber !== null ? (
                <div className="space-y-4 animate-fade-in">
                  <div className={clsx(
                    'text-8xl font-black inline-flex items-center justify-center w-36 h-36 rounded-full border-4',
                    winColor === 'red'   ? 'text-white bg-red-600 border-red-400 shadow-[0_0_30px_rgba(239,68,68,0.6)]' :
                    winColor === 'black' ? 'text-white bg-gray-900 border-gray-600 shadow-[0_0_20px_rgba(0,0,0,0.8)]' :
                    'text-white bg-green-600 border-green-400 shadow-[0_0_30px_rgba(16,185,129,0.6)]'
                  )}>
                    {winningNumber}
                  </div>
                  {lastResult && (
                    <div className={clsx('text-xl font-bold',
                      lastResult.win > 0 ? 'text-green-400' : 'text-red-400'
                    )}
                      style={lastResult.win > 0 ? { textShadow: '0 0 15px rgba(16,185,129,0.6)' } : {}}
                    >
                      {lastResult.win > 0
                        ? `🎉 +${formatBalance(lastResult.win)}`
                        : `💸 -${formatBalance(lastResult.bet)}`}
                    </div>
                  )}
                </div>
              ) : (
                <RouletteWheel spinning={gameState === 'spinning'} />
              )}

              {/* Historique */}
              <div className="flex gap-2 mt-5 justify-center flex-wrap">
                {history.slice(0, 12).map((h, i) => (
                  <span key={i} className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all hover:scale-110',
                    h.color === 'red'   ? 'bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                    h.color === 'black' ? 'bg-gray-800 border border-gray-600' :
                    'bg-green-600 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  )}>
                    {h.number}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Tapis de mise ─────────────────────────────── */}
            <div className="casino-card p-4">
              {/* Chip selector */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-sm text-gray-400">Mise / clic :</span>
                {[10, 50, 100, 500, 1000].map(v => (
                  <button
                    key={v}
                    onClick={() => setChipAmount(v)}
                    className={clsx(
                      'px-3 py-1 rounded-full text-sm font-bold border transition-all',
                      chipAmount === v
                        ? 'border-casino-gold bg-casino-gold/20 text-casino-gold shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                        : 'border-casino-border text-gray-400 hover:border-casino-gold hover:text-white'
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>

              {/* Grille */}
              <div className="overflow-x-auto">
                <div className="min-w-[400px]">
                  {/* Ligne 0 + numéros */}
                  <div className="flex gap-0.5 mb-0.5">
                    {/* 0 */}
                    <button
                      onClick={() => addBet('number', 0)}
                      disabled={betSent || gameState !== 'betting'}
                      className="roulette-cell bg-green-700 hover:bg-green-600 text-white text-sm font-bold w-12 py-3 rounded border border-green-500 disabled:opacity-50"
                    >
                      0
                      {renderChips('number', 0, getMyBetOnCell('number', 0))}
                    </button>

                    <div className="flex-1 grid grid-cols-12 gap-0.5">
                      {NUMBERS_LAYOUT.map((row, rowIdx) => (
                        <div key={rowIdx} className="contents">
                          {row.map(num => (
                            <button
                              key={num}
                              onClick={() => addBet('number', num)}
                              disabled={betSent || gameState !== 'betting'}
                              className={clsx(
                                'roulette-cell text-white text-xs font-bold py-3 rounded border disabled:opacity-50',
                                getNumberColor(num) === 'red'
                                  ? 'bg-red-700 hover:bg-red-600 border-red-500'
                                  : 'bg-gray-900 hover:bg-gray-800 border-gray-600',
                                // Highlight le numéro gagnant
                                gameState === 'result' && winningNumber === num
                                  ? 'ring-2 ring-white scale-105 z-10'
                                  : '',
                              )}
                            >
                              {num}
                              {renderChips('number', num, getMyBetOnCell('number', num))}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>

                    {/* Colonnes 2:1 */}
                    <div className="flex flex-col gap-0.5">
                      {[1, 2, 3].map(col => (
                        <button
                          key={col}
                          onClick={() => addBet('column', col)}
                          disabled={betSent || gameState !== 'betting'}
                          className="roulette-cell bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold w-10 py-1 rounded border border-gray-500 disabled:opacity-50 relative"
                        >
                          2:1
                          {renderChips('column', col, getMyBetOnCell('column', col))}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mises externes */}
                  <div className="grid grid-cols-6 gap-0.5 mt-0.5">
                    {[
                      { label: '1-12',   type: 'dozen',    value: 1 },
                      { label: '13-24',  type: 'dozen',    value: 2 },
                      { label: '25-36',  type: 'dozen',    value: 3 },
                    ].map(({ label, type, value }) => (
                      <button
                        key={label}
                        onClick={() => addBet(type as RouletteBetItem['type'], value)}
                        disabled={betSent || gameState !== 'betting'}
                        className="roulette-cell col-span-2 bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 rounded border border-gray-500 disabled:opacity-50 relative"
                      >
                        {label}
                        {renderChips(type, value, getMyBetOnCell(type as RouletteBetItem['type'], value))}
                      </button>
                    ))}

                    {[
                      { label: '1-18',   type: 'half',     value: 'first',  cls: '' },
                      { label: 'Pair',   type: 'even_odd', value: 'even',   cls: '' },
                      { label: 'Rouge',  type: 'color',    value: 'red',    cls: 'bg-red-700 border-red-500 hover:bg-red-600' },
                      { label: 'Noir',   type: 'color',    value: 'black',  cls: 'bg-gray-900 border-gray-600 hover:bg-gray-800' },
                      { label: 'Impair', type: 'even_odd', value: 'odd',    cls: '' },
                      { label: '19-36',  type: 'half',     value: 'second', cls: '' },
                    ].map(({ label, type, value, cls }) => (
                      <button
                        key={label}
                        onClick={() => addBet(type as RouletteBetItem['type'], value)}
                        disabled={betSent || gameState !== 'betting'}
                        className={clsx(
                          'roulette-cell text-white text-xs py-2 rounded border disabled:opacity-50 relative',
                          cls || 'bg-gray-700 hover:bg-gray-600 border-gray-500',
                        )}
                      >
                        {label}
                        {renderChips(type, value, getMyBetOnCell(type as RouletteBetItem['type'], value))}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <div className="text-sm text-gray-400">
                  Total misé : <span className="text-casino-gold font-bold"
                    style={totalBetAmount > 0 ? { textShadow: '0 0 10px rgba(245,158,11,0.5)' } : {}}
                  >
                    {formatBalance(totalBetAmount)}
                  </span>
                </div>
                <button
                  onClick={clearBets}
                  disabled={betSent || selectedBets.length === 0}
                  className="text-sm text-red-400 hover:text-red-300 disabled:opacity-30 transition-colors"
                >
                  Effacer
                </button>
                <button
                  onClick={placeBets}
                  disabled={betSent || selectedBets.length === 0 || gameState !== 'betting'}
                  className={clsx(
                    'ml-auto font-bold px-6 py-2 rounded-lg transition-all',
                    betSent
                      ? 'bg-green-500/20 border border-green-500/30 text-green-400 cursor-default'
                      : 'bg-casino-gold hover:bg-casino-gold-light text-black btn-gold-glow disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
                  )}
                >
                  {betSent ? '✓ Mises confirmées' : 'Placer les mises'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Chat ──────────────────────────────────────── */}
          <div className="h-[calc(100vh-8rem)] min-h-[500px]">
            <ChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
