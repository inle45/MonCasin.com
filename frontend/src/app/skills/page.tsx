'use client';

import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

const SKILLS = [
  { level: 1,  icon: '🌱', name: 'Bienvenue',         desc: 'Accès à tous les jeux solo',                  branch: 'base'   },
  { level: 3,  icon: '💬', name: 'Accès Chat',         desc: 'Chat en temps réel débloqué',                 branch: 'social' },
  { level: 5,  icon: '🎰', name: 'Free Spins',         desc: '+1 Free Spin offert à chaque level-up',       branch: 'bonus'  },
  { level: 6,  icon: '🃏', name: 'Joueur Confirmé',    desc: 'Titre "Joueur" visible dans le chat',         branch: 'social' },
  { level: 8,  icon: '💸', name: 'Rakeback+',          desc: 'Rakeback augmenté à 6% (vs 5% de base)',      branch: 'eco'    },
  { level: 10, icon: '⚔️', name: 'Duels débloqués',    desc: 'Accès aux duels PvP',                        branch: 'social' },
  { level: 12, icon: '🎯', name: 'Quête bonus',        desc: '+1 quête quotidienne supplémentaire',         branch: 'bonus'  },
  { level: 15, icon: '🌧️', name: 'Rain Power',        desc: 'Peut utiliser /rain dans le chat',            branch: 'social' },
  { level: 20, icon: '🛡️', name: 'Vétéran',           desc: 'Titre "Expert" + badge profil',               branch: 'social' },
  { level: 25, icon: '💰', name: 'Économe',            desc: 'Rakeback augmenté à 7%',                      branch: 'eco'    },
  { level: 30, icon: '🎁', name: 'Bonus mensuel',      desc: 'Bonus automatique de 5 000 F€ chaque mois',  branch: 'bonus'  },
  { level: 35, icon: '🔥', name: 'Streak Shield',      desc: 'Un streak manqué protégé par semaine',        branch: 'bonus'  },
  { level: 40, icon: '💎', name: 'VIP Access',         desc: 'Accès aux tables VIP et bonus exclusifs',     branch: 'eco'    },
  { level: 50, icon: '⚔️', name: 'Maître',            desc: 'Titre "Maître" + couleur de pseudo exclusive',branch: 'social' },
  { level: 75, icon: '👑', name: 'Légende',            desc: 'Titre "Légende" + badge animé unique',        branch: 'social' },
];

const BRANCH_COLORS: Record<string, string> = {
  base: '#f59e0b', social: '#8b5cf6', bonus: '#22c55e', eco: '#3b82f6',
};
const BRANCH_LABELS: Record<string, string> = {
  base: 'Base', social: 'Social', bonus: 'Bonus', eco: 'Économie',
};

export default function SkillsPage() {
  const { user } = useAuth();
  const level = user?.level || 1;

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-10">

        <div className="text-center mb-6">
          <h1 className="text-3xl font-black text-casino-gold">🌳 Arbre de Compétences</h1>
          <p className="text-gray-400 text-sm mt-1">Avantages débloqués en montant de niveau</p>
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <span className="text-casino-gold font-black">Niveau {level}</span>
            <span className="text-gray-400 text-sm">— {SKILLS.filter(s => s.level <= level).length}/{SKILLS.length} compétences débloquées</span>
          </div>
        </div>

        {/* Légende branches */}
        <div className="flex gap-3 flex-wrap justify-center mb-6">
          {Object.entries(BRANCH_LABELS).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ background: BRANCH_COLORS[k] }} />
              <span className="text-gray-400">{v}</span>
            </div>
          ))}
        </div>

        {/* Barre de progression globale */}
        <div className="casino-card p-4 mb-6">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Progression</span>
            <span>{Math.min(level, 75)}/75 niveaux</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-casino-gold rounded-full transition-all"
              style={{ width: `${Math.min((level / 75) * 100, 100)}%` }} />
          </div>
        </div>

        {/* Liste des compétences */}
        <div className="flex flex-col gap-3">
          {SKILLS.map((skill, i) => {
            const unlocked = level >= skill.level;
            const isNext = !unlocked && (i === 0 || level >= SKILLS[i - 1].level);
            return (
              <motion.div
                key={skill.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={clsx('flex items-center gap-4 rounded-xl p-4 transition-all', !unlocked && !isNext && 'opacity-40')}
                style={{
                  background: unlocked ? `linear-gradient(135deg,${BRANCH_COLORS[skill.branch]}15,rgba(18,18,31,0.9))` : 'rgba(18,18,31,0.6)',
                  border: `1px solid ${unlocked ? BRANCH_COLORS[skill.branch] + '40' : 'rgba(255,255,255,0.05)'}`,
                  boxShadow: unlocked ? `0 0 15px ${BRANCH_COLORS[skill.branch]}15` : 'none',
                }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: unlocked ? `${BRANCH_COLORS[skill.branch]}25` : 'rgba(255,255,255,0.04)' }}>
                  {unlocked ? skill.icon : '🔒'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={clsx('font-bold', unlocked ? 'text-white' : 'text-gray-500')}>{skill.name}</span>
                    {isNext && <span className="text-xs text-casino-gold bg-casino-gold/10 px-2 py-0.5 rounded-full">Suivant</span>}
                  </div>
                  <div className="text-gray-400 text-sm">{skill.desc}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={clsx('text-xs font-bold', unlocked ? 'text-green-400' : 'text-gray-600')}>
                    {unlocked ? '✓ Débloqué' : `Niv. ${skill.level}`}
                  </div>
                  <div className="w-2 h-2 rounded-full mt-1 mx-auto" style={{ background: BRANCH_COLORS[skill.branch] }} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
