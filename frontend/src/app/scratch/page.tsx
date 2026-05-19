'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';

interface ScratchResult {
  cells: string[];
  prize: number;
  newBalance: number;
}

function ScratchCell({ symbol, revealed, onReveal, disabled }: {
  symbol: string;
  revealed: boolean;
  onReveal: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={() => { if (!revealed && !disabled) onReveal(); }}
      className="relative w-full aspect-square rounded-xl flex items-center justify-center text-3xl font-black transition-all select-none overflow-hidden"
      style={{
        background: revealed ? '#131128' : '#1e1a3e',
        border: revealed ? '2px solid #2d2d5e' : '2px solid #4c1d95',
        cursor: revealed || disabled ? 'default' : 'pointer',
        transform: revealed ? 'scale(0.97)' : 'scale(1)',
        transition: 'all 0.15s ease',
      }}
    >
      {revealed ? (
        <span className="animate-bounce-once">{symbol}</span>
      ) : (
        <span className="text-purple-400 text-4xl select-none">?</span>
      )}
    </button>
  );
}

export default function ScratchPage() {
  const { user, updateUser } = useAuth();
  const [alreadyPlayed, setAlreadyPlayed] = useState<boolean | null>(null);
  const [result, setResult] = useState<ScratchResult | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>(Array(9).fill(false));
  const [allRevealed, setAllRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    api.get('/scratch/state').then(({ data }) => {
      setAlreadyPlayed(data.alreadyScratched);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const play = async () => {
    setPlaying(true);
    try {
      const { data } = await api.post('/scratch/play');
      setResult(data);
      setRevealed(Array(9).fill(false));
      setAllRevealed(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur');
      setAlreadyPlayed(true);
    } finally {
      setPlaying(false);
    }
  };

  const revealCell = (i: number) => {
    const next = [...revealed];
    next[i] = true;
    setRevealed(next);
    if (next.every(Boolean)) {
      setAllRevealed(true);
      setAlreadyPlayed(true);
      if (result) {
        updateUser({ balance: result.newBalance });
        if (result.prize > 0) {
          toast.success(`🎉 Tu gagnes ${formatBalance(result.prize)} !`, { duration: 5000 });
        } else {
          toast('Rien cette fois — reviens demain !', { icon: '😔' });
        }
      }
    }
  };

  const revealAll = () => {
    setRevealed(Array(9).fill(true));
    setAllRevealed(true);
    setAlreadyPlayed(true);
    if (result) {
      updateUser({ balance: result.newBalance });
      if (result.prize > 0) {
        toast.success(`🎉 Tu gagnes ${formatBalance(result.prize)} !`, { duration: 5000 });
      } else {
        toast('Rien cette fois — reviens demain !', { icon: '😔' });
      }
    }
  };

  const winning = result && allRevealed && result.prize > 0;

  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: '#0a0a16' }}>
      <Navbar />
      <div className="pt-20 pb-10 px-4 max-w-sm mx-auto">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white mb-1">Carte à Gratter</h1>
          <p className="text-gray-500 text-sm">Une carte gratuite par jour</p>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-20">Chargement…</div>
        ) : !result ? (
          <div className="space-y-6">
            {/* Preview card */}
            <div
              className="rounded-2xl p-6"
              style={{ background: '#0d0d1e', border: '2px solid #4c1d95' }}
            >
              <div className="grid grid-cols-3 gap-3 mb-6">
                {Array(9).fill(null).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-xl flex items-center justify-center text-4xl"
                    style={{ background: '#1e1a3e', border: '2px solid #4c1d95' }}
                  >
                    <span className="text-purple-400">?</span>
                  </div>
                ))}
              </div>

              {alreadyPlayed ? (
                <div className="text-center text-gray-400 text-sm py-4">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                  <p className="font-bold">Déjà utilisé aujourd'hui</p>
                  <p className="text-gray-600 text-xs mt-1">Reviens demain pour une nouvelle carte !</p>
                </div>
              ) : (
                <button
                  onClick={play}
                  disabled={playing}
                  className="w-full py-4 rounded-xl font-black text-white transition-all text-lg"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                    opacity: playing ? 0.7 : 1,
                  }}
                >
                  {playing ? 'Génération…' : '🎰 Gratter ma carte'}
                </button>
              )}
            </div>

            {/* Infos prizes */}
            <div className="rounded-xl p-4 text-xs text-gray-500" style={{ background: '#0d0d1e', border: '1px solid #1e1e35' }}>
              <p className="font-bold text-gray-400 mb-2">Gains possibles (3 symboles identiques sur une ligne)</p>
              <div className="grid grid-cols-2 gap-1">
                {[
                  ['🍒🍒🍒', '500 F€'], ['🍋🍋🍋', '1 000 F€'], ['🍊🍊🍊', '2 000 F€'],
                  ['🎲🎲🎲', '3 000 F€'], ['🃏🃏🃏', '4 000 F€'], ['⭐⭐⭐', '5 000 F€'],
                  ['🎰🎰🎰', '10 000 F€'], ['💰💰💰', '25 000 F€'], ['💎💎💎', '50 000 F€'],
                ].map(([sym, val]) => (
                  <div key={sym} className="flex justify-between items-center py-0.5">
                    <span>{sym}</span>
                    <span className="text-yellow-400 font-bold">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        ) : (
          <div className="space-y-4">
            {/* Carte interactive */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: winning ? 'linear-gradient(135deg, #052e16, #14532d)' : '#0d0d1e',
                border: `2px solid ${winning ? '#16a34a' : '#4c1d95'}`,
                transition: 'all 0.3s ease',
              }}
            >
              {winning && (
                <div className="text-center mb-4 text-2xl font-black text-green-400 animate-pulse">
                  🎉 GAGNANT !
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 mb-6">
                {result.cells.map((sym, i) => (
                  <ScratchCell
                    key={i}
                    symbol={sym}
                    revealed={revealed[i]}
                    onReveal={() => revealCell(i)}
                    disabled={allRevealed}
                  />
                ))}
              </div>

              {!allRevealed ? (
                <div className="text-center space-y-2">
                  <p className="text-purple-300 text-sm">Clique sur les cases pour les révéler</p>
                  <button
                    onClick={revealAll}
                    className="text-xs text-gray-600 hover:text-gray-400 underline transition-colors"
                  >
                    Tout révéler d'un coup
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  {result.prize > 0 ? (
                    <div>
                      <p className="text-green-400 font-black text-2xl">{formatBalance(result.prize)}</p>
                      <p className="text-green-300 text-sm mt-1">crédités sur ton compte !</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-400 font-bold">Pas de gain cette fois</p>
                      <p className="text-gray-600 text-xs mt-1">Reviens demain pour une nouvelle chance !</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
