import { getCoinGeckoId } from './coingecko';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number; // Optional - CoinGecko OHLC endpoint doesn't return volume
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
  
  const response = await fetch(
    `${COINGECKO_API}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const data = await response.json();
  
  // CoinGecko returns [timestamp, open, high, low, close]
  return data.map((item: [number, number, number, number, number]) => ({
    timestamp: item[0],
    open: item[1],
    high: item[2],
    low: item[3],
    close: item[4],
  }));
};
