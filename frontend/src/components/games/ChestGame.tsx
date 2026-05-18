'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface Coffre {
  estAlarme: boolean;
  valeur: number;
  revele: boolean;
}

interface Props {
  coffres: Coffre[];
  gainTotal: number;
  mise: number;
  termine: boolean;
  onPick: (index: number) => void;
  onClose: () => void;
}

export default function ChestGame({ coffres, gainTotal, mise, termine, onPick, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md flex flex-col items-center gap-5 p-6 rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)', border: '2px solid #f59e0b' }}
      >
        <h2 className="text-2xl font-black text-casino-gold">Casse des Coffres</h2>

        <div className="flex gap-6 text-sm text-center">
          <div>
            <div className="text-gray-400">Mise</div>
            <div className="text-white font-bold">{mise.toLocaleString('fr-FR')} F€</div>
          </div>
          <div>
            <div className="text-gray-400">Gain cumulé</div>
            <div className="text-green-400 font-bold text-lg">+{gainTotal.toLocaleString('fr-FR')} F€</div>
          </div>
        </div>

        <p className="text-yellow-300 text-xs text-center">
          {termine
            ? 'Partie terminée !'
            : 'Cliquez sur un coffre pour l\'ouvrir. Évitez les alarmes !'}
        </p>

        {/* Grille 4×3 */}
        <div className="grid grid-cols-4 gap-3 w-full">
          {coffres.map((coffre, i) => (
            <ChestCell
              key={i}
              coffre={coffre}
              index={i}
              termine={termine}
              onPick={onPick}
            />
          ))}
        </div>

        {termine && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onClose}
            className="mt-2 px-8 py-3 bg-casino-gold text-black font-black rounded-xl text-lg hover:bg-casino-gold-light transition-colors"
          >
            Encaisser {gainTotal.toLocaleString('fr-FR')} F€ 💰
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

  return (
    <motion.button
      whileHover={clickable ? { scale: 1.08, y: -3 } : {}}
      whileTap={clickable ? { scale: 0.95 } : {}}
      onClick={() => clickable && onPick(index)}
      disabled={!clickable}
      className="relative aspect-square rounded-xl flex flex-col items-center justify-center text-2xl font-bold transition-all overflow-hidden"
      style={{
        background: coffre.revele
          ? coffre.estAlarme
            ? 'linear-gradient(135deg, #7f1d1d, #991b1b)'
            : 'linear-gradient(135deg, #14532d, #166534)'
          : 'linear-gradient(135deg, #78350f, #92400e)',
        border: coffre.revele
          ? coffre.estAlarme ? '2px solid #ef4444' : '2px solid #22c55e'
          : '2px solid #d97706',
        cursor: clickable ? 'pointer' : 'default',
        opacity: coffre.revele ? 0.9 : 1,
      }}
    >
      <AnimatePresence mode="wait">
        {!coffre.revele ? (
          <motion.span
            key="closed"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="text-2xl"
          >
            📦
          </motion.span>
        ) : (
          <motion.div
            key="open"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="flex flex-col items-center gap-1"
          >
            <span className="text-xl">
              {coffre.estAlarme ? '🚨' : '💰'}
            </span>
            {!coffre.estAlarme && (
              <span className="text-xs text-green-300 font-bold leading-tight">
                +{coffre.valeur.toLocaleString('fr-FR')}
              </span>
            )}
            {coffre.estAlarme && (
              <span className="text-xs text-red-300 font-bold">ALARME</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
