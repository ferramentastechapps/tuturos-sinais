export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercentage: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
  averageHoldingTime: number; // in days
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
}

export interface EquityPoint {
  date: Date;
  value: number;
  pnl: number;
  pnlPercentage: number;
}

export interface PeriodPerformance {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';
  startDate: Date;
  endDate: Date;
  startValue: number;
  endValue: number;
  return: number;
  returnPercentage: number;
  trades: number;
  winRate: number;
}
