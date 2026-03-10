import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, isBackendAvailable } from '@/services/apiClient';
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

  const { data: signals = [], isLoading, error } = useQuery<TradeSignal[]>({
    queryKey: ['real-time-signals'],
    queryFn: async () => {
      if (!isBackendAvailable) return [];
      const { data } = await apiClient.get<TradeSignal[]>('/signals', {
        params: { limit },
      });
      return data;
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!isBackendAvailable) return;
    if (isConnected) {
      subscribe('signals');
    }

    const handleNewSignal = (newSignal: TradeSignal) => {
      queryClient.setQueryData<TradeSignal[]>(['real-time-signals'], (oldSignals) => {
        const current = oldSignals || [];
        if (current.some(s => s.id === newSignal.id)) return current;
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

  const filteredSignals = signals.filter(s => {
    if (symbol && s.pair !== symbol) return false;
    return true;
  });

  return { data: filteredSignals, isLoading, error };
};
