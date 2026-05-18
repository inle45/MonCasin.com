/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        casino: {
          dark: '#0a0a0f',
          darker: '#050508',
          card: '#12121f',
          border: '#1e1e35',
          gold: '#f59e0b',
          'gold-light': '#fbbf24',
          green: '#10b981',
          red: '#ef4444',
          purple: '#8b5cf6',
          blue: '#3b82f6',
        },
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'reel-spin': 'reelSpin 0.5s ease-out',
        'crash-line': 'crashLine 0.1s linear',
        'rainbow': 'rainbow 3s linear infinite',
      },
      keyframes: {
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 5px #f59e0b' },
          '50%': { boxShadow: '0 0 20px #f59e0b, 0 0 40px #f59e0b' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        rainbow: {
          '0%': { color: '#ef4444' },
          '16%': { color: '#f97316' },
          '33%': { color: '#eab308' },
          '50%': { color: '#22c55e' },
          '66%': { color: '#3b82f6' },
          '83%': { color: '#8b5cf6' },
          '100%': { color: '#ef4444' },
        },
      },
      backgroundImage: {
        'casino-gradient': 'linear-gradient(135deg, #0a0a0f 0%, #12121f 50%, #0a0a0f 100%)',
        'gold-gradient': 'linear-gradient(135deg, #f59e0b, #fbbf24, #f59e0b)',
        'card-gradient': 'linear-gradient(145deg, #12121f, #1a1a2e)',
      },
    },
  },
  plugins: [],
};
