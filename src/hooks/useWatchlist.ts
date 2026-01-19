import { useState, useEffect, useCallback } from 'react';
import { WatchlistItem } from '@/types/watchlist';

const STORAGE_KEY = 'crypto-watchlist';

const loadFromStorage = (): WatchlistItem[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((item: WatchlistItem) => ({
        ...item,
        addedAt: new Date(item.addedAt),
      }));
    }
  } catch (error) {
    console.error('Error loading watchlist from storage:', error);
  }
  return [];
};

const saveToStorage = (items: WatchlistItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Error saving watchlist to storage:', error);
  }
};

export const useWatchlist = () => {
  const [items, setItems] = useState<WatchlistItem[]>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(items);
  }, [items]);

  const addToWatchlist = useCallback((symbol: string, name: string, notes?: string, targetPrice?: number) => {
    setItems(prev => {
      const exists = prev.find(item => item.symbol === symbol);
      if (exists) return prev;

      const newItem: WatchlistItem = {
        id: crypto.randomUUID(),
        symbol,
        name,
        addedAt: new Date(),
        notes,
        targetPrice,
        alertEnabled: !!targetPrice,
      };

      return [...prev, newItem];
    });
  }, []);

  const removeFromWatchlist = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateWatchlistItem = useCallback((id: string, updates: Partial<Omit<WatchlistItem, 'id' | 'symbol' | 'name' | 'addedAt'>>) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, ...updates }
          : item
      )
    );
  }, []);

  const isInWatchlist = useCallback((symbol: string) => {
    return items.some(item => item.symbol === symbol);
  }, [items]);

  const toggleAlert = useCallback((id: string) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, alertEnabled: !item.alertEnabled }
          : item
      )
    );
  }, []);

  return {
    items,
    addToWatchlist,
    removeFromWatchlist,
    updateWatchlistItem,
    isInWatchlist,
    toggleAlert,
  };
};
