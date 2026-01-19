export interface CryptoPair {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  isFavorite?: boolean;
}

export interface TechnicalIndicator {
  name: string;
  value: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  description?: string;
}

export interface TradeSignal {
  id: string;
  pair: string;
  type: 'long' | 'short';
  entry: number;
  takeProfit: number;
  stopLoss: number;
  riskReward: number;
  timeframe: string;
  status: 'active' | 'hit_tp' | 'hit_sl' | 'cancelled';
  confidence: number;
  createdAt: Date;
  indicators: string[];
}

export interface RiskCalculation {
  positionSize: number;
  riskAmount: number;
  potentialProfit: number;
  leverageRecommended: number;
  marginRequired: number;
}

export interface MarketSentiment {
  fearGreedIndex: number;
  sentiment: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
  trend: 'bullish' | 'bearish' | 'sideways';
}
