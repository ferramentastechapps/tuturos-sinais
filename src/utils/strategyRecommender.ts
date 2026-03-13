// ═══════════════════════════════════════════════════════════
// Strategy Recommender — Deterministic indicator analysis
// ═══════════════════════════════════════════════════════════

import { StrategyProfile, IndicatorKey, RecommendationResult, IndicatorRecommendation, INDICATOR_REGISTRY } from '@/types/strategyTypes';
import { BacktestTrade } from '@/types/backtestTypes';

interface IndicatorStats {
  appearances: number;
  wins: number;
  losses: number;
  totalPnl: number;
}

const mapSignalNameToKey = (signalName: string): IndicatorKey | null => {
  const name = signalName.toLowerCase();
  if (name.includes('rsi diverg') || name.includes('divergência')) return 'rsiDivergence';
  if (name.includes('rsi')) return 'rsi';
  if (name.includes('macd cross') || name.includes('cruzamento')) return 'macdCross';
  if (name.includes('macd')) return 'macd';
  if (name.includes('bollinger squeeze') || name.includes('squeeze')) return 'bollingerSqueeze';
  if (name.includes('bollinger')) return 'bollingerBands';
  if (name.includes('stoch')) return 'stochasticRsi';
  if (name.includes('cvd divergência')) return 'cvdDivergence';
  if (name.includes('cvd')) return 'cvd';
  if (name.includes('vwap')) return 'vwap';
  if (name.includes('volume')) return 'volumeAboveAvg';
  if (name.includes('ema 200') || name.includes('ema200')) return 'ema200';
  if (name.includes('ema 50') || name.includes('ema50')) return 'ema50';
  if (name.includes('ema 21') || name.includes('ema21')) return 'ema21';
  if (name.includes('ema 9') || name.includes('ema9')) return 'ema9';
  if (name.includes('golden cross') || name.includes('death cross')) return 'goldenDeathCross';
  if (name.includes('order block') || name.includes('ob')) return 'orderBlocks';
  if (name.includes('fvg') || name.includes('fair value')) return 'fairValueGaps';
  if (name.includes('liquidity') || name.includes('liquidez')) return 'liquidityZones';
  if (name.includes('bos') || name.includes('break of structure') || name.includes('quebra')) return 'breakOfStructure';
  if (name.includes('choch') || name.includes('change of character') || name.includes('mudança')) return 'changeOfCharacter';
  if (name.includes('market structure') || name.includes('estrutura')) return 'marketStructure';
  if (name.includes('funding')) return 'fundingRateExtreme';
  if (name.includes('oi divergência') || name.includes('oi div')) return 'oiDivergence';
  if (name.includes('open interest crescendo')) return 'openInterestGrowing';
  if (name.includes('open interest cai')) return 'openInterestFalling';
  if (name.includes('long/short') || name.includes('ratio')) return 'longShortRatioExtreme';
  if (name.includes('liquidação') || name.includes('liquidation')) return 'extremeLiquidations';
  if (name.includes('poc') || name.includes('volume profile')) return 'volumeProfilePoc';
  if (name.includes('engolfo') || name.includes('engulfing')) return 'engulfing';
  if (name.includes('pin bar') || name.includes('hammer') || name.includes('shooting star')) return 'pinBar';
  if (name.includes('doji')) return 'doji';
  if (name.includes('morning star') || name.includes('evening star')) return 'morningEveningStar';
  if (name.includes('suporte') || name.includes('support')) return 'supportZone';
  if (name.includes('resistência') || name.includes('resistance')) return 'resistanceZone';
  if (name.includes('fibonacci') || name.includes('fib')) return 'fibonacciLevels';
  if (name.includes('adx')) return 'adx';
  if (name.includes('atr')) return 'atr';
  return null;
};

