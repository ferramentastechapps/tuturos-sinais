import { getCoinGeckoId } from './coingecko';
import { fetchFromProxy } from './apiProxy';

export interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type OHLCTimeRange = '1d' | '7d' | '14d' | '30d';

const DAYS_MAP: Record<OHLCTimeRange, number> = {
  '1d': 1,
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

export const fetchOHLCData = async (
  symbol: string,
  range: OHLCTimeRange
): Promise<OHLCPoint[]> => {
  const coinId = getCoinGeckoId(symbol);
  
  if (!coinId) {
    throw new Error(`Unknown symbol: ${symbol}`);
  }

  const days = DAYS_MAP[range];
  
  const data = await fetchFromProxy(`/coins/${coinId}/ohlc`, {
    vs_currency: 'usd',
    days: days.toString(),
  }) as [number, number, number, number, number][];

  return data.map((item) => ({
    timestamp: item[0],
    open: item[1],
    high: item[2],
    low: item[3],
    close: item[4],
  }));
};
