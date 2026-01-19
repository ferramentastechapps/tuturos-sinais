export interface PortfolioAsset {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  averageBuyPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalPnL: number;
  totalPnLPercentage: number;
  assets: PortfolioAssetWithMetrics[];
}

export interface PortfolioAssetWithMetrics extends PortfolioAsset {
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercentage: number;
  change24h: number;
}
