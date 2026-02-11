import { CryptoPair } from '@/types/trading';
import { fetchFromProxy } from './apiProxy';

// Map our symbols to CoinGecko IDs (expanded for chart/historical data support)
const SYMBOL_TO_ID: Record<string, string> = {
  // Layer 1
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  SOLUSDT: 'solana',
  BNBUSDT: 'binancecoin',
  XRPUSDT: 'ripple',
  ADAUSDT: 'cardano',
  AVAXUSDT: 'avalanche-2',
  DOTUSDT: 'polkadot',
  ATOMUSDT: 'cosmos',
  NEARUSDT: 'near',
  APTUSDT: 'aptos',
  SUIUSDT: 'sui',
  TONUSDT: 'the-open-network',
  TRXUSDT: 'tron',
  LTCUSDT: 'litecoin',
  BCHUSDT: 'bitcoin-cash',
  FILUSDT: 'filecoin',
  ICPUSDT: 'internet-computer',
  ALGOUSDT: 'algorand',
  VETUSDT: 'vechain',
  HBARUSDT: 'hedera-hashgraph',
  EOSUSDT: 'eos',
  XLMUSDT: 'stellar',
  THETAUSDT: 'theta-token',
  EGLDUSDT: 'multiversx-egld',
  FTMUSDT: 'fantom',
  KAVAUSDT: 'kava',
  INJUSDT: 'injective-protocol',
  SEIUSDT: 'sei-network',
  TIAUSDT: 'celestia',
  STXUSDT: 'blockstack',
  // Layer 2
  MATICUSDT: 'matic-network',
  ARBUSDT: 'arbitrum',
  OPUSDT: 'optimism-ethereum',
  IMXUSDT: 'immutable-x',
  STRKUSDT: 'starknet',
  MANTAUSDT: 'manta-network',
  ZKUSDT: 'zksync',
  // DeFi
  UNIUSDT: 'uniswap',
  AAVEUSDT: 'aave',
  CRVUSDT: 'curve-dao-token',
  MKRUSDT: 'maker',
  SNXUSDT: 'havven',
  COMPUSDT: 'compound-governance-token',
  SUSHIUSDT: 'sushi',
  '1INCHUSDT': '1inch',
  LDOUSDT: 'lido-dao',
  PENDLEUSDT: 'pendle',
  DYDXUSDT: 'dydx',
  RUNEUSDT: 'thorchain',
  JUPUSDT: 'jupiter-exchange-solana',
  ENAUSDT: 'ethena',
  PYTHUSDT: 'pyth-network',
  // Memecoins
  DOGEUSDT: 'dogecoin',
  SHIBUSDT: 'shiba-inu',
  PEPEUSDT: 'pepe',
  FLOKIUSDT: 'floki',
  BONKUSDT: 'bonk',
  WIFUSDT: 'dogwifcoin',
  MEMEUSDT: 'memecoin-2',
  // Gaming
  AXSUSDT: 'axie-infinity',
  SANDUSDT: 'the-sandbox',
  MANAUSDT: 'decentraland',
  ENJUSDT: 'enjincoin',
  GALAUSDT: 'gala',
  BEAMUSDT: 'beam-2',
  RONUSDT: 'ronin',
  PIXELUSDT: 'pixels',
  // AI & Tech
  FETUSDT: 'fetch-ai',
  RNDRUSDT: 'render-token',
  TAOUSDT: 'bittensor',
  WLDUSDT: 'worldcoin-wld',
  GRTUSDT: 'the-graph',
  API3USDT: 'api3',
  // Infra / Oracles
  LINKUSDT: 'chainlink',
  BANDUSDT: 'band-protocol',
  UMAUSDT: 'uma',
  TRBUSDT: 'tellor',
  // Privacy
  ZECUSDT: 'zcash',
  DASHUSDT: 'dash',
  ROSEUSDT: 'oasis-network',
  // RWA / Trending
  ONDOUSDT: 'ondo-finance',
  BLURUSDT: 'blur',
  CHZUSDT: 'chiliz',
  APEUSDT: 'apecoin',
  GMTUSDT: 'stepn',
  CAKEUSDT: 'pancakeswap-token',
  YFIUSDT: 'yearn-finance',
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
