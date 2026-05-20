import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { Toaster } from 'react-hot-toast';
import KeepAlive from '@/components/ui/KeepAlive';
import LiveFeed from '@/components/ui/LiveFeed';
import HappyHourBanner from '@/components/ui/HappyHourBanner';
import FloatingChat from '@/components/ui/FloatingChat';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MonCasin.com - Casino en ligne fictif',
  description: 'Casino en ligne multijoueur avec Euro Fictif (F€)',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MonCasin',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'theme-color': '#f59e0b',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('casino_theme') || 'gold';
            if (t !== 'gold') document.documentElement.setAttribute('data-theme', t);
          } catch(e) {}
        `}} />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <SocketProvider>
            <KeepAlive />
            <HappyHourBanner />
            <LiveFeed />
            <FloatingChat />
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: '#12121f',
                  color: '#fff',
                  border: '1px solid #1e1e35',
                },
                success: {
                  iconTheme: { primary: '#f59e0b', secondary: '#12121f' },
                },
                error: {
                  iconTheme: { primary: '#ef4444', secondary: '#12121f' },
                },
              }}
            />
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
