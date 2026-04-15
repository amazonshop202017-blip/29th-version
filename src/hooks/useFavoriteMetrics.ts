import { useState, useCallback, useEffect } from 'react';
import { ChartDisplayType } from '@/hooks/useChartDisplayMode';

const BASE_KEY = 'favorite-metrics';

const getCurrentUserId = (): string | undefined => {
  try {
    const session = localStorage.getItem('auth_session');
    if (session) return JSON.parse(session).userId;
  } catch {}
  return undefined;
};

const getStorageKey = () => {
  const userId = getCurrentUserId();
  return userId ? `${BASE_KEY}-${userId}` : BASE_KEY;
};

const getStoredFavorites = (): ChartDisplayType[] => {
  try {
    const stored = localStorage.getItem(getStorageKey());
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveFavorites = (favorites: ChartDisplayType[]) => {
  localStorage.setItem(getStorageKey(), JSON.stringify(favorites));
};

// Simple event-based sync across hook instances
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const useFavoriteMetrics = () => {
  const [favorites, setFavorites] = useState<ChartDisplayType[]>(getStoredFavorites);

  // Listen for changes from other instances
  useEffect(() => {
    const handler = () => setFavorites(getStoredFavorites());
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const toggleFavorite = useCallback((metric: ChartDisplayType) => {
    setFavorites((prev) => {
      const next = prev.includes(metric)
        ? prev.filter((m) => m !== metric)
        : [...prev, metric];
      saveFavorites(next);
      // Notify other instances
      setTimeout(notify, 0);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (metric: ChartDisplayType) => favorites.includes(metric),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite };
};
