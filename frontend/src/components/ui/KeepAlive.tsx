'use client';

import { useAuth } from '@/context/AuthContext';
import { useKeepAlive } from '@/lib/useKeepAlive';

export default function KeepAlive() {
  const { user } = useAuth();
  useKeepAlive(!!user);
  return null;
}
