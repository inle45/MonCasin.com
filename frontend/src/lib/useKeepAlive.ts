import { useEffect } from 'react';

export function useKeepAlive(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const ping = () =>
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ping`).catch(() => {});
    const interval = setInterval(ping, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [active]);
}
