import { useQuery } from '@tanstack/react-query';
import { TradeSignal } from '@/types/trading';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
const SIGNALS_URL = `${API_BASE}/api/signals`;

interface UseRealTimeSignalsOptions {
  symbol?: string;
  limit?: number;
}

// Map backend signal shape → TradeSignal (backend uses camelCase already)
const mapBackendSignal = (raw: any): TradeSignal => ({
  id: raw.id,
  pair: raw.pair,
  type: raw.type,
  entry: raw.entry,
  takeProfit: raw.takeProfit ?? raw.take_profit,
  takeProfit1: raw.takeProfit1 ?? raw.take_profit_1 ?? undefined,
  takeProfit2: raw.takeProfit2 ?? raw.take_profit_2 ?? undefined,
  takeProfit3: raw.takeProfit3 ?? raw.take_profit_3 ?? undefined,
  stopLoss: raw.stopLoss ?? raw.stop_loss,
  riskReward: raw.riskReward ?? raw.risk_reward,
  timeframe: raw.timeframe,
  status: raw.status,
  confidence: raw.confidence,
  indicators: Array.isArray(raw.indicators) ? raw.indicators : [],
  quality: raw.quality ?? undefined,
  mlData: raw.mlData ?? raw.ml_data ?? undefined,
  createdAt: new Date(raw.createdAt ?? raw.created_at),
});

export const useRealTimeSignals = (options: UseRealTimeSignalsOptions = {}) => {
  const { symbol, limit = 50 } = options;

  const { data: signals = [], isLoading, error } = useQuery<TradeSignal[]>({
    queryKey: ['real-time-signals', symbol ?? 'all', limit],
    queryFn: async ({ signal: abortSignal }) => {
      if (!API_BASE) {
        console.warn('[useRealTimeSignals] VITE_API_URL not configured');
        return [];
      }

      try {
        const res = await fetch(`${SIGNALS_URL}?limit=${limit}`, {
          signal: abortSignal,
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          console.warn(`[useRealTimeSignals] Backend returned ${res.status}`);
          return [];
        }

        const data = await res.json();
        return Array.isArray(data) ? data.map(mapBackendSignal) : [];
      } catch (err: any) {
        // Don't log AbortError — those are from React Query unmounts
        if (err?.name !== 'AbortError') {
          console.warn('[useRealTimeSignals] Failed to fetch signals:', err?.message);
        }
        return [];
      }
    },
    staleTime: 25_000,
    refetchInterval: 30_000, // Poll backend every 30s
    retry: false,             // Don't retry on failure (avoids loops)
  });

  const filteredSignals = Array.isArray(signals)
    ? signals.filter(s => !symbol || s.pair === symbol)
    : [];

  return { data: filteredSignals, isLoading, error };
};
