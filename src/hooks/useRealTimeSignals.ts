import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { TradeSignal } from '@/types/trading';

interface UseRealTimeSignalsOptions {
  symbol?: string;
  limit?: number;
}

// Map Supabase row to TradeSignal
const mapRowToSignal = (row: any): TradeSignal => ({
  id: row.id,
  pair: row.pair,
  type: row.type,
  entry: row.entry,
  takeProfit: row.take_profit,
  takeProfit1: row.take_profit_1 || undefined,
  takeProfit2: row.take_profit_2 || undefined,
  takeProfit3: row.take_profit_3 || undefined,
  stopLoss: row.stop_loss,
  riskReward: row.risk_reward,
  timeframe: row.timeframe,
  status: row.status,
  confidence: row.confidence,
  indicators: Array.isArray(row.indicators) ? row.indicators : [],
  quality: row.quality || undefined,
  mlData: row.ml_data || undefined,
  createdAt: new Date(row.created_at),
});

export const useRealTimeSignals = (options: UseRealTimeSignalsOptions = {}) => {
  const { symbol, limit = 50 } = options;
  const queryClient = useQueryClient();

  const { data: signals = [], isLoading, error } = useQuery<TradeSignal[]>({
    queryKey: ['real-time-signals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_signals' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[useRealTimeSignals] Error fetching signals:', error);
        return [];
      }

      return (Array.isArray(data) ? data : []).map(mapRowToSignal);
    },
    staleTime: 30_000, // 30s
    refetchInterval: 60_000, // Refetch every 60s as fallback
  });

  // Realtime subscription for new signals
  useEffect(() => {
    const channel = supabase
      .channel('trade-signals-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trade_signals',
        },
        (payload) => {
          const newSignal = mapRowToSignal(payload.new);
          queryClient.setQueryData<TradeSignal[]>(['real-time-signals'], (old) => {
            const current = old || [];
            if (current.some(s => s.id === newSignal.id)) return current;
            return [newSignal, ...current].slice(0, 50);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trade_signals',
        },
        (payload) => {
          const updated = mapRowToSignal(payload.new);
          queryClient.setQueryData<TradeSignal[]>(['real-time-signals'], (old) => {
            if (!old) return [updated];
            return old.map(s => s.id === updated.id ? updated : s);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredSignals = Array.isArray(signals) ? signals.filter(s => {
    if (symbol && s.pair !== symbol) return false;
    return true;
  }) : [];

  return { data: filteredSignals, isLoading, error };
};
