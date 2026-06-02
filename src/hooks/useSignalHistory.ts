import { useQuery } from '@tanstack/react-query';
import { TradeSignal } from '@/types/trading';
import { apiClient } from '@/services/apiClient';

interface UseSignalHistoryOptions {
  page: number;
  limit?: number;
  symbol?: string;
  type?: string;
  status?: string;
  tradeType?: string;
  dateRange?: string;
}

interface PaginatedResponse {
  data: any[];
  stats?: {
    wins: number;
    losses: number;
    active: number;
    winRate: number;
    totalPnl: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Map backend DB rows to TradeSignal interface
const mapBackendSignal = (raw: any): TradeSignal => ({
  id: raw.id,
  signal_number: raw.signal_number ?? raw.signalId ?? raw.number ?? undefined,
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
  indicators: Array.isArray(raw.indicators) ? raw.indicators : (typeof raw.indicators === 'string' ? JSON.parse(raw.indicators) : []),
  quality: raw.quality ?? undefined,
  mlData: raw.mlData ?? raw.ml_data ?? undefined,
  tradeType: raw.tradeType ?? raw.trade_type,
  createdAt: new Date(raw.createdAt ?? raw.created_at),
});

export const useSignalHistory = (options: UseSignalHistoryOptions) => {
  const { page, limit = 50, symbol, type, status, tradeType, dateRange } = options;

  return useQuery<{ signals: TradeSignal[], totalPages: number, total: number, stats?: PaginatedResponse['stats'] }, Error>({
    queryKey: ['signal-history', page, limit, symbol, type, status, tradeType, dateRange],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (symbol && symbol !== 'ALL') params.append('symbol', symbol);
      if (type && type !== 'ALL') params.append('type', type);
      if (status && status !== 'ALL') params.append('status', status);
      if (tradeType && tradeType !== 'ALL') params.append('trade_type', tradeType);
      if (dateRange && dateRange !== 'ALL') params.append('date_range', dateRange);

      const { data } = await apiClient.get<PaginatedResponse>(`/signals/history?${params.toString()}`, {
        signal,
      });

      return {
        signals: Array.isArray(data?.data) ? data.data.map(mapBackendSignal) : [],
        totalPages: data?.pagination?.totalPages || 1,
        total: data?.pagination?.total || 0,
        stats: data?.stats,
      };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData, // keep old data while fetching
  });
};