export const analyzeProfilePerformance = (
  trades: BacktestTrade[],
  profile: StrategyProfile
): RecommendationResult => {
  if (trades.length < 5) {
    return {
      profileId: profile.id,
      profileName: profile.name,
      tradesAnalyzed: trades.length,
      recommendations: [],
      simulatedWinRate: 0,
      currentWinRate: 0,
      simulatedProfitFactor: 0,
      currentProfitFactor: 0,
      hasRecommendations: false,
    };
  }

  // Build stats per indicator key from trades
  const statsMap: Record<string, IndicatorStats> = {};

  for (const trade of trades) {
    const isWin = trade.netPnl > 0;
    for (const signalName of trade.signalIndicators || []) {
      const key = mapSignalNameToKey(signalName);
      if (!key) continue;
      if (!statsMap[key]) statsMap[key] = { appearances: 0, wins: 0, losses: 0, totalPnl: 0 };
      statsMap[key].appearances++;
      if (isWin) statsMap[key].wins++;
      else statsMap[key].losses++;
      statsMap[key].totalPnl += trade.netPnl;
    }
  }

  // Current metrics
  const winners = trades.filter(t => t.netPnl > 0);
  const losers = trades.filter(t => t.netPnl < 0);
  const totalWinPnl = winners.reduce((s, t) => s + t.netPnl, 0);
  const totalLossPnl = Math.abs(losers.reduce((s, t) => s + t.netPnl, 0));
  const currentWinRate = (winners.length / trades.length) * 100;
  const currentProfitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : 0;

  // Build recommendations
  const recommendations: IndicatorRecommendation[] = [];

  for (const [keyStr, stats] of Object.entries(statsMap)) {
    const key = keyStr as IndicatorKey;
    const meta = INDICATOR_REGISTRY.find(m => m.key === key);
    if (!meta) continue;
    if (stats.appearances < 3) continue;

    const indConfig = profile.indicators[key];
    const winRate = (stats.wins / stats.appearances) * 100;
    const currentWeight = indConfig?.weight || 0;
    const currentActive = indConfig?.active || false;

    let action: IndicatorRecommendation['action'] = 'keep';
    let suggestedWeight = currentWeight;
    let suggestedActive = currentActive;
    let reason = '';

    if (winRate < 35 && currentActive) {
      action = stats.appearances > 8 ? 'disable' : 'decrease_weight';
      suggestedWeight = Math.max(0, currentWeight - 20);
      suggestedActive = stats.appearances > 8 ? false : currentActive;
      reason = `Win rate de apenas ${winRate.toFixed(0)}% em ${stats.appearances} aparições — considera desativar ou reduzir peso.`;
    } else if (winRate > 70 && currentActive) {
      action = 'increase_weight';
      suggestedWeight = Math.min(100, currentWeight + 15);
      reason = `Win rate de ${winRate.toFixed(0)}% em ${stats.appearances} aparições — alto desempenho, aumente o peso.`;
    } else if (winRate < 45 && currentActive) {
      action = 'decrease_weight';
      suggestedWeight = Math.max(10, currentWeight - 10);
      reason = `Win rate moderado de ${winRate.toFixed(0)}% — considere reduzir o peso levemente.`;
    }

    if (action !== 'keep') {
      recommendations.push({
        indicatorKey: key,
        indicatorLabel: meta.label,
        currentWeight,
        suggestedWeight,
        currentActive,
        suggestedActive,
        winRate,
        appearances: stats.appearances,
        action,
        reason,
      });
    }
  }

  // Sort: most impactful first (lowest win rate first for issues, highest for boosts)
  recommendations.sort((a, b) => {
    if (a.action === 'disable' || a.action === 'decrease_weight') return -1;
    return 1;
  });

  // Simulate win rate improvement (rough estimate)
  const disabledCount = recommendations.filter(r => !r.suggestedActive && r.currentActive).length;
  const simulatedWinRate = Math.min(currentWinRate + disabledCount * 2.5, 95);
  const simulatedProfitFactor = Math.min(currentProfitFactor * (1 + disabledCount * 0.05), 5);

  return {
    profileId: profile.id,
    profileName: profile.name,
    tradesAnalyzed: trades.length,
    recommendations: recommendations.slice(0, 6),
    simulatedWinRate,
    currentWinRate,
    simulatedProfitFactor,
    currentProfitFactor,
    hasRecommendations: recommendations.length > 0,
  };
};
