import { useQuery } from '@tanstack/react-query';
import { fetchCryptoPrices } from '@/services/coingecko';
import { cryptoPairs as mockPairs } from '@/data/mockData';
import { CryptoPair } from '@/types/trading';

export const useCryptoPrices = () => {
  return useQuery<CryptoPair[], Error>({
    queryKey: ['crypto-prices'],
    queryFn: fetchCryptoPrices,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
    retry: 2,
    placeholderData: mockPairs, // Use mock data while loading
  });
};

export const useCurrentPrice = (symbol: string) => {
  const { data: prices } = useCryptoPrices();
  return prices?.find(p => p.symbol === symbol)?.price;
};
