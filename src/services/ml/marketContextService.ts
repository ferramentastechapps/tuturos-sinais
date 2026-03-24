import { apiClient } from '../apiClient';

export interface MarketContext {
    btcTrend: number;        // 1 = above EMA200 (bullish), -1 = below (bearish), 0 = unknown
    fearGreed: number;       // 0–100 index
    dominanceBtc: number;    // BTC dominance % (0–100)
}

// Minimal generic response type to avoid strict coupling when backend evolves
interface MarketMetricsResponse {
    engine?: {
        globalContext?: MarketContext;
    };
    [key: string]: unknown;
}

class MarketContextService {
    private cache: MarketContext | null = null;
    private lastFetch = 0;
    private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes cache

    /**
     * Fetches real market context from the backend via the /api/metrics endpoint
     */
    async getGlobalContext(): Promise<MarketContext> {
        if (this.cache && Date.now() - this.lastFetch < this.TTL_MS) {
            return this.cache;
        }

        try {
            // Note: Our backend returns this inside the /metrics endpoint
            const response = await apiClient.get<MarketMetricsResponse>('/metrics');
            
            const context = response.data?.engine?.globalContext;
            
            if (context) {
                this.cache = context;
                this.lastFetch = Date.now();
                return context;
            }
        } catch (error) {
            console.error('Failed to fetch market context:', error);
        }

        // Fallback if backend is unreachable or missing data
        return this.cache || {
            btcTrend: 0,
            fearGreed: 50,
            dominanceBtc: 50,
        };
    }
}

export const marketContextService = new MarketContextService();
