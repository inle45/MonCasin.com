'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import api from '@/lib/api';

const CATALOGUE: Record<string, {
  emoji: string; name: string; description: string;
  couleur: string; bgCouleur: string; isConsumable: boolean;
}> = {
  TICKET_ROUE:       { emoji: '🎡', name: 'Ticket Roue de la Fortune', description: 'Lance la Roue de la Fortune gratuitement',         couleur: '#f59e0b', bgCouleur: '#78350f', isConsumable: true  },
  PASS_FREE_SPINS:   { emoji: '🎰', name: 'Pass Free Spins',           description: '10 tours gratuits sur Vegas Evolution',            couleur: '#3b82f6', bgCouleur: '#1e3a8a', isConsumable: true  },
  ASSURANCE_CRASH:   { emoji: '🛡️', name: 'Assurance Crash',           description: 'Rembourse 50% de ta mise si tu crash',            couleur: '#10b981', bgCouleur: '#064e3b', isConsumable: true  },
  FUMIGENE_ROULETTE: { emoji: '💨', name: 'Fumigène de Roulette',      description: 'Masque tes mises aux autres 15 secondes',          couleur: '#8b5cf6', bgCouleur: '#3b0764', isConsumable: true  },
  CONTRE_RACKET:     { emoji: '⚔️', name: 'Contre-Racket',             description: 'Immunité + punition contre le prochain racket',    couleur: '#ef4444', bgCouleur: '#7f1d1d', isConsumable: true  },
  DOUBLE_DAILY:      { emoji: '⚡', name: 'Double Daily',              description: 'Double ton prochain bonus quotidien',              couleur: '#fbbf24', bgCouleur: '#78350f', isConsumable: true  },
  EMOTE_VIP:         { emoji: '👑', name: 'Émote VIP',                 description: 'Émote exclusive disponible dans le chat',          couleur: '#f59e0b', bgCouleur: '#451a03', isConsumable: false },
  SOUNDBITE:         { emoji: '🔊', name: 'Soundbite Casino',          description: 'Déclenche un son chez tout le monde en chat',      couleur: '#06b6d4', bgCouleur: '#0c4a6e', isConsumable: false },
};

interface InventoryItem {
  id: string;
  type: string;
  quantity: number;
  isConsumable: boolean;
  usedAt: string | null;
  createdAt: string;
  meta?: typeof CATALOGUE[string];
}

