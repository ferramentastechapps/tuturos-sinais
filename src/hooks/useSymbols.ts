import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';

export const useSymbols = () => {
  return useQuery<string[]>({
    queryKey: ['symbols'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ symbols: string[] }>('/symbols');
      return data?.symbols || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — symbols don't change often
    refetchOnWindowFocus: false,
  });
};
