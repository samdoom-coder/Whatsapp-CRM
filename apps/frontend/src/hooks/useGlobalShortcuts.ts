import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Global keyboard shortcuts: g then key to navigate
export function useGlobalShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    let pending: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handler = (e: KeyboardEvent) => {
      // Skip when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (pending) {
        const g = pending;
        pending = null;
        if (timer) clearTimeout(timer);
        if (g === 'g') {
          const map: Record<string, string> = {
            i: '/inbox',
            c: '/contacts',
            d: '/deals',
            l: '/leads',
            t: '/tasks',
            a: '/analytics',
            s: '/settings',
            e: '/templates',
            o: '/automations',
          };
          if (map[e.key]) navigate(map[e.key]);
        }
        return;
      }

      if (e.key === 'g') {
        pending = 'g';
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          pending = null;
        }, 800);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
}