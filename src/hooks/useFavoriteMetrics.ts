import { useState, useCallback, useEffect } from 'react';
import { ChartDisplayType } from '@/hooks/useChartDisplayMode';
import { useAuth } from '@/contexts/AuthContext';

// Simple event-based sync across hook instances
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const useFavoriteMetrics = () => {
  const { getPreferences, updatePreferences, user } = useAuth();

  const [favorites, setFavorites] = useState<ChartDisplayType[]>(() => {
    return (getPreferences().favoriteMetrics as ChartDisplayType[]) || [];
  });

  // Reload when user changes
  useEffect(() => {
    setFavorites((getPreferences().favoriteMetrics as ChartDisplayType[]) || []);
  }, [user, getPreferences]);

  // Listen for changes from other instances
  useEffect(() => {
    const handler = () => {
      setFavorites((getPreferences().favoriteMetrics as ChartDisplayType[]) || []);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, [getPreferences]);

  const toggleFavorite = useCallback((metric: ChartDisplayType) => {
    setFavorites((prev) => {
      const next = prev.includes(metric)
        ? prev.filter((m) => m !== metric)
        : [...prev, metric];
      updatePreferences({ favoriteMetrics: next });
      setTimeout(notify, 0);
      return next;
    });
  }, [updatePreferences]);

  const isFavorite = useCallback(
    (metric: ChartDisplayType) => favorites.includes(metric),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite };
};