const RARITY: Record<string, string> = {
  TICKET_ROUE: 'Commun', PASS_FREE_SPINS: 'Commun', DOUBLE_DAILY: 'Commun',
  EMOTE_VIP: 'Rare', SOUNDBITE: 'Rare',
  ASSURANCE_CRASH: 'Épique', FUMIGENE_ROULETTE: 'Épique', CONTRE_RACKET: 'Légendaire',
};
const RARITY_COLOR: Record<string, string> = {
  Commun: '#9ca3af', Rare: '#3b82f6', Épique: '#8b5cf6', Légendaire: '#f59e0b',
};

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [using, setUsing] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ id: string; msg: string } | null>(null);

  const fetchInventory = async () => {
    try {
      const res = await api.get('/inventory');
      setItems(res.data.items);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchInventory(); }, []);

  const handleUse = async (item: InventoryItem) => {
    if (using) return;

    // Redirection pour les tickets
    if (item.type === 'TICKET_ROUE') { router.push('/games/slots'); return; }
    if (item.type === 'PASS_FREE_SPINS') { router.push('/games/slots'); return; }

    if (!item.isConsumable) {
      setFlash({ id: item.id, msg: 'Cet objet est permanent, pas besoin de l\'utiliser !' });
      setTimeout(() => setFlash(null), 3000);
      return;
    }

    setUsing(item.id);
    try {
      const res = await api.post(`/inventory/${item.id}/use`);
      setFlash({ id: item.id, msg: res.data.message });
      setTimeout(() => setFlash(null), 3000);
      await fetchInventory();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erreur';
      setFlash({ id: item.id, msg });
      setTimeout(() => setFlash(null), 3000);
    }
    setUsing(null);
  };

  const grouped = items.reduce<Record<string, InventoryItem[]>>((acc, item) => {
    const rarity = RARITY[item.type] ?? 'Commun';
    if (!acc[rarity]) acc[rarity] = [];
    acc[rarity].push(item);
    return acc;
  }, {});

  const order = ['Légendaire', 'Épique', 'Rare', 'Commun'];

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-10">

        <div className="text-center mb-6">
          <h1 className="text-3xl font-black text-casino-gold">🎒 Mon Inventaire</h1>
          <p className="text-gray-400 text-sm mt-1">
            {items.length === 0 ? 'Aucun objet pour l\'instant — ouvre des coffres !' : `${items.length} objet${items.length > 1 ? 's' : ''} dans ton sac`}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="text-4xl">⚙️</motion.div>
          </div>
        ) : items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="text-6xl mb-4">📦</div>
            <div className="text-gray-400">Lance des spins sur Vegas Evolution<br />et ouvre des coffres pour obtenir des loots !</div>
            <button
              onClick={() => router.push('/games/slots')}
              className="mt-6 px-8 py-3 bg-casino-gold text-black font-black rounded-xl hover:brightness-110 transition-all"
            >
              🎰 Jouer à Vegas Evolution
            </button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-8">
            {order.map(rarity => {
              const group = grouped[rarity];
              if (!group || group.length === 0) return null;
              const rarityColor = RARITY_COLOR[rarity];
              return (
                <div key={rarity}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1" style={{ background: rarityColor + '44' }} />
                    <span className="text-xs font-black tracking-widest px-3 py-1 rounded-full"
                      style={{ color: rarityColor, border: `1px solid ${rarityColor}`, background: `${rarityColor}11` }}>
                      {rarity.toUpperCase()}
                    </span>
                    <div className="h-px flex-1" style={{ background: rarityColor + '44' }} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {group.map(item => {
                      const meta = CATALOGUE[item.type] ?? { emoji: '❓', name: item.type, description: '', couleur: '#6b7280', bgCouleur: '#1f2937', isConsumable: true };
                      const isFlashing = flash?.id === item.id;
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="relative rounded-xl p-4 flex gap-3 items-center overflow-hidden"
                          style={{
                            background: `linear-gradient(135deg, ${meta.bgCouleur} 0%, #0f172a 100%)`,
                            border: `1.5px solid ${meta.couleur}55`,
                            boxShadow: `0 0 20px ${meta.couleur}18`,
                          }}
                        >
                          {/* Icône */}
                          <div
                            className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                            style={{ background: `${meta.couleur}22`, border: `1px solid ${meta.couleur}44` }}
                          >
                            {meta.emoji}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm text-white truncate">{meta.name}</span>
                              {item.quantity > 1 && (
                                <span className="text-xs font-black px-1.5 py-0.5 rounded-full"
                                  style={{ background: meta.couleur, color: '#000' }}>
                                  ×{item.quantity}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5 leading-tight">{meta.description}</p>
                            {!meta.isConsumable && (
                              <span className="text-xs text-gray-500 mt-1 block">✨ Permanent</span>
                            )}
                          </div>

                          {/* Bouton Utiliser */}
                          <motion.button
                            whileTap={{ scale: 0.93 }}
                            onClick={() => handleUse(item)}
                            disabled={using === item.id}
                            className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-black transition-all"
                            style={{
                              background: using === item.id ? 'rgba(100,100,100,0.3)' : `${meta.couleur}`,
                              color: '#000',
                              opacity: using === item.id ? 0.5 : 1,
                            }}
                          >
                            {using === item.id ? '...' : meta.isConsumable ? 'Utiliser' : 'Équipé'}
                          </motion.button>

                          {/* Flash message */}
                          <AnimatePresence>
                            {isFlashing && flash && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 rounded-xl flex items-center justify-center text-center text-xs font-bold px-4"
                                style={{ background: `${meta.bgCouleur}ee`, color: meta.couleur }}
                              >
                                {flash.msg}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
