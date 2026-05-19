'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

const GAMES = [
  { icon: '🚀', name: 'Crash', desc: 'Multijoueur temps réel', color: '#10b981', href: '/games/crash' },
  { icon: '🎡', name: 'Roulette', desc: 'Européenne classique', color: '#ef4444', href: '/games/roulette' },
  { icon: '🎰', name: 'Slots', desc: 'Jackpot progressif', color: '#8b5cf6', href: '/games/slots' },
  { icon: '🃏', name: 'Blackjack', desc: 'Battez le croupier', color: '#f59e0b', href: '/games/blackjack' },
  { icon: '💣', name: 'Mines', desc: 'Cashout quand tu veux', color: '#f97316', href: '/games/mines' },
  { icon: '🪙', name: 'Plinko', desc: 'Jusqu\'à ×1000', color: '#ec4899', href: '/games/plinko' },
  { icon: '🎲', name: 'Dice', desc: 'Jusqu\'à ×17', color: '#3b82f6', href: '/games/dice' },
  { icon: '🎴', name: 'Hi-Lo', desc: 'Enchaîne les cartes', color: '#06b6d4', href: '/games/hilo' },
  { icon: '🌙', name: 'Limbo', desc: 'Jusqu\'à ×1 000 000', color: '#6366f1', href: '/games/limbo' },
];

const FEATURES = [
  { icon: '🏆', title: 'Battle Pass', desc: '30 paliers de récompenses mensuels à débloquer' },
  { icon: '📋', title: 'Quêtes quotidiennes', desc: '3 missions renouvelées chaque jour pour gagner des bonus' },
  { icon: '⚔️', title: 'Duels PvP', desc: 'Défie d\'autres joueurs en direct' },
  { icon: '🌧️', title: 'Rain & Transferts', desc: 'Partage tes gains avec la communauté en live' },
  { icon: '🎖️', title: 'Grades & Boutique', desc: 'Débloque des cosmétiques exclusifs avec tes F€' },
  { icon: '💬', title: 'Chat en temps réel', desc: 'Communauté active avec /pay et /rain' },
];

const STATS = [
  { value: '9', label: 'Jeux disponibles' },
  { value: '10 000 F€', label: 'Bonus de bienvenue' },
  { value: '100%', label: 'Gratuit' },
];

