'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import api, { formatBalance } from '@/lib/api';
import toast from 'react-hot-toast';
import { sfx } from '@/lib/sfx';

const GRADES = [
  {
    key: 'NONE',
    label: 'Joueur',
    icon: '🎮',
    color: '#9ca3af',
    income: 0,
    questBonus: 0,
    perks: ['Accès à tous les jeux', 'Chat global', 'Classement hebdo'],
    how: 'Grade de départ',
  },
  {
    key: 'SILVER',
    label: 'Silver',
    icon: '🥈',
    color: '#94a3b8',
    income: 100,
    questBonus: 5,
    perks: ['+5% sur les récompenses de quêtes', '100 F€ de revenu quotidien', 'Pseudo en argent'],
    how: 'Disponible en boutique (5 000 F€)',
  },
  {
    key: 'GOLD',
    label: 'Gold',
    icon: '🥇',
    color: '#f59e0b',
    income: 250,
    questBonus: 10,
    perks: ['+10% sur les récompenses de quêtes', '250 F€ de revenu quotidien', 'Pseudo doré', 'Bordure avatar Gold'],
    how: 'Disponible en boutique (20 000 F€)',
  },
  {
    key: 'PLATINUM',
    label: 'Platinum',
    icon: '💠',
    color: '#7dd3fc',
    income: 500,
    questBonus: 15,
    perks: ['+15% sur les récompenses de quêtes', '500 F€ de revenu quotidien', 'Pseudo platine', 'Bordure avatar Platine', 'Émotes exclusives en chat'],
    how: 'Disponible en boutique (100 000 F€)',
  },
  {
    key: 'DIAMOND',
    label: 'Diamond',
    icon: '💎',
    color: '#c084fc',
    income: 1000,
    questBonus: 25,
    perks: ['+25% sur les récompenses de quêtes', '1 000 F€ de revenu quotidien', 'Pseudo diamant animé', 'Bordure avatar Diamant', 'Émotes exclusives VIP', 'Multiplicateur ×1.5 au Tournoi'],
    how: 'Grade ultime — disponible en boutique (500 000 F€)',
  },
];

export default function GradesPage() {
  const { user, updateUser } = useAuth();
  const [claiming, setClaiming] = useState(false);

  const myGrade = GRADES.find(g => g.key === user?.grade) || GRADES[0];
  const myGradeIdx = GRADES.findIndex(g => g.key === user?.grade);

  async function claimIncome() {
    setClaiming(true);
    try {
      const r = await api.post('/users/grade-income');
      sfx.coin();
      toast.success(`+${formatBalance(r.data.income)} F€ réclamés !`);
      updateUser({ balance: r.data.newBalance });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Impossible de réclamer');
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-20 pb-10 flex flex-col gap-5">

        <div className="text-center">
          <h1 className="text-3xl font-black" style={{ color: myGrade.color }}>
            {myGrade.icon} Grades
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Ton grade actuel : <span className="font-bold" style={{ color: myGrade.color }}>{myGrade.label}</span>
          </p>
        </div>

        {/* Claim revenu quotidien */}
        {myGrade.income > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 text-center"
            style={{ background: `rgba(${myGrade.color === '#f59e0b' ? '245,158,11' : myGrade.color === '#94a3b8' ? '148,163,184' : myGrade.color === '#7dd3fc' ? '125,211,252' : '192,132,252'},0.12)`, border: `2px solid ${myGrade.color}40` }}
          >
            <div className="text-sm text-gray-400 mb-1">Revenu quotidien {myGrade.label}</div>
            <div className="text-3xl font-black mb-3" style={{ color: myGrade.color }}>
              +{formatBalance(myGrade.income)} F€
            </div>
            <button
              onClick={claimIncome}
              disabled={claiming}
              className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              style={{ background: myGrade.color, color: '#0a0a14' }}
            >
              {claiming ? 'Réclamation...' : 'Réclamer mon revenu'}
            </button>
            <div className="text-xs text-gray-500 mt-2">Disponible une fois par jour</div>
          </motion.div>
        )}

        {/* Liste des grades */}
        <div className="flex flex-col gap-3">
          {GRADES.map((g, idx) => {
            const isOwned = idx <= myGradeIdx;
            const isCurrent = g.key === user?.grade;

            return (
              <motion.div
                key={g.key}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.07 }}
                className="rounded-2xl p-4"
                style={{
                  background: isCurrent ? `${g.color}18` : 'rgba(30,27,75,0.4)',
                  border: isCurrent ? `2px solid ${g.color}60` : '1px solid rgba(245,158,11,0.1)',
                  opacity: isOwned ? 1 : 0.6,
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{g.icon}</span>
                  <div>
                    <div className="font-black text-base" style={{ color: g.color }}>{g.label}</div>
                    <div className="text-xs text-gray-500">{g.how}</div>
                  </div>
                  {isCurrent && (
                    <span className="ml-auto text-xs font-bold px-2 py-1 rounded-lg" style={{ background: `${g.color}22`, color: g.color }}>
                      Mon grade
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
                    <div className="text-xs text-gray-500">Revenu / jour</div>
                    <div className="font-black text-sm" style={{ color: g.income > 0 ? g.color : '#4b5563' }}>
                      {g.income > 0 ? `+${formatBalance(g.income)}` : '—'}
                    </div>
                  </div>
                  <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
                    <div className="text-xs text-gray-500">Bonus quêtes</div>
                    <div className="font-black text-sm" style={{ color: g.questBonus > 0 ? g.color : '#4b5563' }}>
                      {g.questBonus > 0 ? `+${g.questBonus}%` : '—'}
                    </div>
                  </div>
                </div>

                <ul className="flex flex-col gap-1">
                  {g.perks.map(perk => (
                    <li key={perk} className="text-xs text-gray-300 flex items-center gap-1.5">
                      <span style={{ color: g.color }}>✓</span>
                      {perk}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-600">
          Les grades s'achètent en boutique avec des F€.<br />
          Les avantages sont cumulatifs avec le grade supérieur.
        </p>
      </div>
    </div>
  );
}
