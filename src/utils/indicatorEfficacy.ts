import { 
  IndicatorPerformanceRecord, 
  IndicatorEfficacyScore, 
  SymbolPerformanceSummary 
} from '@/types/indicatorPerformanceTypes';
import { StrategyProfile, IndicatorKey, IndicatorsMap } from '@/types/strategyTypes';

const MIN_TRADES_FOR_CONFIDENCE = 10;

/**
 * Computes a standardized 0-100 efficacy score for a single indicator performance record.
 */
export const computeEfficacyScore = (record: IndicatorPerformanceRecord): IndicatorEfficacyScore => {
  const { 
    indicator_key, symbol, 
    total_confirmed, wins_when_confirmed, losses_when_confirmed,
    total_profit, total_loss
  } = record;

  // Basic Metrics
  const totalTradesQuandoConfirmado = wins_when_confirmed + losses_when_confirmed; // might differ from total_confirmed if some are tie/breakeven, but we'll use wins+losses
  const winRate = totalTradesQuandoConfirmado > 0 ? (wins_when_confirmed / totalTradesQuandoConfirmado) * 100 : 0;
  const profitFactor = total_loss > 0 ? total_profit / total_loss : (total_profit > 0 ? 99 : 0);

  // Insufficient Data
  if (totalTradesQuandoConfirmado < MIN_TRADES_FOR_CONFIDENCE) {
    return {
      indicatorKey: indicator_key as IndicatorKey,
      symbol,
      winRate,
      profitFactor,
      totalTrades: totalTradesQuandoConfirmado,
      winRateScore: 0,
      pfScore: 0,
      volumeScore: 0,
      consistencyScore: 0,
      finalScore: 0,
      label: 'insufficient_data',
      stars: '⏳',
      recommendation: 'Necessita mais dados (>10 trades)'
    };
  }

  // Calculate Sub-scores
  
  // 1. Win Rate Score (0-40)
  // Baseline 50% = 0 pts, 80%+ = 40 pts
  let winRateScore = 0;
  if (winRate >= 50) {
    winRateScore = Math.min(40, ((winRate - 50) / 30) * 40);
  }

  // 2. Profit Factor Score (0-30)
  // Baseline 1.0 = 0 pts, 3.0+ = 30 pts
  let pfScore = 0;
  if (profitFactor >= 1.0) {
    pfScore = Math.min(30, ((profitFactor - 1.0) / 2.0) * 30);
  }

  // 3. Volume/Sample Size Score (0-20)
  // Baseline 10 = 0 pts, 50 = 20 pts
  let volumeScore = 0;
  if (totalTradesQuandoConfirmado >= 10) {
    volumeScore = Math.min(20, ((totalTradesQuandoConfirmado - 10) / 40) * 20);
  }

  // 4. Consistency Score (0-10)
  // Heuristic: if win rate is high and profit factor is also high, they agree -> highly consistent
  // Also, penalize if losses_when_not_confirmed is low (meaning it also wins a lot when NOT confirmed, so it's not a strong signal)
  let consistencyScore = 5; // Default average
  const notConfirmedTrades = record.wins_when_not_confirmed + record.losses_when_not_confirmed;
  if (notConfirmedTrades > 0) {
    const notConfirmedWinRate = (record.wins_when_not_confirmed / notConfirmedTrades) * 100;
    if (winRate - notConfirmedWinRate > 15) {
      // Much better when confirmed -> +5
      consistencyScore += 5;
    } else if (notConfirmedWinRate >= winRate) {
      // Actually wins more when NOT confirmed -> penalize -5
      consistencyScore = Math.max(0, consistencyScore - 5);
    }
  } else {
    consistencyScore = 8; // Good if we don't have contrary data
  }

  const finalScore = Math.min(100, Math.max(0, winRateScore + pfScore + volumeScore + consistencyScore));

  let label: 'excellent' | 'good' | 'average' | 'poor' = 'poor';
  let stars = '⚠️';
  let recommendation = 'Reduzir peso ou desativar';

  if (finalScore >= 80) {
    label = 'excellent';
    stars = '⭐⭐⭐';
    recommendation = 'Manter peso alto (Confiável)';
  } else if (finalScore >= 60) {
    label = 'good';
    stars = '⭐⭐';
    recommendation = 'Bom indicador para este par';
  } else if (finalScore >= 40) {
    label = 'average';
    stars = '⭐';
    recommendation = 'Peso moderado / Opcional';
  }

  return {
    indicatorKey: indicator_key as IndicatorKey,
    symbol,
    winRate,
    profitFactor,
    totalTrades: totalTradesQuandoConfirmado,
    winRateScore,
    pfScore,
    volumeScore,
    consistencyScore,
    finalScore,
    label,
    stars,
    recommendation
  };
};