export default function Home() {
  const { user, isLoading, serverWaking } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-casino-dark">
        <div className="text-center">
          <div className="text-5xl mb-3">🎰</div>
          <div className="text-casino-gold text-xl font-bold">MonCasin.com</div>
          {serverWaking ? (
            <>
              <div className="text-yellow-400 mt-3 font-bold animate-pulse text-sm">Serveur en cours de démarrage...</div>
              <div className="text-gray-500 text-xs mt-1">~30 secondes</div>
              <div className="mt-3 w-40 mx-auto bg-gray-800 rounded-full h-1 overflow-hidden">
                <div className="h-full bg-casino-gold rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </>
          ) : (
            <div className="text-gray-500 mt-2 text-sm animate-pulse">Chargement...</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-casino-dark text-white overflow-x-hidden">

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎰</span>
          <span className="text-casino-gold font-black text-xl">MonCasin<span className="text-white">.com</span></span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <button className="px-4 py-2 rounded-xl text-sm font-bold text-gray-300 hover:text-white transition-colors">
              Connexion
            </button>
          </Link>
          <Link href="/register">
            <button className="px-5 py-2 rounded-xl text-sm font-black text-black transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg,#d97706,#f59e0b)', boxShadow: '0 0 20px rgba(245,158,11,0.3)' }}>
              Jouer gratuitement
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20">
        {/* Lueurs d'ambiance */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
            style={{ background: 'radial-gradient(circle, #f59e0b, transparent)' }} />
          <div className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full opacity-8 blur-3xl"
            style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
          <div className="absolute bottom-1/4 left-1/2 w-64 h-64 rounded-full opacity-6 blur-3xl"
            style={{ background: 'radial-gradient(circle, #10b981, transparent)' }} />
        </div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="relative z-10">
          <div className="text-7xl mb-4 animate-bounce">🎰</div>
          <h1 className="text-5xl md:text-7xl font-black mb-4 leading-tight">
            <span className="text-white">Mon</span>
            <span className="text-casino-gold">Casin</span>
            <span className="text-white">.com</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-3 max-w-xl mx-auto">
            Le casino multijoueur 100% gratuit en Euro Fictif
          </p>
          <p className="text-gray-500 text-sm mb-10 max-w-md mx-auto">
            9 jeux, chat en temps réel, jackpot progressif, battle pass et bien plus.
            Commence avec <span className="text-casino-gold font-bold">10 000 F€</span> offerts.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
            <Link href="/register">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="px-8 py-4 rounded-2xl text-black font-black text-lg"
                style={{ background: 'linear-gradient(135deg,#b45309,#f59e0b,#b45309)', boxShadow: '0 0 30px rgba(245,158,11,0.5)' }}
              >
                🎮 Jouer maintenant — C'est gratuit
              </motion.button>
            </Link>
            <Link href="/login">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="px-8 py-4 rounded-2xl font-black text-lg"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
              >
                J'ai déjà un compte
              </motion.button>
            </Link>
          </div>

          {/* Stats */}
          <div className="flex gap-8 justify-center flex-wrap">
            {STATS.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="text-center"
              >
                <div className="text-2xl font-black text-casino-gold">{s.value}</div>
                <div className="text-gray-500 text-sm">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Flèche scroll */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-gray-600 text-2xl"
        >
          ↓
        </motion.div>
      </section>

      {/* Jeux */}
      <section className="py-20 px-4 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">9 jeux pour tous les styles</h2>
          <p className="text-gray-400">Du multijoueur en temps réel aux jeux solo à fort multiplicateur</p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
          {GAMES.map((g, i) => (
            <motion.div
              key={g.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.04, y: -4 }}
              className="rounded-2xl p-5 cursor-pointer relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${g.color}15, rgba(18,18,31,0.95))`,
                border: `1px solid ${g.color}30`,
              }}
            >
              <div className="text-4xl mb-3">{g.icon}</div>
              <div className="font-black text-white text-lg">{g.name}</div>
              <div className="text-gray-400 text-sm mt-0.5">{g.desc}</div>
              <div className="absolute top-3 right-3 w-2 h-2 rounded-full animate-pulse" style={{ background: g.color }} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4" style={{ background: 'rgba(18,18,31,0.6)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Plus qu'un casino</h2>
            <p className="text-gray-400">Une vraie plateforme de jeu avec progression, social et récompenses</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl p-5"
                style={{ background: 'linear-gradient(145deg,#12121f,#1a1a2e)', border: '1px solid #1e1e35' }}
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <div className="font-black text-white text-base mb-1">{f.title}</div>
                <div className="text-gray-400 text-sm">{f.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-24 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-lg mx-auto"
        >
          <div className="text-5xl mb-4">🎰</div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Prêt à jouer ?</h2>
          <p className="text-gray-400 mb-8">
            Inscription en 30 secondes. <span className="text-casino-gold font-bold">10 000 F€</span> offerts dès le départ. Aucune carte bancaire requise.
          </p>
          <Link href="/register">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="px-10 py-5 rounded-2xl text-black font-black text-xl"
              style={{ background: 'linear-gradient(135deg,#b45309,#f59e0b,#b45309)', boxShadow: '0 0 40px rgba(245,158,11,0.5)' }}
            >
              Créer mon compte gratuitement
            </motion.button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center border-t border-white/5">
        <div className="text-casino-gold font-black mb-1">🎰 MonCasin.com</div>
        <div className="text-gray-600 text-xs">Plateforme de divertissement utilisant exclusivement de la monnaie fictive (F€). Aucune valeur réelle.</div>
      </footer>
    </div>
  );
}
