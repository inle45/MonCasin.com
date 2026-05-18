'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      router.replace(user ? '/dashboard' : '/login');
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-casino-dark">
      <div className="text-center">
        <div className="text-6xl mb-4">🎰</div>
        <div className="text-casino-gold text-2xl font-bold animate-pulse">MonCasin.com</div>
        <div className="text-gray-400 mt-2">Chargement...</div>
      </div>
    </div>
  );
}
