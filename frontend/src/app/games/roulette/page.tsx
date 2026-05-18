'use client';

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

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
    });

    socket.on('roulette:countdown', (data) => {
      setCountdown(data.countdown);
    });

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

      const myResult = data.results?.find((r: any) => r.userId === user?.id);
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

    socket.on('error', (data) => toast.error(data.message));

    return () => {
      socket.off('init');
      socket.off('roulette:betting');
      socket.off('roulette:countdown');
      socket.off('roulette:spinning');
      socket.off('roulette:result');
      socket.off('roulette:bet_confirmed');
      socket.off('error');
    };
  }, [socket, user, updateUser]);

  const addBet = (type: RouletteBetItem['type'], value: string | number) => {
    if (betSent || gameState !== 'betting') return;
    const totalBet = selectedBets.reduce((s, b) => s + b.amount, 0);
    if (totalBet + chipAmount > (user?.balance || 0)) {
      toast.error('Solde insuffisant');
      return;
    }
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

  const getBetOnCell = (type: RouletteBetItem['type'], value: string | number) => {
    return selectedBets.find(b => b.type === type && b.value === value)?.amount || 0;
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-casino-dark">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 pt-20 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* En-tête */}
            <div className="casino-card p-4 flex items-center justify-between">
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                🎡 Roulette Européenne
                <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">LIVE</span>
              </h1>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className={clsx('text-2xl font-bold',
                    gameState === 'betting' ? 'text-casino-gold' :
                    gameState === 'spinning' ? 'text-blue-400 animate-spin' : 'text-white'
                  )}>
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

            {/* Roue visuelle */}
            <div className="casino-card p-6 text-center">
              {gameState === 'result' && winningNumber !== null ? (
                <div className="space-y-3">
                  <div className={clsx(
                    'text-8xl font-black inline-flex items-center justify-center w-32 h-32 rounded-full border-4 animate-fade-in',
                    winColor === 'red' ? 'text-white bg-red-600 border-red-400' :
                    winColor === 'black' ? 'text-white bg-gray-900 border-gray-600' :
                    'text-white bg-green-600 border-green-400'
                  )}>
                    {winningNumber}
                  </div>
                  {lastResult && (
                    <div className={clsx('text-lg font-bold',
                      lastResult.win > 0 ? 'text-green-400' : 'text-red-400'
                    )}>
                      {lastResult.win > 0
                        ? `🎉 +${formatBalance(lastResult.win)}`
                        : `💸 -${formatBalance(lastResult.bet)}`}
                    </div>
                  )}
                </div>
              ) : gameState === 'spinning' ? (
                <div className="text-6xl animate-spin">🎡</div>
              ) : (
                <div className="text-5xl">🎡</div>
              )}

              {/* Historique */}
              <div className="flex gap-2 mt-4 justify-center flex-wrap">
                {history.slice(0, 12).map((h, i) => (
                  <span key={i} className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white',
                    h.color === 'red' ? 'bg-red-600' :
                    h.color === 'black' ? 'bg-gray-800 border border-gray-600' :
                    'bg-green-600'
                  )}>
                    {h.number}
                  </span>
                ))}
              </div>
            </div>

            {/* Table de roulette */}
            <div className="casino-card p-4">
              {/* Chip selector */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-gray-400">Mise par clic :</span>
                {[10, 50, 100, 500, 1000].map(v => (
                  <button
                    key={v}
                    onClick={() => setChipAmount(v)}
                    className={clsx(
                      'px-3 py-1 rounded-full text-sm font-bold border transition-colors',
                      chipAmount === v
                        ? 'border-casino-gold bg-casino-gold/20 text-casino-gold'
                        : 'border-casino-border text-gray-400 hover:border-casino-gold'
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>

              {/* Grille */}
              <div className="overflow-x-auto">
                <div className="min-w-[400px]">
                  {/* 0 */}
                  <div className="flex gap-0.5 mb-0.5">
                    <button
                      onClick={() => addBet('number', 0)}
                      className="bg-green-700 hover:bg-green-600 text-white text-sm font-bold w-12 py-3 rounded border border-green-500 transition-colors relative"
                    >
                      0
                      {getBetOnCell('number', 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-casino-gold text-black text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {getBetOnCell('number', 0)}
                        </span>
                      )}
                    </button>

                    <div className="flex-1 grid grid-cols-12 gap-0.5">
                      {NUMBERS_LAYOUT.map((row, rowIdx) => (
                        <div key={rowIdx} className="contents">
                          {row.map(num => (
                            <button
                              key={num}
                              onClick={() => addBet('number', num)}
                              className={clsx(
                                'text-white text-xs font-bold py-3 rounded border transition-colors relative',
                                getNumberColor(num) === 'red'
                                  ? 'bg-red-700 hover:bg-red-600 border-red-500'
                                  : 'bg-gray-900 hover:bg-gray-800 border-gray-600',
                              )}
                            >
                              {num}
                              {getBetOnCell('number', num) > 0 && (
                                <span className="absolute -top-1 -right-1 bg-casino-gold text-black text-xs rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                                  ●
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>

                    {/* Colonnes */}
                    <div className="flex flex-col gap-0.5">
                      {[1, 2, 3].map(col => (
                        <button key={col} onClick={() => addBet('column', col)}
                          className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold w-10 py-1 rounded border border-gray-500 transition-colors">
                          2:1
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mises simples */}
                  <div className="grid grid-cols-6 gap-0.5 mt-0.5">
                    <button onClick={() => addBet('dozen', 1)} className="col-span-2 bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 rounded border border-gray-500 transition-colors">
                      1-12
                    </button>
                    <button onClick={() => addBet('dozen', 2)} className="col-span-2 bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 rounded border border-gray-500 transition-colors">
                      13-24
                    </button>
                    <button onClick={() => addBet('dozen', 3)} className="col-span-2 bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 rounded border border-gray-500 transition-colors">
                      25-36
                    </button>

                    <button onClick={() => addBet('half', 'first')} className="bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 rounded border border-gray-500 transition-colors">
                      1-18
                    </button>
                    <button onClick={() => addBet('even_odd', 'even')} className="bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 rounded border border-gray-500 transition-colors">
                      Pair
                    </button>
                    <button onClick={() => addBet('color', 'red')} className="bg-red-700 hover:bg-red-600 text-white text-xs py-2 rounded border border-red-500 transition-colors">
                      Rouge
                    </button>
                    <button onClick={() => addBet('color', 'black')} className="bg-gray-900 hover:bg-gray-800 text-white text-xs py-2 rounded border border-gray-600 transition-colors">
                      Noir
                    </button>
                    <button onClick={() => addBet('even_odd', 'odd')} className="bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 rounded border border-gray-500 transition-colors">
                      Impair
                    </button>
                    <button onClick={() => addBet('half', 'second')} className="bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 rounded border border-gray-500 transition-colors">
                      19-36
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-4">
                <div className="text-sm text-gray-400">
                  Total misé : <span className="text-casino-gold font-bold">{formatBalance(totalBetAmount)}</span>
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
                  className="ml-auto bg-casino-gold hover:bg-casino-gold-light disabled:opacity-50 text-black font-bold px-6 py-2 rounded-lg transition-colors"
                >
                  {betSent ? '✓ Mises confirmées' : 'Placer les mises'}
                </button>
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="h-[calc(100vh-8rem)] min-h-[500px]">
            <ChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
