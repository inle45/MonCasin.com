'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';

type Quest = {
  key: string;
  title: string;
  desc: string;
  target: number;
  reward: number;
  unit: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
};

function timeUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function QuestsPage() {
  const { user, updateUser } = useAuth();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [day, setDay] = useState('');
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(timeUntilMidnight());

  const fetchQuests = useCallback(async () => {
    try {
      const res = await api.get('/quests');
      setQuests(res.data.quests);
      setDay(res.data.day);
    } catch {
      toast.error('Impossible de charger les quêtes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuests();
    const timer = setInterval(() => setCountdown(timeUntilMidnight()), 60000);
    return () => clearInterval(timer);
  }, [fetchQuests]);

  const claim = useCallback(async (questKey: string) => {
    if (claiming) return;
    setClaiming(questKey);
    try {
      const res = await api.post(`/quests/${questKey}/claim`);
      updateUser({ balance: res.data.newBalance });
      setQuests(prev => prev.map(q =>
        q.key === questKey ? { ...q, claimed: true } : q
      ));
      toast.success(`+${formatBalance(res.data.reward)} réclamés !`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur réclamation');
    }
    setClaiming(null);
  }, [claiming, updateUser]);

  const completed = quests.filter(q => q.completed).length;
  const totalReward = quests.reduce((s, q) => s + q.reward, 0);

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-20 pb-10 flex flex-col gap-5">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-black text-casino-gold">📋 Quêtes du jour</h1>
          <p className="text-gray-400 text-sm mt-1">
            Se renouvellent dans <span className="text-casino-gold font-bold">{countdown}</span>
          </p>
        </div>

        {/* Progress bar */}
        {!loading && (
          <div className="rounded-2xl p-4"
            style={{ background: 'rgba(30,27,75,0.6)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">{completed}/3 quêtes complétées</span>
              <span className="text-casino-gold font-bold">
                {completed === 3 ? `+${formatBalance(totalReward)} max` : `jusqu'à +${formatBalance(totalReward)}`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg,#b45309,#f59e0b)' }}
                initial={{ width: 0 }}
                animate={{ width: `${(completed / 3) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {/* Quests */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Chargement...</div>
        ) : (
          <div className="flex flex-col gap-3">
            {quests.map((quest, idx) => {
              const pct = Math.min((quest.progress / quest.target) * 100, 100);
              return (
                <motion.div
                  key={quest.key}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className="rounded-2xl p-4 flex flex-col gap-3"
                  style={{
                    background: quest.claimed
                      ? 'rgba(20,83,45,0.4)'
                      : quest.completed
                      ? 'rgba(30,27,75,0.8)'
                      : 'rgba(30,27,75,0.5)',
                    border: quest.claimed
                      ? '2px solid #22c55e'
                      : quest.completed
                      ? '2px solid rgba(245,158,11,0.6)'
                      : '1px solid rgba(245,158,11,0.15)',
                    boxShadow: quest.completed && !quest.claimed
                      ? '0 0 20px rgba(245,158,11,0.2)'
                      : 'none',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-base flex items-center gap-2">
                        {quest.title}
                        {quest.claimed && <span className="text-green-400 text-sm">✓ Réclamée</span>}
                      </div>
                      <div className="text-gray-400 text-sm mt-0.5">{quest.desc}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-green-400 font-black text-sm">+{formatBalance(quest.reward)}</div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>
                        {quest.progress < quest.target
                          ? `${quest.progress} / ${quest.target} ${quest.unit}`
                          : `${quest.target} / ${quest.target} ${quest.unit}`}
                      </span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: quest.claimed
                            ? '#22c55e'
                            : quest.completed
                            ? 'linear-gradient(90deg,#b45309,#f59e0b)'
                            : 'rgba(245,158,11,0.5)',
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, delay: idx * 0.08 + 0.2 }}
                      />
                    </div>
                  </div>

                  {/* Claim button */}
                  <AnimatePresence>
                    {quest.completed && !quest.claimed && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => claim(quest.key)}
                        disabled={claiming === quest.key}
                        className="w-full py-2.5 rounded-xl font-black text-sm"
                        style={{
                          background: 'linear-gradient(135deg,#b45309,#f59e0b)',
                          color: '#000',
                          boxShadow: '0 0 16px rgba(245,158,11,0.4)',
                        }}
                      >
                        {claiming === quest.key ? '...' : `🎁 Réclamer +${formatBalance(quest.reward)}`}
                      </motion.button>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-gray-600 mt-2">
          3 nouvelles quêtes chaque jour à minuit.<br />
          Les récompenses ne s'accumulent pas — réclame-les avant la fin de la journée !
        </p>
      </div>
    </div>
  );
}
