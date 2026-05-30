import { useQuery } from '@tanstack/react-query';
import { TradeSignal } from '@/types/trading';
import { apiClient } from '@/services/apiClient';

interface BlockedCoin {
  pair: string;
  totalSignals: number;
  wins: number;
  losses: number;
  winRate: number;
  recentWinRate: number;
  trend: 'improving' | 'stable' | 'worsening';
  promotionProgress: number;
  lastSignal: {
    id: string;
    type: string;
    status: string;
    createdAt: string;
    pnl: number | null;
  };
}

interface BlockedSignalsResponse {
  coins: BlockedCoin[];
  signals: any[];
  stats: {
    total: number;
    pairs: number;
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

export const useBlockedSignals = (page: number, limit: number = 20) => {
  return useQuery<{
    coins: BlockedCoin[];
    signals: TradeSignal[];
    stats: BlockedSignalsResponse['stats'];
    pagination: BlockedSignalsResponse['pagination'];
  }, Error>({
    queryKey: ['blocked-signals', page, limit],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<BlockedSignalsResponse>(`/signals/blocked?page=${page}&limit=${limit}`, {
        signal,
      });

      return {
        coins: data?.coins || [],
        signals: Array.isArray(data?.signals) ? data.signals.map(mapBackendSignal) : [],
        stats: data?.stats || { total: 0, pairs: 0 },
        pagination: data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 },
      };
    },
    refetchInterval: 30_000, // auto-refresh every 30 seconds
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
};
