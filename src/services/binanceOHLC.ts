// Binance OHLC Service — Fetches OHLCV data from Binance Futures
// Provides Volume data which is missing in CoinGecko's basic endpoint

import { OHLCPoint } from '@/services/coingeckoOHLC';

const BINANCE_FUTURES_API = 'https://fapi.binance.com';

// Mapeia TimeRange para quantidade de velas aproximada (assumindo intervalo 4h)
// 1 dia = 6 velas de 4h
// 30 dias = 180 velas de 4h
// Max limit binance = 1500
export const FETCH_LIMIT_MAP: Record<string, number> = {
    '1d': 6,
    '7d': 42,
    '14d': 84,
    '30d': 180,
    '90d': 540,
    'max': 1000
};

export const fetchBinanceOHLC = async (
    symbol: string,
    interval: string = '4h',
    limit: number = 200
): Promise<OHLCPoint[]> => {
    // Garantir símbolo compatível (ex: BTCUSDT)
    // Se vier "bitcoin", precisamos mapear. Por enquanto assumimos que o caller passa symbol correto (ex: BTCUSDT)
    const formattedSymbol = symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : `${symbol.toUpperCase()}USDT`;

    try {
        const url = `${BINANCE_FUTURES_API}/fapi/v1/klines?symbol=${formattedSymbol}&interval=${interval}&limit=${limit}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Binance OHLC error: ${response.status}`);
        }

        const data = await response.json() as any[];

        // Binance format:
        // [
        //   1499040000000,      // Open time
        //   "0.01634790",       // Open
        //   "0.80000000",       // High
        //   "0.01575800",       // Low
        //   "0.01577100",       // Close
        //   "148976.11427815",  // Volume
        //   1499644799999,      // Close time
        //   ...
        // ]

        return data.map(candle => ({
            timestamp: candle[0],
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5]), // Volume REAL!
        }));

    } catch (error) {
        console.error('Failed to fetch Binance OHLC:', error);
        // Fallback? Não, para backtest precisamos de dados bons.
        throw error;
    }
};
