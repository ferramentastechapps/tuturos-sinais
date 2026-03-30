import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';

export interface PairStat {
    pair: string;
    wins: number;
    losses: number;
    total: number;
    winRate: number;
    pnl: number;
}

interface PairStatsResponse {
    topWinners: PairStat[];
    topLosers: PairStat[];
}

interface UsePairStatsOptions {
    tradeType?: string;
    dateRange?: string;
    type?: string;
}

export const usePairStats = (options: UsePairStatsOptions = {}) => {
    const { tradeType, dateRange, type } = options;

    return useQuery<PairStatsResponse>({
        queryKey: ['pair-stats', tradeType, dateRange, type],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (tradeType && tradeType !== 'ALL') params.append('trade_type', tradeType);
            if (dateRange && dateRange !== 'ALL') params.append('date_range', dateRange);
            if (type && type !== 'ALL') params.append('type', type);

            const { data } = await apiClient.get<PairStatsResponse>(
                `/signals/pair-stats?${params.toString()}`
            );
            return data;
        },
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });
};
