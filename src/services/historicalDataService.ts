// ═══════════════════════════════════════════════════════════
// Historical Data Service — Bybit V5 Linear Klines with Cache
// Supports paginated fetching for long periods (up to 3 years)
// ═══════════════════════════════════════════════════════════

import { OHLCPoint } from '@/services/coingeckoOHLC';
import { BacktestTimeframe, OHLCCacheEntry } from '@/types/backtestTypes';

const BYBIT_BASE = 'https://api.bybit.com';
const MAX_KLINES_PER_REQUEST = 1000; // Bybit max per request
const RATE_LIMIT_DELAY = 200; // ms between requests

// Bybit usa códigos numéricos para intervalos (exceto '1d' e 'W')
const BYBIT_INTERVAL: Record<BacktestTimeframe, string> = {
    '1m':  '1',
    '5m':  '5',
    '15m': '15',
    '1h':  '60',
    '4h':  '240',
    '1d':  'D',
};

// Intervalo em ms por timeframe
const TIMEFRAME_MS: Record<BacktestTimeframe, number> = {
    '1m':  60 * 1000,
    '5m':  5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h':  60 * 60 * 1000,
    '4h':  4 * 60 * 60 * 1000,
    '1d':  24 * 60 * 60 * 1000,
};

// ──────────── Cache ────────────

const CACHE_PREFIX = 'bt_ohlc_';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24h

const getCacheKey = (symbol: string, timeframe: BacktestTimeframe, startMs: number, endMs: number): string => {
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

        const serialized = JSON.stringify(entry);
        if (serialized.length > 4 * 1024 * 1024) {
            console.warn(`[HistoricalData] Cache entry too large for ${symbol}, skipping cache`);
            return;
        }

        localStorage.setItem(key, serialized);
    } catch (e) {
        console.warn('[HistoricalData] Failed to cache data:', e);
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
    const toRemove = keys.slice(0, Math.ceil(keys.length / 2));
    toRemove.forEach(k => localStorage.removeItem(k));
};

// ──────────── Fetch Paginado (Bybit V5) ────────────

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Busca klines da Bybit V5 Linear API com paginação.
 * A Bybit retorna os dados do mais recente para o mais antigo,
 * então paginamos do fim para o início e revertemos no final.
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
    const bybitInterval = BYBIT_INTERVAL[interval];
    const estimatedCandles = Math.ceil((endMs - startMs) / intervalMs);
    const allCandles: OHLCPoint[] = [];

    // Bybit pagina do fim para o início: começamos com end = endMs
    // e vamos reduzindo conforme coletamos candles
    let currentEnd = endMs;
    let requestCount = 0;

    while (currentEnd > startMs) {
        const url = new URL(`${BYBIT_BASE}/v5/market/kline`);
        url.searchParams.set('category', 'linear');
        url.searchParams.set('symbol', formattedSymbol);
        url.searchParams.set('interval', bybitInterval);
        url.searchParams.set('start', startMs.toString());
        url.searchParams.set('end', currentEnd.toString());
        url.searchParams.set('limit', MAX_KLINES_PER_REQUEST.toString());

        try {
            const response = await fetch(url.toString());

            if (!response.ok) {
                if (response.status === 429) {
                    console.warn('[HistoricalData] Rate limited, waiting 5s...');
                    await delay(5000);
                    continue;
                }
                throw new Error(`Bybit API error: ${response.status} ${response.statusText}`);
            }

            const json = await response.json() as {
                retCode: number;
                retMsg: string;
                result?: { list: string[][] };
            };

            if (json.retCode !== 0) {
                throw new Error(`Bybit API error: ${json.retMsg}`);
            }

            const list = json.result?.list ?? [];
            if (list.length === 0) break;

            // Bybit retorna [startTime, open, high, low, close, volume, turnover]
            // em ordem do mais recente para o mais antigo
            const candles: OHLCPoint[] = list.map(k => ({
                timestamp: parseInt(k[0], 10),
                open:      parseFloat(k[1]),
                high:      parseFloat(k[2]),
                low:       parseFloat(k[3]),
                close:     parseFloat(k[4]),
                volume:    parseFloat(k[5]),
            }));

            allCandles.push(...candles);

            // Próxima página: end = timestamp do candle mais antigo desta página - 1ms
            const oldestTimestamp = candles[candles.length - 1].timestamp;

            // Se o candle mais antigo já está antes ou igual ao início, terminamos
            if (oldestTimestamp <= startMs) break;

            currentEnd = oldestTimestamp - 1;

            requestCount++;
            onProgress?.(allCandles.length, estimatedCandles);

            if (currentEnd > startMs) {
                await delay(RATE_LIMIT_DELAY);
            }

        } catch (error) {
            console.error(`[HistoricalData] Failed to fetch klines (request ${requestCount}):`, error);
            throw error;
        }
    }

    // Remover candles fora do range e duplicatas
    const seen = new Set<number>();
    const unique = allCandles
        .filter(c => {
            if (c.timestamp < startMs || c.timestamp > endMs) return false;
            if (seen.has(c.timestamp)) return false;
            seen.add(c.timestamp);
            return true;
        });

    // Ordenar crescente (mais antigo primeiro) — Bybit retorna decrescente
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
 * Busca dados históricos OHLCV da Bybit V5 Linear.
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

    const cacheKey = getCacheKey(symbol, timeframe, startMs, endMs);

    if (useCache) {
        const cached = getFromCache(cacheKey);
        if (cached && cached.length > 0) {
            console.log(`[HistoricalData] Cache hit for ${symbol} (${cached.length} candles)`);
            onProgress?.(cached.length, cached.length);
            return cached;
        }
    }

    console.log(`[HistoricalData] Fetching ${symbol} ${timeframe} from ${startDate} to ${endDate} via Bybit...`);

    const data = await fetchKlinesPaginated(symbol, timeframe, startMs, endMs, onProgress);

    console.log(`[HistoricalData] Fetched ${data.length} candles for ${symbol}`);

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
