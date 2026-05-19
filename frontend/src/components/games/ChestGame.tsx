'use client';

import { motion, AnimatePresence } from 'framer-motion';

const CATALOGUE: Record<string, { emoji: string; name: string; couleur: string }> = {
  TICKET_ROUE:       { emoji: '🎡', name: 'Ticket Roue',    couleur: '#f59e0b' },
  PASS_FREE_SPINS:   { emoji: '🎰', name: 'Free Spins',     couleur: '#3b82f6' },
  ASSURANCE_CRASH:   { emoji: '🛡️', name: 'Assurance',      couleur: '#10b981' },
  FUMIGENE_ROULETTE: { emoji: '💨', name: 'Fumigène',       couleur: '#8b5cf6' },
  CONTRE_RACKET:     { emoji: '⚔️', name: 'Anti-Racket',    couleur: '#ef4444' },
  DOUBLE_DAILY:      { emoji: '⚡', name: 'Double Daily',   couleur: '#fbbf24' },
  EMOTE_VIP:         { emoji: '👑', name: 'Émote VIP',      couleur: '#f59e0b' },
  SOUNDBITE:         { emoji: '🔊', name: 'Soundbite',      couleur: '#06b6d4' },
};

interface Coffre {
  estAlarme: boolean;
  valeur: number;
  item: string | null;
  revele: boolean;
}

interface Props {
  coffres: Coffre[];
  gainTotal: number;
  itemsObtenus: string[];
  mise: number;
  termine: boolean;
  onPick: (index: number) => void;
  onClose: () => void;
}

export default function ChestGame({ coffres, gainTotal, itemsObtenus, mise, termine, onPick, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md flex flex-col items-center gap-4 p-5 rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)', border: '2px solid #f59e0b' }}
      >
        <h2 className="text-2xl font-black text-casino-gold">Casse des Coffres</h2>

        {/* Stats */}
        <div className="flex gap-6 text-sm text-center">
          <div>
            <div className="text-gray-400 text-xs">Mise</div>
            <div className="text-white font-bold">{mise.toLocaleString('fr-FR')} F€</div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Gain F€</div>
            <div className="text-green-400 font-bold text-lg">+{gainTotal.toLocaleString('fr-FR')}</div>
          </div>
          {itemsObtenus.length > 0 && (
            <div>
              <div className="text-gray-400 text-xs">Loots</div>
              <div className="text-yellow-400 font-bold text-lg">{itemsObtenus.length} 🎁</div>
            </div>
          )}
        </div>

        {/* Items obtenus */}
        <AnimatePresence>
          {itemsObtenus.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex flex-wrap gap-1.5 justify-center w-full"
            >
              {itemsObtenus.map((item, i) => {
                const meta = CATALOGUE[item];
                if (!meta) return null;
                return (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.1, type: 'spring' }}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
                    style={{ background: `${meta.couleur}22`, border: `1px solid ${meta.couleur}`, color: meta.couleur }}
                  >
                    {meta.emoji} {meta.name}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-yellow-300 text-xs text-center">
          {termine ? 'Partie terminée !' : 'Ouvrez un coffre. Évitez les alarmes !'}
        </p>

        {/* Grille 4×3 */}
        <div className="grid grid-cols-4 gap-2 w-full">
          {coffres.map((coffre, i) => (
            <ChestCell key={i} coffre={coffre} index={i} termine={termine} onPick={onPick} />
          ))}
        </div>

        {termine && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onClose}
            className="w-full py-3 bg-casino-gold text-black font-black rounded-xl text-base hover:bg-casino-gold-light transition-colors"
          >
            Encaisser {gainTotal.toLocaleString('fr-FR')} F€ + {itemsObtenus.length} loot{itemsObtenus.length > 1 ? 's' : ''} 💰
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}

function ChestCell({ coffre, index, termine, onPick }: {
  coffre: Coffre;
  index: number;
  termine: boolean;
  onPick: (i: number) => void;
}) {
  const clickable = !coffre.revele && !termine;
  const meta = coffre.item ? CATALOGUE[coffre.item] : null;

  return (
    <motion.button
      whileHover={clickable ? { scale: 1.1, y: -4 } : {}}
      whileTap={clickable ? { scale: 0.93 } : {}}
      onClick={() => clickable && onPick(index)}
      disabled={!clickable}
      className="relative aspect-square rounded-xl flex flex-col items-center justify-center font-bold transition-all overflow-hidden"
      style={{
        background: coffre.revele
          ? coffre.estAlarme
            ? 'linear-gradient(135deg, #7f1d1d, #991b1b)'
            : meta
            ? `linear-gradient(135deg, ${meta.couleur}33, #0f172a)`
            : 'linear-gradient(135deg, #14532d, #166534)'
          : 'linear-gradient(135deg, #78350f, #92400e)',
        border: coffre.revele
          ? coffre.estAlarme ? '2px solid #ef4444' : meta ? `2px solid ${meta.couleur}` : '2px solid #22c55e'
          : '2px solid #d97706',
        cursor: clickable ? 'pointer' : 'default',
        boxShadow: coffre.revele && meta ? `0 0 14px ${meta.couleur}55` : 'none',
      }}
    >
      <AnimatePresence mode="wait">
        {!coffre.revele ? (
          <motion.span key="closed" exit={{ opacity: 0, scale: 0 }} className="text-2xl">
            📦
          </motion.span>
        ) : (
          <motion.div
            key="open"
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 280 }}
            className="flex flex-col items-center gap-0.5 p-1"
          >
            <span className="text-xl leading-none">
              {coffre.estAlarme ? '🚨' : meta ? meta.emoji : '💰'}
            </span>
            {coffre.estAlarme && <span className="text-[9px] text-red-300 font-black">ALARME</span>}
            {!coffre.estAlarme && meta && (
              <span className="text-[8px] font-black leading-tight text-center" style={{ color: meta.couleur }}>
                {meta.name}
              </span>
            )}
            {!coffre.estAlarme && !meta && coffre.valeur > 0 && (
              <span className="text-[9px] text-green-300 font-black">
                +{coffre.valeur >= 1000 ? `${(coffre.valeur/1000).toFixed(1)}k` : coffre.valeur}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
