'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user, isLoading, serverWaking } = useAuth();
  const router = useRouter();
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!isLoading) {
      router.replace(user ? '/dashboard' : '/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-casino-dark">
      <div className="text-center">
        <div className="text-6xl mb-4">🎰</div>
        <div className="text-casino-gold text-2xl font-bold">MonCasin.com</div>
        {serverWaking ? (
          <>
            <div className="text-yellow-400 mt-3 font-bold animate-pulse">Serveur en cours de démarrage{dots}</div>
            <div className="text-gray-500 text-sm mt-1">Ça prend ~30 secondes, patiente un peu</div>
            <div className="mt-4 w-48 mx-auto bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-casino-gold rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </>
        ) : (
          <div className="text-gray-400 mt-2">Chargement{dots}</div>
        )}
      </div>
    </div>
  );
}
