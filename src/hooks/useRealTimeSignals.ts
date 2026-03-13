import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, isBackendAvailable } from '@/services/apiClient';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useEffect, useRef } from 'react';
import { TradeSignal } from '@/types/trading';

interface UseRealTimeSignalsOptions {
  symbol?: string;
  limit?: number;
}

// Generate a realistic-looking mock signal for local testing
const generateLocalMockSignal = (symbol?: string): TradeSignal => {
  const pairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'AVAXUSDT'];
  const p = symbol || pairs[Math.floor(Math.random() * pairs.length)];
  const type = Math.random() > 0.5 ? 'long' : 'short';
  const entry = p === 'BTCUSDT' ? 65000 + Math.random() * 5000 : 
               p === 'ETHUSDT' ? 3200 + Math.random() * 400 : 
               p === 'SOLUSDT' ? 140 + Math.random() * 20 : 100 * Math.random();
  
  const tpOffset = entry * 0.02;
  const slOffset = entry * 0.01;
  const tp = type === 'long' ? entry + tpOffset : entry - tpOffset;
  const sl = type === 'long' ? entry - slOffset : entry + slOffset;

  return {
    id: `signal-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    pair: p,
    type,
    entry,
    takeProfit: tp,
    stopLoss: sl,
    timeframe: '5m',
    status: 'active',
    indicators: ['RSI', 'MACD', 'EMA'],
    quality: {
      score: 65 + Math.floor(Math.random() * 30),
      factors: ['Momentum forte', 'Volume subindo'],
      warnings: []
    },
    riskReward: 2.0,
    confidence: 70 + Math.floor(Math.random() * 25),
    createdAt: new Date().toISOString()
  };
};

export const useRealTimeSignals = (options: UseRealTimeSignalsOptions = {}) => {
  const { symbol, limit = 50 } = options;
  const queryClient = useQueryClient();
  const { on, off, isConnected, subscribe } = useWebSocket();
  const localGenRef = useRef<NodeJS.Timeout>();

  const { data: signals = [], isLoading, error } = useQuery<TradeSignal[]>({
    queryKey: ['real-time-signals'],
    queryFn: async () => {
      if (!isBackendAvailable) {
        // Se não tiver backend, começamos com 3 sinais mockados
        return Array.from({ length: 3 }).map(() => generateLocalMockSignal(symbol));
      }
      const { data } = await apiClient.get<TradeSignal[]>('/signals', {
        params: { limit },
      });
      return data;
    },
    staleTime: Infinity,
  });

  // Socket effect para quando TIVER backend
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

  // Intervalo local mockado para quando NÃO TIVER backend
  useEffect(() => {
    if (isBackendAvailable) return;
    
    // Gerar um sinal a cada 20 segundos para o Dashboard parecer Vivo
    localGenRef.current = setInterval(() => {
      const newSignal = generateLocalMockSignal(symbol);
      queryClient.setQueryData<TradeSignal[]>(['real-time-signals'], (oldSignals) => {
        const current = oldSignals || [];
        return [newSignal, ...current].slice(0, 50);
      });
    }, 20000);

    return () => {
      if (localGenRef.current) clearInterval(localGenRef.current);
    };
  }, [symbol, queryClient]);

  const filteredSignals = signals.filter(s => {
    if (symbol && s.pair !== symbol) return false;
    return true;
  });

  return { data: filteredSignals, isLoading: isLoading && isBackendAvailable, error };
};
