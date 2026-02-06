import { CryptoPair } from '@/types/trading';
import { fetchFromProxy } from './apiProxy';

// Map our symbols to CoinGecko IDs
const SYMBOL_TO_ID: Record<string, string> = {
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  SOLUSDT: 'solana',
  BNBUSDT: 'binancecoin',
  XRPUSDT: 'ripple',
  ADAUSDT: 'cardano',
  DOGEUSDT: 'dogecoin',
  AVAXUSDT: 'avalanche-2',
  MATICUSDT: 'matic-network',
  DOTUSDT: 'polkadot',
  LINKUSDT: 'chainlink',
};

const ID_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(SYMBOL_TO_ID).map(([k, v]) => [v, k])
);

export interface CoinGeckoPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  market_cap: number;
}

export const fetchCryptoPrices = async (): Promise<CryptoPair[]> => {
  const ids = Object.values(SYMBOL_TO_ID).join(',');
  
  const data = await fetchFromProxy('/coins/markets', {
    vs_currency: 'usd',
    ids,
    order: 'market_cap_desc',
    sparkline: 'false',
    price_change_percentage: '24h',
  }) as CoinGeckoPrice[];

  return data
    .filter((coin) => coin.current_price != null)
    .map((coin): CryptoPair => ({
      symbol: ID_TO_SYMBOL[coin.id] || coin.symbol.toUpperCase() + 'USDT',
      name: coin.name,
      price: coin.current_price,
      change24h: coin.price_change_percentage_24h ?? 0,
      volume24h: coin.total_volume ?? 0,
      high24h: coin.high_24h ?? coin.current_price,
      low24h: coin.low_24h ?? coin.current_price,
      isFavorite: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].includes(ID_TO_SYMBOL[coin.id]),
    }));
};

export const getCoinGeckoId = (symbol: string): string | undefined => {
  return SYMBOL_TO_ID[symbol];
};
