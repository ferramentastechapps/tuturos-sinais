import { useMemo } from 'react';
import { TradeWithMetrics } from '@/types/trades';
import { PerformanceMetrics, EquityPoint, PeriodPerformance } from '@/types/analytics';

export const useAnalytics = (trades: TradeWithMetrics[], initialCapital: number = 10000) => {
  const performanceMetrics: PerformanceMetrics = useMemo(() => {
    const closedTrades = trades.filter(t => t.status === 'closed');
    
    if (closedTrades.length === 0) {
      return {
        totalReturn: 0,
        totalReturnPercentage: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        maxDrawdownPercentage: 0,
        winRate: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        bestTrade: 0,
        worstTrade: 0,
        averageHoldingTime: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
      };
    }

    const winningTrades = closedTrades.filter(t => t.pnl > 0);
    const losingTrades = closedTrades.filter(t => t.pnl < 0);
    
    const totalReturn = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalReturnPercentage = (totalReturn / initialCapital) * 100;
    
    const winRate = (winningTrades.length / closedTrades.length) * 100;
    
    const averageWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
      : 0;
    
    const averageLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length)
      : 0;
    
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    
    const bestTrade = closedTrades.reduce((max, t) => Math.max(max, t.pnl), -Infinity);
    const worstTrade = closedTrades.reduce((min, t) => Math.min(min, t.pnl), Infinity);
    
    // Calculate max drawdown
    let peak = initialCapital;
    let maxDrawdown = 0;
    let runningCapital = initialCapital;
    
    closedTrades
      .sort((a, b) => (a.closedAt?.getTime() || 0) - (b.closedAt?.getTime() || 0))
      .forEach(trade => {
        runningCapital += trade.pnl;
        if (runningCapital > peak) {
          peak = runningCapital;
        }
        const drawdown = peak - runningCapital;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      });
    
    const maxDrawdownPercentage = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
    
    // Calculate average holding time
    const holdingTimes = closedTrades
      .filter(t => t.closedAt)
      .map(t => {
        const start = t.createdAt.getTime();
        const end = t.closedAt!.getTime();
        return (end - start) / (1000 * 60 * 60 * 24); // days
      });
    
    const averageHoldingTime = holdingTimes.length > 0
      ? holdingTimes.reduce((sum, time) => sum + time, 0) / holdingTimes.length
      : 0;
    
    // Calculate Sharpe Ratio (simplified)
    const returns = closedTrades.map(t => t.pnlPercentage);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) : 0;

    return {
      totalReturn,
      totalReturnPercentage,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownPercentage,
      winRate,
      averageWin,
      averageLoss,
      profitFactor,
      bestTrade,
      worstTrade,
      averageHoldingTime,
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
    };
  }, [trades, initialCapital]);

  const equityCurve: EquityPoint[] = useMemo(() => {
    const closedTrades = trades
      .filter(t => t.status === 'closed' && t.closedAt)
      .sort((a, b) => (a.closedAt?.getTime() || 0) - (b.closedAt?.getTime() || 0));

    const points: EquityPoint[] = [{
      date: new Date(),
      value: initialCapital,
      pnl: 0,
      pnlPercentage: 0,
    }];

    let runningValue = initialCapital;
    closedTrades.forEach(trade => {
      runningValue += trade.pnl;
      points.push({
        date: trade.closedAt!,
        value: runningValue,
        pnl: runningValue - initialCapital,
        pnlPercentage: ((runningValue - initialCapital) / initialCapital) * 100,
      });
    });

    return points;
  }, [trades, initialCapital]);

  const periodPerformance = useMemo((): PeriodPerformance[] => {
    const closedTrades = trades
      .filter(t => t.status === 'closed' && t.closedAt)
      .sort((a, b) => (a.closedAt?.getTime() || 0) - (b.closedAt?.getTime() || 0));

    if (closedTrades.length === 0) return [];

    const now = new Date();
    const periods: PeriodPerformance[] = [];

    // Daily
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dailyTrades = closedTrades.filter(t => t.closedAt! >= dayStart);
    if (dailyTrades.length > 0) {
      const dailyPnL = dailyTrades.reduce((sum, t) => sum + t.pnl, 0);
      periods.push({
        period: 'daily',
        startDate: dayStart,
        endDate: now,
        startValue: initialCapital,
        endValue: initialCapital + dailyPnL,
        return: dailyPnL,
        returnPercentage: (dailyPnL / initialCapital) * 100,
        trades: dailyTrades.length,
        winRate: (dailyTrades.filter(t => t.pnl > 0).length / dailyTrades.length) * 100,
      });
    }

    // Weekly
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const weeklyTrades = closedTrades.filter(t => t.closedAt! >= weekStart);
    if (weeklyTrades.length > 0) {
      const weeklyPnL = weeklyTrades.reduce((sum, t) => sum + t.pnl, 0);
      periods.push({
        period: 'weekly',
        startDate: weekStart,
        endDate: now,
        startValue: initialCapital,
        endValue: initialCapital + weeklyPnL,
        return: weeklyPnL,
        returnPercentage: (weeklyPnL / initialCapital) * 100,
        trades: weeklyTrades.length,
        winRate: (weeklyTrades.filter(t => t.pnl > 0).length / weeklyTrades.length) * 100,
      });
    }

    // Monthly
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthlyTrades = closedTrades.filter(t => t.closedAt! >= monthStart);
    if (monthlyTrades.length > 0) {
      const monthlyPnL = monthlyTrades.reduce((sum, t) => sum + t.pnl, 0);
      periods.push({
        period: 'monthly',
        startDate: monthStart,
        endDate: now,
        startValue: initialCapital,
        endValue: initialCapital + monthlyPnL,
        return: monthlyPnL,
        returnPercentage: (monthlyPnL / initialCapital) * 100,
        trades: monthlyTrades.length,
        winRate: (monthlyTrades.filter(t => t.pnl > 0).length / monthlyTrades.length) * 100,
      });
    }

    return periods;
  }, [trades, initialCapital]);

  return {
    performanceMetrics,
    equityCurve,
    periodPerformance,
  };
};
