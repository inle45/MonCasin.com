'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/context/AuthContext';
import api, { formatBalance } from '@/lib/api';
import toast from 'react-hot-toast';
import { Swords, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface PendingDuel {
  id: string;
  challengerId: string;
  challengerPseudo: string;
  targetId: string;
  targetPseudo: string;
  amount: number;
  status: string;
  createdAt: string;
}

function DuelPageInner() {
  const { user, updateUser } = useAuth();
  const searchParams = useSearchParams();
  const [target, setTarget] = useState(searchParams.get('target') || '');
  const [amount, setAmount] = useState('');
  const [pendingDuels, setPendingDuels] = useState<PendingDuel[]>([]);
  const [sending, setSending] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);

  const loadPending = () => {
    api.get('/duel/pending').then(({ data }) => setPendingDuels(data.duels)).catch(() => {});
  };

  useEffect(() => { loadPending(); }, []);

  const challenge = async () => {
    if (!target.trim() || !amount) return;
    setSending(true);
    try {
      await api.post('/duel/challenge', { targetPseudo: target.trim(), amount: parseFloat(amount) });
      toast.success(`⚔️ Défi envoyé à ${target} !`);
      setTarget('');
      setAmount('');
      loadPending();
      // Debit balance optimistically
      const mise = parseFloat(amount);
      if (user) updateUser({ balance: user.balance - mise });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur');
    } finally {
      setSending(false);
    }
  };

  const respond = async (duelId: string, accept: boolean, duel: PendingDuel) => {
    setResponding(duelId);
    try {
      const { data } = await api.post('/duel/respond', { duelId, accept });
      if (!accept) {
        toast('Défi refusé.', { icon: '❌' });
      } else {
        const r = data.result;
        const iWon = r.winnerId === user?.id;
        if (iWon) {
          toast.success(`🎉 Tu gagnes ! ${r.challengerRoll} vs ${r.targetRoll} → +${formatBalance(r.prize)}`, { duration: 6000 });
          updateUser({ balance: (user?.balance ?? 0) - duel.amount + r.prize });
        } else {
          toast.error(`💀 Tu perds ! ${r.challengerRoll} vs ${r.targetRoll}`, { duration: 6000 });
          updateUser({ balance: (user?.balance ?? 0) - duel.amount });
        }
      }
      loadPending();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur');
    } finally {
      setResponding(null);
    }
  };

  if (!user) return null;

  const incoming = pendingDuels.filter(d => d.targetId === user.id);
  const outgoing = pendingDuels.filter(d => d.challengerId === user.id);

  return (
    <div className="min-h-screen" style={{ background: '#0a0a16' }}>
      <Navbar />
      <div className="pt-20 pb-12 px-4 max-w-xl mx-auto space-y-6">

        <div className="text-center">
          <h1 className="text-3xl font-black text-white mb-1">⚔️ Duels</h1>
          <p className="text-gray-500 text-sm">Défie un autre joueur — le plus grand dé gagne</p>
        </div>

        {/* Challenge form */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#0d0d1e', border: '1px solid #1e1e35' }}>
          <h2 className="font-black text-white text-sm uppercase tracking-widest">Lancer un défi</h2>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Pseudo de l'adversaire</label>
            <input
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder="Pseudo exact..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Mise (F€)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="1000"
                min="100"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
              />
              {[500, 1000, 5000].map(v => (
                <button key={v} onClick={() => setAmount(String(v))}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors">
                  {(v / 1000).toFixed(v >= 1000 ? 0 : 1)}k
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-3 text-xs text-gray-500" style={{ background: '#ffffff08' }}>
            Chaque joueur lance un dé (1-100). Le plus grand gagne <span className="text-white font-bold">1.94× la mise</span> (3% de commission).
          </div>

          <button
            onClick={challenge}
            disabled={sending || !target.trim() || !amount}
            className="w-full py-3 rounded-xl font-black text-white transition-all flex items-center justify-center gap-2"
            style={{ background: sending || !target.trim() || !amount ? '#1e1e35' : 'linear-gradient(135deg, #7c3aed, #4f46e5)', cursor: sending || !target.trim() || !amount ? 'not-allowed' : 'pointer' }}
          >
            <Swords className="w-4 h-4" />
            {sending ? 'Envoi…' : 'Défier'}
          </button>
        </div>

        {/* Incoming duels */}
        {incoming.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              Défis reçus ({incoming.length})
            </h2>
            {incoming.map(d => (
              <div key={d.id} className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: '#12102a', border: '1px solid #4c1d95' }}>
                <div>
                  <p className="text-white font-bold text-sm">{d.challengerPseudo}</p>
                  <p className="text-purple-300 text-xs mt-0.5">mise : <span className="font-black">{formatBalance(d.amount)}</span></p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(d.id, true, d)}
                    disabled={responding === d.id}
                    className="px-4 py-2 rounded-xl text-xs font-black text-white bg-green-600 hover:bg-green-500 transition-colors disabled:opacity-50"
                  >
                    Accepter
                  </button>
                  <button
                    onClick={() => respond(d.id, false, d)}
                    disabled={responding === d.id}
                    className="px-4 py-2 rounded-xl text-xs font-black text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Outgoing duels */}
        {outgoing.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Défis envoyés ({outgoing.length})
            </h2>
            {outgoing.map(d => (
              <div key={d.id} className="rounded-xl p-4 flex items-center justify-between" style={{ background: '#0d0d1e', border: '1px solid #1e1e35' }}>
                <div>
                  <p className="text-white font-bold text-sm">→ {d.targetPseudo}</p>
                  <p className="text-gray-500 text-xs mt-0.5">En attente · mise : <span className="font-bold">{formatBalance(d.amount)}</span></p>
                </div>
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {incoming.length === 0 && outgoing.length === 0 && (
          <div className="text-center text-gray-600 text-sm py-8">
            Aucun défi en attente — lance le premier !
          </div>
        )}

      </div>
    </div>
  );
}

export default function DuelPage() {
  return (
    <Suspense fallback={null}>
      <DuelPageInner />
    </Suspense>
  );
}
