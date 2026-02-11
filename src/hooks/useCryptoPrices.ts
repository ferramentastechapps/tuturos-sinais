import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useEffect } from 'react';
import { CryptoPair } from '@/types/trading';

export const useCryptoPrices = () => {
  const queryClient = useQueryClient();
  const { on, off, isConnected, subscribe } = useWebSocket(); // subscribe is returned by useWebSocket, need to ensure I use it if not auto-subscribed

  // 1. Initial fetch via REST
  const { data: prices = [], isLoading, error } = useQuery<CryptoPair[]>({
    queryKey: ['crypto-prices'],
    queryFn: async () => {
      const { data } = await apiClient.get<CryptoPair[]>('/market');
      return data;
    },
    staleTime: Infinity, // Data is updated via WS
  });

  // 2. Real-time updates via WebSocket
  useEffect(() => {
    // Subscribe to prices channel
    if (isConnected) {
      subscribe('prices');
    }

    const handlePriceUpdate = (newPrices: Record<string, number>) => {
      queryClient.setQueryData<CryptoPair[]>(['crypto-prices'], (oldPrices) => {
        if (!oldPrices) return [];
        return oldPrices.map(p => {
          const newPrice = newPrices[p.symbol];
          if (!newPrice) return p;

          // Calculate new 24h change if possible, or just update price
          // For now, simple price update. Backend sends full market data on REST.
          // WS only sends { symbol: price }
          return {
            ...p,
            price: newPrice,
          };
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
