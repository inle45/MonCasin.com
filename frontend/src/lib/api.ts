import axios from 'axios';

const PROD_URL = 'https://moncasin-backend.onrender.com';
const DEV_URL = 'http://localhost:3001';

function getApiUrl() {
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost' ? DEV_URL : PROD_URL;
  }
  return process.env.NEXT_PUBLIC_API_URL || DEV_URL;
}

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('casino_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('casino_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export const formatBalance = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount) + ' F€';
};

export const formatMultiplier = (m: number): string => `${m.toFixed(2)}x`;

// Convertit les URLs d'avatar pour qu'elles soient toujours accessibles
export const getAvatarUrl = (avatar?: string | null): string => {
  if (!avatar) return '/avatars/default-1.svg';
  // Anciens avatars backend .png → frontend .svg
  if (avatar.match(/\/api\/avatars\/default-(\d)\.png/)) {
    const idx = avatar.match(/default-(\d)/)?.[1] || '1';
    return `/avatars/default-${idx}.svg`;
  }
  // Avatars uploadés par l'utilisateur → préfixer avec l'URL backend
  if (avatar.startsWith('/api/uploads/')) {
    return `${API_URL}${avatar}`;
  }
  return avatar;
};
