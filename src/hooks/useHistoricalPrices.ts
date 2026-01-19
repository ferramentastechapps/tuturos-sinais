import { useQuery } from '@tanstack/react-query';
import { fetchHistoricalPrices, TimeRange, HistoricalData } from '@/services/coingeckoChart';

export const useHistoricalPrices = (symbol: string, range: TimeRange) => {
  return useQuery<HistoricalData, Error>({
    queryKey: ['historical-prices', symbol, range],
    queryFn: () => fetchHistoricalPrices(symbol, range),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    enabled: !!symbol,
  });
};
