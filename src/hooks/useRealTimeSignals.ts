import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useEffect } from 'react';
import { TradeSignal } from '@/types/trading';

interface UseRealTimeSignalsOptions {
  symbol?: string;
  limit?: number;
}

export const useRealTimeSignals = (options: UseRealTimeSignalsOptions = {}) => {
  const { symbol, limit = 50 } = options;
  const queryClient = useQueryClient();
  const { on, off, isConnected, subscribe } = useWebSocket();

  // 1. Initial fetch via REST
  const { data: signals = [], isLoading, error } = useQuery<TradeSignal[]>({
    queryKey: ['real-time-signals'],
    queryFn: async () => {
      const { data } = await apiClient.get<TradeSignal[]>('/signals', {
        params: { limit },
      });
      return data;
    },
    staleTime: Infinity, // Managed by WS
  });

  // 2. Real-time updates via WebSocket
  useEffect(() => {
    if (isConnected) {
      subscribe('signals');
    }

    const handleNewSignal = (newSignal: TradeSignal) => {
      queryClient.setQueryData<TradeSignal[]>(['real-time-signals'], (oldSignals) => {
        const current = oldSignals || [];
        // Prevent duplicates
        if (current.some(s => s.id === newSignal.id)) return current;
        // Add new signal to top
        return [newSignal, ...current].slice(0, 50);
      });
    };

    if (isConnected) {
      on('signals', handleNewSignal);
    }

    return () => {
      off('signals', handleNewSignal);
    };
  }, [isConnected, on, off, queryClient, subscribe]);

  // Filter signals if options provided (client-side filtering for simplicity, though API supports some)
  const filteredSignals = signals.filter(s => {
    if (symbol && s.pair !== symbol) return false;
    return true;
  });

  return { data: filteredSignals, isLoading, error };
};
