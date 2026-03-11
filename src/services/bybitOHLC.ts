import { supabase } from '@/integrations/supabase/client';

export interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Bybit intervals: 1,3,5,15,30,60,120,240,360,720,D,W,M
export type BybitInterval = '1' | '3' | '5' | '15' | '30' | '60' | '120' | '240' | '360' | '720' | 'D' | 'W' | 'M';

export interface BybitTimeframe {
  label: string;
  interval: BybitInterval;
  limit: number;
}

export const BYBIT_TIMEFRAMES: BybitTimeframe[] = [
  { label: '1m', interval: '1', limit: 200 },
  { label: '5m', interval: '5', limit: 200 },
  { label: '15m', interval: '15', limit: 200 },
  { label: '30m', interval: '30', limit: 200 },
  { label: '1h', interval: '60', limit: 200 },
  { label: '4h', interval: '240', limit: 200 },
  { label: '1d', interval: 'D', limit: 200 },
  { label: '1w', interval: 'W', limit: 100 },
  { label: '1M', interval: 'M', limit: 60 },
];

// Map coingecko-style symbols to Bybit symbols
const toBybitSymbol = (symbol: string): string => {
  // If already in BTCUSDT format, use as is
  if (symbol.endsWith('USDT')) return symbol;
  // Convert from coingecko id format
  const map: Record<string, string> = {
    bitcoin: 'BTCUSDT',
    ethereum: 'ETHUSDT',
    solana: 'SOLUSDT',
    binancecoin: 'BNBUSDT',
    ripple: 'XRPUSDT',
    cardano: 'ADAUSDT',
    'avalanche-2': 'AVAXUSDT',
    polkadot: 'DOTUSDT',
    dogecoin: 'DOGEUSDT',
    'shiba-inu': 'SHIBUSDT',
    chainlink: 'LINKUSDT',
    uniswap: 'UNIUSDT',
    litecoin: 'LTCUSDT',
    'bitcoin-cash': 'BCHUSDT',
    cosmos: 'ATOMUSDT',
    near: 'NEARUSDT',
    aptos: 'APTUSDT',
    sui: 'SUIUSDT',
    tron: 'TRXUSDT',
    stellar: 'XLMUSDT',
  };
  return map[symbol] || `${symbol.toUpperCase()}USDT`;
};

export const fetchBybitOHLC = async (
  symbol: string,
  interval: BybitInterval,
  limit: number = 200
): Promise<OHLCPoint[]> => {
  const bybitSymbol = toBybitSymbol(symbol);

  const { data, error } = await supabase.functions.invoke('bybit-proxy', {
    body: undefined,
    headers: { 'Content-Type': 'application/json' },
  });

  // Use direct fetch with query params since invoke doesn't support query params well
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'owchjtzucnhsvlkwdapn';
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const url = `https://${projectId}.supabase.co/functions/v1/bybit-proxy?symbol=${bybitSymbol}&interval=${interval}&limit=${limit}`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': anonKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Bybit proxy error: ${response.status}`);
  }

  const result = await response.json();

  if (result.retCode !== 0) {
    throw new Error(`Bybit API error: ${result.retMsg}`);
  }

  // Bybit returns: [startTime, openPrice, highPrice, lowPrice, closePrice, volume, turnover]
  // Data comes in reverse chronological order
  const klines = result.result?.list || [];
  
  return klines
    .map((item: string[]) => ({
      timestamp: parseInt(item[0]),
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    }))
    .reverse(); // Chronological order
};
