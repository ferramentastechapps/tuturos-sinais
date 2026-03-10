import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, isBackendAvailable } from '@/services/apiClient';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useEffect } from 'react';
import { CryptoPair } from '@/types/trading';
import { fetchCryptoPrices } from '@/services/coingecko';

export const useCryptoPrices = () => {
  const queryClient = useQueryClient();
  const { on, off, isConnected, subscribe } = useWebSocket();

  // 1. Initial fetch — backend if available, otherwise CoinGecko
  const { data: prices = [], isLoading, error } = useQuery<CryptoPair[]>({
    queryKey: ['crypto-prices'],
    queryFn: async () => {
      if (isBackendAvailable) {
        const { data } = await apiClient.get<CryptoPair[]>('/market');
        return data;
      }
      // Fallback to CoinGecko
      return fetchCryptoPrices();
    },
    staleTime: isBackendAvailable ? Infinity : 60_000, // Refresh every 60s when using CoinGecko
    refetchInterval: isBackendAvailable ? false : 60_000,
    retry: 2,
  });

  // 2. Real-time updates via WebSocket (only when backend is available)
  useEffect(() => {
    if (!isBackendAvailable) return;

    if (isConnected) {
      subscribe('prices');
    }

    const handlePriceUpdate = (newPrices: Record<string, number>) => {
      queryClient.setQueryData<CryptoPair[]>(['crypto-prices'], (oldPrices) => {
        if (!oldPrices) return [];
        return oldPrices.map(p => {
          const newPrice = newPrices[p.symbol];
          if (!newPrice) return p;
          return { ...p, price: newPrice };
        });
      });
    };

    if (isConnected) {
      on('prices', handlePriceUpdate);
    }

    return () => {
      off('prices', handlePriceUpdate);
    };
  }, [isConnected, on, off, queryClient, subscribe]);

  return { data: prices, isLoading, error };
};

export const useCurrentPrice = (symbol: string) => {
  const { data: prices } = useCryptoPrices();
  return prices?.find(p => p.symbol === symbol)?.price;
};
