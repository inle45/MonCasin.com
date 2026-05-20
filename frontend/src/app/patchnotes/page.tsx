'use client';

import Navbar from '@/components/layout/Navbar';
import { motion } from 'framer-motion';

const UPDATES = [
  {
    version: 'v2.5.0',
    date: '20 Mai 2026',
    emoji: '🚀',
    title: 'Grande mise à jour sociale',
    changes: [
      { type: 'new', text: 'Roue de la Richesse — nouveau jeu avec 12 segments jusqu\'à ×50' },
      { type: 'new', text: 'Baccarat — joueur vs banquier avec règles officielles' },
      { type: 'new', text: 'Courses Hippiques — 6 chevaux avec cotes dynamiques et animation de course' },
      { type: 'new', text: 'Météo des gains — événement horaire qui booste aléatoirement les gains' },
      { type: 'new', text: 'Musique d\'ambiance — 3 streams radio en direct (Jazz, Lo-Fi, Electro)' },
      { type: 'new', text: 'Carte de visite — page publique /u/pseudo partageable' },
      { type: 'new', text: 'Calendrier des événements — tous les événements récurrents en un coup d\'œil' },
      { type: 'new', text: 'Arbre de compétences — avantages permanents selon votre niveau' },
      { type: 'new', text: 'Roue de la honte — après 5 défaites consécutives, une punition vous attend' },
      { type: 'new', text: 'Effets visuels de table — 4 thèmes achetables en boutique' },
    ],
  },
  {
    version: 'v2.4.0',
    date: '20 Mai 2026',
    emoji: '🎨',
    title: 'Chat flottant & Thèmes',
    changes: [
      { type: 'new', text: 'Chat flottant — bulle de chat accessible depuis tous les jeux' },
      { type: 'new', text: 'Skeleton loading — animation de chargement sur dashboard et stats' },
      { type: 'new', text: '4 thèmes de couleurs — Or, Violet, Bleu, Rouge (page Profil)' },
      { type: 'new', text: 'Classements par jeu — meilleur Crash, volume misé, plus gros gain' },
    ],
  },
  {
    version: 'v2.3.0',
    date: '20 Mai 2026',
    emoji: '🔧',
    title: 'Bugs critiques & Social',
    changes: [
      { type: 'fix', text: 'Chat — messages persistants après rafraîchissement de page' },
      { type: 'fix', text: 'Avatars — photo de profil ne disparaît plus au refresh' },
      { type: 'new', text: 'Crash — décompte animé avec anneau SVG qui se vide' },
      { type: 'new', text: 'Mentions @pseudo dans le chat avec auto-complétion Tab' },
      { type: 'new', text: 'Titres selon le niveau affichés dans le chat et profils' },
      { type: 'new', text: 'Mur d\'activité sur les profils publics' },
    ],
  },
  {
    version: 'v2.2.0',
    date: '20 Mai 2026',
    emoji: '⭐',
    title: 'Big Win & Provably Fair',
    changes: [
      { type: 'new', text: 'Big Win overlay sur Dice, Limbo et Plinko (≥5x mise)' },
      { type: 'new', text: 'Crash Provably Fair — HMAC-SHA256, vérifiable par les joueurs' },
      { type: 'new', text: 'Graphique de profit 30 jours sur la page Stats' },
    ],
  },
  {
    version: 'v2.1.0',
    date: '19 Mai 2026',
    emoji: '🎮',
    title: 'Auto-bet & Landing page',
    changes: [
      { type: 'new', text: 'Landing page publique avec présentation du site' },
      { type: 'new', text: 'Auto-bet sur Dice, Limbo et Plinko (jusqu\'à 100 paris)' },
      { type: 'new', text: 'Tournoi hebdomadaire — payout automatique chaque lundi' },
    ],
  },
  {
    version: 'v2.0.0',
    date: '19 Mai 2026',
    emoji: '🐛',
    title: 'Corrections majeures',
    changes: [
      { type: 'fix', text: 'API /users/me/transactions manquante — graphique fortune réparé' },
      { type: 'fix', text: 'Happy Hour appliquée sur tous les jeux (pas seulement Blackjack)' },
      { type: 'fix', text: 'Achievements — clés corrigées, les succès se débloquent enfin' },
      { type: 'fix', text: 'Dashboard — 9 jeux affichés en grille au lieu de 4 en liste' },
    ],
  },
];

const TYPE_STYLES: Record<string, string> = {
  new: 'bg-green-500/10 text-green-400 border-green-500/20',
  fix: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  improvement: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};
const TYPE_LABELS: Record<string, string> = { new: 'NOUVEAU', fix: 'CORRIGÉ', improvement: 'AMÉLIORÉ' };

export default function PatchNotesPage() {
  return (
    <div className="min-h-screen bg-casino-dark text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-casino-gold">📋 Patch Notes</h1>
          <p className="text-gray-400 text-sm mt-1">Toutes les mises à jour de MonCasin.com</p>
        </div>

        <div className="flex flex-col gap-6">
          {UPDATES.map((update, ui) => (
            <motion.div
              key={update.version}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ui * 0.08 }}
              className="casino-card overflow-hidden"
            >
              <div className="px-5 py-4 flex items-center gap-3 border-b border-white/5"
                style={{ background: 'rgba(245,158,11,0.04)' }}>
                <span className="text-2xl">{update.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-casino-gold">{update.version}</span>
                    <span className="text-xs text-gray-500">{update.date}</span>
                  </div>
                  <div className="font-bold text-white text-sm">{update.title}</div>
                </div>
              </div>
              <div className="px-5 py-3 flex flex-col gap-2">
                {update.changes.map((c, ci) => (
                  <div key={ci} className="flex items-start gap-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold border flex-shrink-0 mt-0.5 ${TYPE_STYLES[c.type]}`}>
                      {TYPE_LABELS[c.type]}
                    </span>
                    <span className="text-gray-300 text-sm">{c.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
