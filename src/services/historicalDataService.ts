// ═══════════════════════════════════════════════════════════
// Historical Data Service — Binance Futures Klines with Cache
// Supports paginated fetching for long periods (up to 3 years)
// ═══════════════════════════════════════════════════════════

import { OHLCPoint } from '@/services/coingeckoOHLC';
import { BacktestTimeframe, OHLCCacheEntry } from '@/types/backtestTypes';

const BINANCE_FUTURES_BASE = 'https://fapi.binance.com';
const MAX_KLINES_PER_REQUEST = 1500;
const RATE_LIMIT_DELAY = 150; // ms between requests

// Intervalo em ms por timeframe
const TIMEFRAME_MS: Record<BacktestTimeframe, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
};

// ──────────── Cache ────────────

const CACHE_PREFIX = 'bt_ohlc_';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24h

const getCacheKey = (symbol: string, timeframe: BacktestTimeframe, startMs: number, endMs: number): string => {
    // Arredonda para dia para reutilizar cache
    const startDay = new Date(startMs).toISOString().split('T')[0];
    const endDay = new Date(endMs).toISOString().split('T')[0];
    return `${CACHE_PREFIX}${symbol}_${timeframe}_${startDay}_${endDay}`;
};

const getFromCache = (key: string): OHLCPoint[] | null => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;

        const entry: OHLCCacheEntry = JSON.parse(raw);
        const age = Date.now() - entry.fetchedAt;

        if (age > CACHE_MAX_AGE) {
            localStorage.removeItem(key);
            return null;
        }

        return entry.data;
    } catch {
        return null;
    }
};

const saveToCache = (
    key: string,
    symbol: string,
    timeframe: BacktestTimeframe,
    data: OHLCPoint[]
): void => {
    try {
        if (data.length === 0) return;

        const entry: OHLCCacheEntry = {
            symbol,
            timeframe,
            data,
            fetchedAt: Date.now(),
            startTimestamp: data[0].timestamp,
            endTimestamp: data[data.length - 1].timestamp,
        };

        // Verificar se cabe no localStorage (limite ~5MB)
        const serialized = JSON.stringify(entry);
        if (serialized.length > 4 * 1024 * 1024) {
            console.warn(`[HistoricalData] Cache entry too large for ${symbol}, skipping cache`);
            return;
        }

        localStorage.setItem(key, serialized);
    } catch (e) {
        console.warn('[HistoricalData] Failed to cache data:', e);
        // Se localStorage cheio, limpar caches antigos
        cleanOldCaches();
    }
};

const cleanOldCaches = (): void => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
            keys.push(key);
        }
    }

    // Remove os mais antigos (primeiro 50%)
    const toRemove = keys.slice(0, Math.ceil(keys.length / 2));
    toRemove.forEach(k => localStorage.removeItem(k));
};

// ──────────── Fetch Paginado ────────────

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Busca klines de um período da Binance Futures API.
 * Se o período requerer mais de 1500 candles, faz múltiplos requests.
 */
