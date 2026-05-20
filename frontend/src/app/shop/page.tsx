'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/layout/Navbar';
import { formatBalance } from '@/lib/api';
import { ShopItem } from '@/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { ShoppingBag, Check } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  GRADE: '🏅 Grades VIP',
  AVATAR_BORDER: '🖼️ Bordures d\'avatar',
  PSEUDO_COLOR: '🎨 Couleurs de pseudo',
};

const BORDER_PREVIEWS: Record<string, string> = {
  flame: 'border-flame',
  neon: 'border-neon',
  diamond: 'border-diamond',
};

export default function ShopPage() {
  const { user, updateUser, isLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [purchases, setPurchases] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'GRADE' | 'AVATAR_BORDER' | 'PSEUDO_COLOR'>('GRADE');

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get('/shop/items'),
      api.get('/shop/my-purchases'),
    ]).then(([itemsRes, purchasesRes]) => {
      setItems(itemsRes.data.items);
      setPurchases(purchasesRes.data.purchases.map((p: any) => p.itemId));
    }).finally(() => setLoading(false));
  }, [user]);

  const buy = async (item: ShopItem) => {
    if (buying) return;
    setBuying(item.id);
    try {
      const res = await api.post(`/shop/buy/${item.id}`);
      updateUser(res.data.user);
      setPurchases(prev => [...prev, item.id]);
      toast.success(res.data.message);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'achat');
    } finally {
      setBuying(null);
    }
  };

  const filteredItems = items.filter(i => i.type === activeTab);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-casino-dark">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 pt-20 pb-8">
        {/* En-tête */}
        <div className="casino-card p-6 mb-6 bg-gradient-to-r from-casino-gold/10 to-transparent border-casino-gold/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <ShoppingBag className="text-casino-gold" />
                Boutique VIP
              </h1>
              <p className="text-gray-400 text-sm mt-1">Personnalise ton expérience avec tes F€</p>
            </div>
            <div className="text-right">
              <div className="text-casino-gold text-2xl font-black">{formatBalance(user.balance)}</div>
              <div className="text-gray-400 text-xs">Ton solde</div>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mb-6">
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={clsx(
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                activeTab === key
                  ? 'bg-casino-gold/10 border border-casino-gold/30 text-casino-gold'
                  : 'bg-casino-card border border-casino-border text-gray-400 hover:text-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Articles */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Chargement...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => {
              const owned = purchases.includes(item.id);
              const canAfford = user.balance >= item.price;

              return (
                <div
                  key={item.id}
                  className={clsx(
                    'casino-card p-5 flex flex-col gap-3 transition-transform',
                    owned ? 'border-green-500/30' : canAfford ? 'hover:scale-105' : 'opacity-70'
                  )}
                >
                  {/* Preview */}
                  <div className="flex justify-center">
                    {item.type === 'AVATAR_BORDER' ? (
                      <div className={clsx('w-16 h-16 rounded-full overflow-hidden', BORDER_PREVIEWS[item.value])}>
                        <img src="/avatars/default-1.svg" alt="preview" className="w-full h-full object-cover" />
                      </div>
                    ) : item.type === 'PSEUDO_COLOR' ? (
                      <div
                        className={clsx('text-2xl font-bold', item.value === 'rainbow' && 'animate-rainbow')}
                        style={{ color: item.value !== 'rainbow' ? item.value : undefined }}
                      >
                        PseudoTest
                      </div>
                    ) : (
                      <div className="text-4xl">
                        {item.value === 'SILVER' ? '🥈' :
                         item.value === 'GOLD' ? '🥇' :
                         item.value === 'PLATINUM' ? '💠' : '💎'}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-white">{item.name}</h3>
                    <p className="text-gray-400 text-xs mt-1">{item.description}</p>
                  </div>

                  <div className="mt-auto">
                    <div className="text-casino-gold font-bold mb-2">{formatBalance(item.price)}</div>
                    {owned ? (
                      <div className="flex items-center gap-1 text-green-400 text-sm font-medium">
                        <Check className="w-4 h-4" />
                        Possédé
                      </div>
                    ) : (
                      <button
                        onClick={() => buy(item)}
                        disabled={!canAfford || buying === item.id}
                        className={clsx(
                          'w-full py-2 rounded-lg font-bold text-sm transition-colors',
                          canAfford
                            ? 'bg-casino-gold hover:bg-casino-gold-light text-black'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        )}
                      >
                        {buying === item.id ? 'Achat...' : canAfford ? 'Acheter' : 'Solde insuffisant'}
                      </button>
                    )}
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
