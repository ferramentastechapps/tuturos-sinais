import { useQuery } from '@tanstack/react-query';
import { fetchOHLCData, OHLCPoint, OHLCTimeRange } from '@/services/coingeckoOHLC';

export const useOHLCData = (symbol: string, range: OHLCTimeRange) => {
  return useQuery<OHLCPoint[], Error>({
    queryKey: ['ohlc-data', symbol, range],
    queryFn: () => fetchOHLCData(symbol, range),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    enabled: !!symbol,
  });
};
