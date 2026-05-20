'use client';

import { useEffect, useState } from 'react';

const THEMES = [
  { id: 'gold',   label: 'Or',     color: '#f59e0b' },
  { id: 'purple', label: 'Violet', color: '#8b5cf6' },
  { id: 'blue',   label: 'Bleu',   color: '#3b82f6' },
  { id: 'red',    label: 'Rouge',  color: '#ef4444' },
];

export function useTheme() {
  const [theme, setThemeState] = useState('gold');

  useEffect(() => {
    const saved = localStorage.getItem('casino_theme') || 'gold';
    setThemeState(saved);
    document.documentElement.setAttribute('data-theme', saved === 'gold' ? '' : saved);
  }, []);

  const setTheme = (t: string) => {
    setThemeState(t);
    localStorage.setItem('casino_theme', t);
    document.documentElement.setAttribute('data-theme', t === 'gold' ? '' : t);
  };

  return { theme, setTheme };
}

export default function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-gray-400 uppercase tracking-wider">Thème de couleur</span>
      <div className="flex gap-2">
        {THEMES.map(t => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            title={t.label}
            className="relative w-8 h-8 rounded-full transition-all hover:scale-110"
            style={{
              background: t.color,
              boxShadow: theme === t.id ? `0 0 0 3px #fff, 0 0 0 5px ${t.color}` : 'none',
            }}
          >
            {theme === t.id && (
              <span className="absolute inset-0 flex items-center justify-center text-white font-black text-sm">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
