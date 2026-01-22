import { useQuery } from '@tanstack/react-query';
import { fetchFearGreedIndex, getSentimentFromValue, getTrendFromValue } from '@/services/fearGreedIndex';
import { MarketSentiment } from '@/types/trading';

export const useMarketSentiment = () => {
  return useQuery<MarketSentiment, Error>({
    queryKey: ['market-sentiment'],
    queryFn: async () => {
      const data = await fetchFearGreedIndex();
      
      return {
        fearGreedIndex: data.value,
        sentiment: getSentimentFromValue(data.value),
        trend: getTrendFromValue(data.value),
      };
    },
    refetchInterval: 3600000, // Refresh every hour
    staleTime: 1800000, // Consider stale after 30 minutes
    retry: 2,
  });
};
