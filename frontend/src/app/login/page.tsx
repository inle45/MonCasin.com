'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Connexion réussie ! Bienvenue au casino 🎰');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-casino-dark p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-7xl mb-3">🎰</div>
          <h1 className="text-3xl font-bold text-gradient-gold">MonCasin.com</h1>
          <p className="text-gray-400 mt-2">Casino en ligne fictif</p>
        </div>

        {/* Formulaire */}
        <div className="casino-card p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Se connecter</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-casino-gold hover:bg-casino-gold-light disabled:opacity-50 text-black font-bold py-3 rounded-lg transition-colors mt-2"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-casino-darker rounded-lg border border-casino-border">
            <p className="text-gray-400 text-sm font-medium mb-2">Comptes de démonstration :</p>
            <p className="text-gray-500 text-xs">Email : inle@moncasin.com</p>
            <p className="text-gray-500 text-xs">Mot de passe : Casino2024!</p>
          </div>

          <p className="text-center text-gray-400 mt-6 text-sm">
            Pas encore de compte ?{' '}
            <Link href="/register" className="text-casino-gold hover:underline">
              S&apos;inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
