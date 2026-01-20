export type TradeType = 'buy' | 'sell';
export type TradeStatus = 'open' | 'closed';

export interface Trade {
  id: string;
  symbol: string;
  name: string;
  type: TradeType;
  entryPrice: number;
  quantity: number;
  exitPrice?: number;
  status: TradeStatus;
  createdAt: Date;
  closedAt?: Date;
  entryFee?: number;
  exitFee?: number;
  notes?: string;
  exchange?: string;
}

export interface TradeWithMetrics extends Trade {
  currentPrice: number;
  currentValue: number;
  investedValue: number;
  pnl: number;
  pnlPercentage: number;
}

export interface TradesSummary {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  totalPnL: number;
  winRate: number;
}
