'use client';

import Navbar from '@/components/layout/Navbar';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Weather { emoji: string; name: string; desc: string; changedAt: string; }

function getNextHappyHour() {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  const targets: [number, number][] = [[5, 19], [6, 19]];
  let best: Date | null = null;
  for (const [d, h] of targets) {
    const next = new Date(now);
    let daysAhead = d - day;
    if (daysAhead < 0 || (daysAhead === 0 && hour >= 23)) daysAhead += 7;
    next.setUTCDate(next.getUTCDate() + daysAhead);
    next.setUTCHours(h, 0, 0, 0);
    if (!best || next < best) best = next;
  }
  return best;
}

const RECURRING = [
  { emoji: '🌙', name: 'Happy Hour', freq: 'Vendredi & Samedi 19h–23h UTC', desc: '+50% sur tous les gains', color: '#f97316' },
  { emoji: '🏆', name: 'Wager Race', freq: 'Classement hebdomadaire, payout lundi', desc: 'Top 3 du volume misé remporte des F€', color: '#f59e0b' },
  { emoji: '⚔️', name: 'Tournoi Profit', freq: 'Hebdomadaire, fin dimanche soir', desc: '5% du volume distribué au top 3', color: '#8b5cf6' },
  { emoji: '🎫', name: 'Loterie', freq: 'Tirage quotidien à minuit UTC', desc: '1 ticket = 1 chance de gagner la cagnotte', color: '#3b82f6' },
  { emoji: '⚡', name: 'Défi du Jour', freq: 'Renouvelé chaque jour à 00h UTC', desc: 'Premier à réussir emporte la récompense', color: '#22c55e' },
  { emoji: '🌤️', name: 'Météo des Gains', freq: 'Change toutes les heures', desc: 'Bonus aléatoire sur les gains', color: '#06b6d4' },
];

export default function EventsPage() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [nextHH, setNextHH] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    api.get('/weather').then(r => setWeather(r.data)).catch(() => {});
    setNextHH(getNextHappyHour());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const isHH = () => { const d = now.getUTCDay(); const h = now.getUTCHours(); return (d === 5 || d === 6) && h >= 19 && h < 23; };

  function countdown(target: Date) {
    const diff = Math.max(0, target.getTime() - now.getTime());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
  }

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-10 flex flex-col gap-5">

        <div className="text-center mb-2">
          <h1 className="text-3xl font-black text-casino-gold">📅 Événements</h1>
          <p className="text-gray-400 text-sm mt-1">Tout ce qui se passe sur MonCasin.com</p>
        </div>

        {/* Météo actuelle */}
        {weather && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5"
            style={{ background: 'linear-gradient(135deg,rgba(6,182,212,0.1),rgba(6,182,212,0.04))', border: '1px solid rgba(6,182,212,0.3)' }}>
            <div className="flex items-center gap-3">
              <span className="text-4xl">{weather.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-white">{weather.name}</span>
                  <span className="text-xs text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full">EN COURS</span>
                </div>
                <div className="text-gray-300 text-sm">{weather.desc}</div>
              </div>
              <div className="text-xs text-gray-500">change dans<br />
                <span className="text-cyan-400 font-bold">{countdown(new Date(new Date(weather.changedAt).getTime() + 3600000))}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Happy Hour */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl p-5"
          style={{ background: isHH() ? 'linear-gradient(135deg,rgba(249,115,22,0.2),rgba(249,115,22,0.08))' : 'rgba(30,27,75,0.5)', border: `1px solid ${isHH() ? 'rgba(249,115,22,0.5)' : 'rgba(249,115,22,0.15)'}` }}>
          <div className="flex items-center gap-3">
            <span className="text-4xl">🌙</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-white">Happy Hour</span>
                {isHH()
                  ? <span className="text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full animate-pulse">🔴 LIVE</span>
                  : <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">Ven & Sam 19h-23h UTC</span>}
              </div>
              <div className="text-gray-300 text-sm">+50% sur tous les gains des jeux solo</div>
            </div>
            {!isHH() && nextHH && (
              <div className="text-xs text-gray-500 text-right">dans<br />
                <span className="text-orange-400 font-bold">{countdown(nextHH)}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Événements récurrents */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Récurrents</h2>
          <div className="flex flex-col gap-3">
            {RECURRING.filter(e => e.name !== 'Happy Hour' && e.name !== 'Météo des Gains').map((e, i) => (
              <motion.div key={e.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-center gap-4 rounded-xl p-4"
                style={{ background: 'rgba(30,27,75,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-3xl">{e.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white">{e.name}</div>
                  <div className="text-xs text-gray-500">{e.freq}</div>
                  <div className="text-gray-300 text-sm mt-0.5">{e.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