const fetchKlinesPaginated = async (
    symbol: string,
    interval: BacktestTimeframe,
    startMs: number,
    endMs: number,
    onProgress?: (fetched: number, estimated: number) => void
): Promise<OHLCPoint[]> => {
    const formattedSymbol = symbol.toUpperCase().endsWith('USDT')
        ? symbol.toUpperCase()
        : `${symbol.toUpperCase()}USDT`;

    const intervalMs = TIMEFRAME_MS[interval];
    const estimatedCandles = Math.ceil((endMs - startMs) / intervalMs);
    const allCandles: OHLCPoint[] = [];
    let currentStart = startMs;
    let requestCount = 0;

    while (currentStart < endMs) {
        const url = new URL(`${BINANCE_FUTURES_BASE}/fapi/v1/klines`);
        url.searchParams.set('symbol', formattedSymbol);
        url.searchParams.set('interval', interval);
        url.searchParams.set('startTime', currentStart.toString());
        url.searchParams.set('endTime', endMs.toString());
        url.searchParams.set('limit', MAX_KLINES_PER_REQUEST.toString());

        try {
            const response = await fetch(url.toString());

            if (!response.ok) {
                if (response.status === 429) {
                    // Rate limited, wait and retry
                    console.warn('[HistoricalData] Rate limited, waiting 3s...');
                    await delay(3000);
                    continue;
                }
                throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any[];

            if (data.length === 0) break;

            const candles: OHLCPoint[] = data.map(k => ({
                timestamp: k[0] as number,
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5]),
            }));

            allCandles.push(...candles);

            // Avançar startTime para depois do último candle
            const lastTimestamp = candles[candles.length - 1].timestamp;
            currentStart = lastTimestamp + intervalMs;

            requestCount++;
            onProgress?.(allCandles.length, estimatedCandles);

            // Rate limit
            if (currentStart < endMs) {
                await delay(RATE_LIMIT_DELAY);
            }

        } catch (error) {
            console.error(`[HistoricalData] Failed to fetch klines (request ${requestCount}):`, error);
            throw error;
        }
    }

    // Remover duplicatas (pode haver overlap entre páginas)
    const seen = new Set<number>();
    const unique = allCandles.filter(c => {
        if (seen.has(c.timestamp)) return false;
        seen.add(c.timestamp);
        return true;
    });

    // Ordenar por timestamp
    unique.sort((a, b) => a.timestamp - b.timestamp);

    return unique;
};

// ──────────── Public API ────────────

export interface FetchHistoricalDataOptions {
    symbol: string;
    timeframe: BacktestTimeframe;
    startDate: string;    // ISO date "2023-01-01"
    endDate: string;      // ISO date "2024-12-31"
    useCache?: boolean;
    onProgress?: (fetched: number, estimated: number) => void;
}

/**
 * Busca dados históricos OHLCV da Binance Futures.
 * Automaticamente pagina e faz cache.
 */
export const fetchHistoricalData = async (
    options: FetchHistoricalDataOptions
): Promise<OHLCPoint[]> => {
    const {
        symbol,
        timeframe,
        startDate,
        endDate,
        useCache = true,
        onProgress,
    } = options;

    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1); // End of day

    if (startMs >= endMs) {
        throw new Error('startDate must be before endDate');
    }

    // Check cache
    const cacheKey = getCacheKey(symbol, timeframe, startMs, endMs);

    if (useCache) {
        const cached = getFromCache(cacheKey);
        if (cached && cached.length > 0) {
            console.log(`[HistoricalData] Cache hit for ${symbol} (${cached.length} candles)`);
            onProgress?.(cached.length, cached.length);
            return cached;
        }
    }

    // Fetch from Binance
    console.log(`[HistoricalData] Fetching ${symbol} ${timeframe} from ${startDate} to ${endDate}...`);

    const data = await fetchKlinesPaginated(symbol, timeframe, startMs, endMs, onProgress);

    console.log(`[HistoricalData] Fetched ${data.length} candles for ${symbol}`);

    // Cache result
    if (useCache && data.length > 0) {
        saveToCache(cacheKey, symbol, timeframe, data);
    }

    return data;
};

/**
 * Busca dados para múltiplos símbolos.
 */
export const fetchMultiSymbolData = async (
    symbols: string[],
    timeframe: BacktestTimeframe,
    startDate: string,
    endDate: string,
    onProgress?: (symbol: string, fetched: number, estimated: number) => void
): Promise<Map<string, OHLCPoint[]>> => {
    const result = new Map<string, OHLCPoint[]>();

    for (const symbol of symbols) {
        const data = await fetchHistoricalData({
            symbol,
            timeframe,
            startDate,
            endDate,
            onProgress: (fetched, estimated) => onProgress?.(symbol, fetched, estimated),
        });
        result.set(symbol, data);
    }

    return result;
};

/**
 * Estima o número de candles para um período e timeframe.
 */
export const estimateCandleCount = (
    startDate: string,
    endDate: string,
    timeframe: BacktestTimeframe
): number => {
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    return Math.ceil((endMs - startMs) / TIMEFRAME_MS[timeframe]);
};

/**
 * Limpa todo o cache de dados históricos.
 */
export const clearHistoricalCache = (): void => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
    console.log(`[HistoricalData] Cleared ${keys.length} cache entries`);
};
