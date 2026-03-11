import { useQuery } from '@tanstack/react-query';
import { fetchBybitOHLC, BybitInterval, OHLCPoint } from '@/services/bybitOHLC';

export const useOHLCData = (symbol: string, interval: BybitInterval) => {
  // Determine limit based on interval
  const limit = ['W', 'M'].includes(interval) ? 100 : 200;
  
  // Shorter stale time for smaller intervals
  const staleTimeMap: Record<string, number> = {
    '1': 30_000,      // 30s
    '3': 30_000,
    '5': 60_000,      // 1min
    '15': 2 * 60_000, // 2min
    '30': 3 * 60_000,
    '60': 5 * 60_000,
    '120': 5 * 60_000,
    '240': 10 * 60_000,
    '360': 10 * 60_000,
    '720': 15 * 60_000,
    'D': 30 * 60_000,
    'W': 60 * 60_000,
    'M': 60 * 60_000,
  };

  return useQuery<OHLCPoint[], Error>({
    queryKey: ['ohlc-bybit', symbol, interval],
    queryFn: () => fetchBybitOHLC(symbol, interval, limit),
    staleTime: staleTimeMap[interval] || 5 * 60_000,
    retry: 2,
    enabled: !!symbol,
  });
};