/**
 * Aggregates individual records into a full Symbol Performance Summary.
 */
export const computeSymbolSummary = (symbol: string, records: IndicatorPerformanceRecord[]): SymbolPerformanceSummary => {
  const scored = records.map(computeEfficacyScore);
  
  // Sort by final score descending
  scored.sort((a, b) => b.finalScore - a.finalScore);

  const sufficientData = scored.filter(s => s.label !== 'insufficient_data');
  const insufficientData = scored.filter(s => s.label === 'insufficient_data');

  const topIndicators = sufficientData.filter(s => s.finalScore >= 60);
  const weakIndicators = sufficientData.filter(s => s.finalScore < 60);

  // Global metrics across all confirmed indicators
  let totalGlobalWins = 0;
  let totalGlobalLosses = 0;
  let totalGlobalProfit = 0;
  let totalGlobalLossVal = 0;
  // This is an approximation since trades overlap, but provides a blended view
  let totalUniqueTradesApproximation = 0;

  records.forEach(r => {
    totalGlobalWins += r.wins_when_confirmed;
    totalGlobalLosses += r.losses_when_confirmed;
    totalGlobalProfit += r.total_profit;
    totalGlobalLossVal += r.total_loss;
    totalUniqueTradesApproximation = Math.max(totalUniqueTradesApproximation, r.wins_when_confirmed + r.losses_when_confirmed);
  });

  const globalTrades = totalGlobalWins + totalGlobalLosses;
  const globalWinRate = globalTrades > 0 ? (totalGlobalWins / globalTrades) * 100 : 0;
  const globalProfitFactor = totalGlobalLossVal > 0 ? totalGlobalProfit / totalGlobalLossVal : (totalGlobalProfit > 0 ? 99 : 0);

  return {
    symbol,
    totalTrades: totalUniqueTradesApproximation, 
    globalWinRate,
    globalProfitFactor,
    topIndicators,
    weakIndicators,
    insufficientDataIndicators: insufficientData,
    lastUpdate: Date.now()
  };
};

/**
 * Auto-generates an optimized StrategyProfile based on top performing indicators.
 */
export const generateOptimizedProfile = (summary: SymbolPerformanceSummary): StrategyProfile => {
  const { symbol, topIndicators, weakIndicators } = summary;
  
  const optimizedProfile: StrategyProfile = {
    id: `auto-${symbol.toLowerCase()}-${Date.now()}`,
    name: `${symbol} Otimizado (Auto)`,
    description: `Gerado automaticamente via ML/Análise baseado em histórico. WR Geral: ${summary.globalWinRate.toFixed(1)}%`,
    isPreset: false,
    indicators: {} as unknown as IndicatorsMap
  };

  // Top indicators get activated and weighted by score
  topIndicators.slice(0, 10).forEach(score => {
    // Score maps 60-100 to Weights 50-100 logically
    const autoWeight = Math.min(100, Math.max(50, Math.round(score.finalScore)));
    optimizedProfile.indicators[score.indicatorKey] = {
      active: true,
      weight: autoWeight
    };
  });

  // Weak indicators explicitly deactivated
  weakIndicators.forEach(score => {
    optimizedProfile.indicators[score.indicatorKey] = {
      active: false,
      weight: 0
    };
  });

  return optimizedProfile;
};
