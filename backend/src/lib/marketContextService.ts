// Market Context Service — Provides real macro data for the ML feature vector
// Caches results to avoid hammering external APIs on every signal cycle.

import { bybitConnector } from '../exchange/bybitConnector.js';
import { calculateEMA } from '../engine/signalEngine.js';
import { logger } from './logger.js';

export interface MarketContext {
    btcTrend: number;        // 1 = above EMA200 (bullish), -1 = below (bearish), 0 = unknown
    fearGreed: number;       // 0–100 index
    dominanceBtc: number;    // BTC dominance % (0–100)
    openInterestVar: number; // OI variation % for a specific symbol (computed per-symbol)
}

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

interface FearGreedResponse {
    data: { value: string }[];
}

interface CoinGeckoGlobal {
    data: {
        market_cap_percentage: { btc: number };
    };
}

class MarketContextService {
    // ── Caches ──────────────────────────────────────────────────────────────
    private btcTrendCache: CacheEntry<number> | null = null;
    private fearGreedCache: CacheEntry<number> | null = null;
    private dominanceCache: CacheEntry<number> | null = null;
    private oiSnapshots: Map<string, number> = new Map(); // previous OI per symbol

    // ── TTLs (ms) ───────────────────────────────────────────────────────────
    private readonly BTC_TREND_TTL   = 5  * 60 * 1000;  // 5 min
    private readonly FEAR_GREED_TTL  = 60 * 60 * 1000;  // 1 hour
    private readonly DOMINANCE_TTL   = 6  * 60 * 60 * 1000; // 6 hours

    // ── BTC Trend ────────────────────────────────────────────────────────────
    async getBtcTrend(): Promise<number> {
        if (this.btcTrendCache && Date.now() < this.btcTrendCache.expiresAt) {
            return this.btcTrendCache.value;
        }

        try {
            let ohlc = bybitConnector.getKlineData('BTCUSDT');
            if (ohlc.length < 200) {
                ohlc = await bybitConnector.fetchKlines('BTCUSDT', '60', 220);
            }

            if (ohlc.length < 200) {
                logger.warn('[MarketContext] Not enough BTC klines for EMA200');
                return 0;
            }

            const closes = ohlc.map(c => c.close);
            const ema200Series = calculateEMA(closes, 200);
            const ema200 = ema200Series[ema200Series.length - 1];
            const currentBtcPrice = closes[closes.length - 1];

            const trend = currentBtcPrice > ema200 ? 1 : -1;

            this.btcTrendCache = { value: trend, expiresAt: Date.now() + this.BTC_TREND_TTL };
            logger.debug(`[MarketContext] BTC trend: ${trend} (price: ${currentBtcPrice.toFixed(0)}, ema200: ${ema200.toFixed(0)})`);
            return trend;
        } catch (err) {
            logger.warn('[MarketContext] Failed to compute BTC trend', { err });
            return 0;
        }
    }

    // ── Fear & Greed Index ───────────────────────────────────────────────────
    async getFearGreed(): Promise<number> {
        if (this.fearGreedCache && Date.now() < this.fearGreedCache.expiresAt) {
            return this.fearGreedCache.value;
        }

        try {
            const res = await fetch('https://api.alternative.me/fng/?limit=1', {
                signal: AbortSignal.timeout(5000),
            });
            const json = await res.json() as FearGreedResponse;
            const value = parseInt(json.data?.[0]?.value ?? '50', 10);

            this.fearGreedCache = { value, expiresAt: Date.now() + this.FEAR_GREED_TTL };
            logger.debug(`[MarketContext] Fear & Greed: ${value}`);
            return value;
        } catch (err) {
            logger.warn('[MarketContext] Failed to fetch Fear & Greed index', { err });
            // Return cached stale value if available, otherwise neutral
            return this.fearGreedCache?.value ?? 50;
        }
    }

    // ── BTC Dominance ────────────────────────────────────────────────────────
    async getBtcDominance(): Promise<number> {
        if (this.dominanceCache && Date.now() < this.dominanceCache.expiresAt) {
            return this.dominanceCache.value;
        }

        try {
            const res = await fetch('https://api.coingecko.com/api/v3/global', {
                signal: AbortSignal.timeout(8000),
            });
            const json = await res.json() as CoinGeckoGlobal;
            const dominance = json.data?.market_cap_percentage?.btc ?? 50;

            this.dominanceCache = { value: dominance, expiresAt: Date.now() + this.DOMINANCE_TTL };
            logger.debug(`[MarketContext] BTC dominance: ${dominance.toFixed(2)}%`);
            return dominance;
        } catch (err) {
            logger.warn('[MarketContext] Failed to fetch BTC dominance', { err });
            return this.dominanceCache?.value ?? 50;
        }
    }

    // ── Open Interest Variation ──────────────────────────────────────────────
    // Returns % change in OI since last call for this symbol (positive = growing)
    async getOpenInterestVar(symbol: string): Promise<number> {
        try {
            const data = await bybitConnector.fetchOpenInterest(symbol);
            const currentOI = data.openInterest;

            const previousOI = this.oiSnapshots.get(symbol);
            this.oiSnapshots.set(symbol, currentOI); // update snapshot

            if (!previousOI || previousOI === 0) {
                return 0; // No previous snapshot yet
            }

            const variation = ((currentOI - previousOI) / previousOI) * 100;
            logger.debug(`[MarketContext] OI var for ${symbol}: ${variation.toFixed(3)}%`);
            return variation;
        } catch (err) {
            logger.warn(`[MarketContext] Failed to fetch OI for ${symbol}`, { err });
            return 0;
        }
    }

    // ── Convenience: fetch all global context at once ────────────────────────
    async getGlobalContext(): Promise<{ btcTrend: number; fearGreed: number; dominanceBtc: number }> {
        const [btcTrend, fearGreed, dominanceBtc] = await Promise.all([
            this.getBtcTrend(),
            this.getFearGreed(),
            this.getBtcDominance(),
        ]);
        return { btcTrend, fearGreed, dominanceBtc };
    }
}

export const marketContextService = new MarketContextService();
