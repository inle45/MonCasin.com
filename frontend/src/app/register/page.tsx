'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setLoading(true);
    try {
      await register(email, pseudo, password);
      toast.success('Compte créé ! 10 000 F€ offerts pour commencer 🎁');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-casino-dark p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-7xl mb-3">🎰</div>
          <h1 className="text-3xl font-bold text-gradient-gold">MonCasin.com</h1>
          <p className="text-gray-400 mt-2">Rejoins le casino fictif !</p>
        </div>

        <div className="casino-card p-8">
          <h2 className="text-xl font-semibold text-white mb-2">Créer un compte</h2>
          <p className="text-casino-gold text-sm mb-6">🎁 10 000 F€ offerts à l&apos;inscription</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Pseudo</label>
              <input
                type="text"
                value={pseudo}
                onChange={e => setPseudo(e.target.value)}
                className="w-full bg-casino-darker border border-casino-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-casino-gold transition-colors"
                placeholder="TonPseudo"
                required
                minLength={2}
                maxLength={20}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-casino-darker border border-casino-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-casino-gold transition-colors"
                placeholder="ton@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-casino-darker border border-casino-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-casino-gold transition-colors"
                placeholder="6 caractères minimum"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-casino-gold hover:bg-casino-gold-light disabled:opacity-50 text-black font-bold py-3 rounded-lg transition-colors mt-2"
            >
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-center text-gray-400 mt-6 text-sm">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-casino-gold hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
