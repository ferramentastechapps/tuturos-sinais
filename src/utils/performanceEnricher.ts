import { TradeSignal } from '@/types/trading';
import { SymbolPerformanceSummary } from '@/types/indicatorPerformanceTypes';
import { INDICATOR_REGISTRY } from '@/types/strategyTypes';

export interface SignalPerformanceContext {
  symbol: string;
  totalTrades: number;
  globalWinRate: number;
  globalProfitFactor: number;
  confirmedTopExcerpts: { name: string; score: number; stars: string; winRate: number; trades: number }[];
  weakExcerpts: { name: string; score: number; winRate: number; recommendation: string }[];
  insights: string[];
  insufficientData: boolean;
}

export const enrichSignalWithPerformance = (
  signal: TradeSignal,
  summary: SymbolPerformanceSummary | null
) => {
  if (!summary) return signal;
  
  const { topIndicators, weakIndicators, totalTrades, globalWinRate, globalProfitFactor } = summary;
  const insufficientData = totalTrades < 10;
  
  // Find which of the top indicators actually confirmed in this signal
  const confirmedTopExcerpts = topIndicators
    .filter(ind => signal.indicators.includes(ind.indicatorKey))
    .map(ind => ({
      name: INDICATOR_REGISTRY[ind.indicatorKey]?.name || ind.indicatorKey,
      score: Math.round(ind.finalScore),
      stars: ind.stars,
      winRate: Math.round(ind.winRate),
      trades: ind.totalTrades
    }))
    .slice(0, 5); // Keep top 5
    
  const weakExcerpts = weakIndicators
    .filter(ind => signal.indicators.includes(ind.indicatorKey) || (signal as TradeSignal & { profileInfo?: { activeIndicators: number } }).profileInfo?.activeIndicators)
    .map(ind => ({
      name: INDICATOR_REGISTRY[ind.indicatorKey]?.name || ind.indicatorKey,
      score: Math.round(ind.finalScore),
      winRate: Math.round(ind.winRate),
      recommendation: ind.recommendation
    }))
    .slice(0, 3); // Keep top 3 weakest
    
  // Build insights
  const insights: string[] = [];
  if (confirmedTopExcerpts.length > 0) {
    insights.push(`✅ ${confirmedTopExcerpts[0].name} tem histórico positivo em ${summary.symbol}`);
  }
  
  if (weakExcerpts.some(w => signal.indicators.includes(w.name))) {
    insights.push(`⚠️ Cuidado: Este sinal ativou indicadores com baixa eficácia histórica neste par.`);
  }

  const performanceContext: SignalPerformanceContext = {
    symbol: summary.symbol,
    totalTrades,
    globalWinRate: Math.round(globalWinRate),
    globalProfitFactor: Number(globalProfitFactor.toFixed(1)),
    confirmedTopExcerpts,
    weakExcerpts,
    insights,
    insufficientData
  };

  return {
    ...signal,
    performanceContext
  };
};

export const formatPerformanceForTelegram = (context: SignalPerformanceContext): string => {
  if (!context || context.insufficientData) return '';
  
  let msg = `\n\n🔍 *ANÁLISE HISTÓRICA — ${context.symbol}*\n`;
  msg += `✅ Este par tem *${context.globalWinRate}%* de acerto (${context.totalTrades} operações)\n`;
  
  if (context.confirmedTopExcerpts.length > 0) {
    msg += `✅ Indicadores confirmados têm bom histórico (${context.confirmedTopExcerpts[0].name} - ${context.confirmedTopExcerpts[0].winRate}%)\n`;
  }
  
  if (context.weakExcerpts.length > 0) {
    msg += `⚠️ *ATENÇÃO*: ${context.weakExcerpts[0].name} possui baixa eficácia aqui (${context.weakExcerpts[0].winRate}% WR)\n`;
  }
  
  return msg;
};
