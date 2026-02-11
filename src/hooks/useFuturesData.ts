// Hook para dados de futuros — Funding Rate, Open Interest, Liquidações
// Consome o serviço Binance Futures e expõe dados reativos para os componentes

import { useQuery } from '@tanstack/react-query';
import {
    fetchFundingRate,
    fetchOpenInterest,
    fetchOpenInterestHistory,
    fetchLiquidationSummary,
    analyzeOIDivergence,
    isFuturesAvailable,
    type FundingRateData,
    type OpenInterestData,
    type OpenInterestHistory,
    type OIDivergence,
    type LiquidationSummary,
} from '@/services/binanceFutures';

// ──────────── Tipos ────────────

export interface FuturesData {
    fundingRate: FundingRateData;
    openInterest: OpenInterestData;
    oiHistory: OpenInterestHistory;
    oiDivergence: OIDivergence | null;
    liquidations: LiquidationSummary;
    available: boolean;
}

// ──────────── Hook Principal ────────────

/**
 * Hook para buscar todos os dados de futuros de um símbolo.
 * Atualiza a cada 2 minutos (funding rate muda a cada 8h, mas OI e liquidações são dinâmicos).
 */
export const useFuturesData = (symbol: string, priceChange24h: number = 0) => {
    const available = isFuturesAvailable(symbol);

    return useQuery<FuturesData, Error>({
        queryKey: ['futures-data', symbol],
        queryFn: async (): Promise<FuturesData> => {
            if (!available) {
                return {
                    fundingRate: {
                        symbol,
                        fundingRate: 0,
                        fundingRatePercent: 0,
                        nextFundingTime: 0,
                        timestamp: Date.now(),
                        isExtreme: false,
                        direction: 'neutral',
                        description: 'Par não disponível em futuros',
                    },
                    openInterest: {
                        symbol,
                        openInterest: 0,
                        openInterestValue: 0,
                        timestamp: Date.now(),
                    },
                    oiHistory: {
                        symbol,
                        data: [],
                        change24h: 0,
                        trend: 'stable',
                    },
                    oiDivergence: null,
                    liquidations: {
                        symbol,
                        longLiquidations24h: 0,
                        shortLiquidations24h: 0,
                        ratio: 1,
                        dominantSide: 'balanced',
                        totalValue24h: 0,
                        description: 'Indisponível',
                    },
                    available: false,
                };
            }

            // Busca todos os dados em paralelo
            const [fundingRate, openInterest, oiHistory, liquidations] = await Promise.all([
                fetchFundingRate(symbol),
                fetchOpenInterest(symbol),
                fetchOpenInterestHistory(symbol, '1h', 48),
                fetchLiquidationSummary(symbol),
            ]);

            const oiDivergence = analyzeOIDivergence(oiHistory, priceChange24h);

            return {
                fundingRate,
                openInterest,
                oiHistory,
                oiDivergence,
                liquidations,
                available: true,
            };
        },
        refetchInterval: 120000, // 2 minutos
        staleTime: 60000, // 1 minuto
        retry: 2,
        enabled: !!symbol && available,
    });
};

// ──────────── Hook Apenas Funding Rate ────────────

/**
 * Hook leve para buscar apenas o funding rate (útil para listas).
 */
export const useFundingRate = (symbol: string) => {
    return useQuery<FundingRateData, Error>({
        queryKey: ['funding-rate', symbol],
        queryFn: () => fetchFundingRate(symbol),
        refetchInterval: 300000, // 5 minutos
        staleTime: 120000, // 2 minutos
        retry: 2,
        enabled: !!symbol && isFuturesAvailable(symbol),
    });
};

// ──────────── Hook Apenas Open Interest ────────────

/**
 * Hook para buscar Open Interest com histórico.
 */
export const useOpenInterest = (symbol: string, priceChange24h: number = 0) => {
    return useQuery<{
        current: OpenInterestData;
        history: OpenInterestHistory;
        divergence: OIDivergence | null;
    }, Error>({
        queryKey: ['open-interest', symbol],
        queryFn: async () => {
            const [current, history] = await Promise.all([
                fetchOpenInterest(symbol),
                fetchOpenInterestHistory(symbol, '1h', 48),
            ]);

            const divergence = analyzeOIDivergence(history, priceChange24h);

            return { current, history, divergence };
        },
        refetchInterval: 120000,
        staleTime: 60000,
        retry: 2,
        enabled: !!symbol && isFuturesAvailable(symbol),
    });
};
