import { getCoinGeckoId } from './coingecko';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface HistoricalData {
  prices: PricePoint[];
  minPrice: number;
  maxPrice: number;
  priceChange: number;
  priceChangePercent: number;
}

export type TimeRange = '7d' | '30d' | '90d';

const DAYS_MAP: Record<TimeRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export const fetchHistoricalPrices = async (
  symbol: string,
  range: TimeRange
): Promise<HistoricalData> => {
  const coinId = getCoinGeckoId(symbol);
  
  if (!coinId) {
    throw new Error(`Unknown symbol: ${symbol}`);
  }

  const days = DAYS_MAP[range];
  
  const response = await fetch(
    `${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const data = await response.json();
  
  const prices: PricePoint[] = data.prices.map(([timestamp, price]: [number, number]) => ({
    timestamp,
    price,
  }));

  const priceValues = prices.map(p => p.price);
  const minPrice = Math.min(...priceValues);
  const maxPrice = Math.max(...priceValues);
  const firstPrice = prices[0]?.price || 0;
  const lastPrice = prices[prices.length - 1]?.price || 0;
  const priceChange = lastPrice - firstPrice;
  const priceChangePercent = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;

  return {
    prices,
    minPrice,
    maxPrice,
    priceChange,
    priceChangePercent,
  };
};
