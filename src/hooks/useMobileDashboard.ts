import { useState, useMemo } from 'react';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { useRealTimeSignals } from '@/hooks/useRealTimeSignals';
import { useIndicatorPerformance } from '@/hooks/useIndicatorPerformance';
import { enrichSignalWithPerformance } from '@/utils/performanceEnricher';
import { getCoinSignalScores } from '@/services/dashboardDataService';
import { CryptoPair } from '@/types/trading';
import { usePaperTrading } from '@/hooks/usePaperTrading';

/**
 * Shared state hook for all mobile dashboard pages.
 * Provides crypto prices, enriched signals, and selected pair.
 */
export const useMobileDashboard = () => {
  const { data: cryptoPairs = [], isLoading } = useCryptoPrices();
  const [selectedPair, setSelectedPair] = useState<CryptoPair | null>(null);

  const { data: allSignals = [] } = useRealTimeSignals({ limit: 50 });
  const { getSymbolAnalysis } = useIndicatorPerformance();
  const { state: paperState, metrics: paperMetrics } = usePaperTrading();

  const enrichedSignals = useMemo(() => {
    if (!Array.isArray(allSignals)) return [];
    return allSignals.map(signal => {
      const summary = getSymbolAnalysis(signal.pair);
      return enrichSignalWithPerformance(signal, summary);
    });
  }, [allSignals, getSymbolAnalysis]);

  const coinScores = useMemo(
    () => getCoinSignalScores(cryptoPairs, enrichedSignals),
    [cryptoPairs, enrichedSignals]
  );

  const effectivePair = selectedPair ?? cryptoPairs[0] ?? null;

  const activeSignals = useMemo(
    () => enrichedSignals.filter(s => s.status === 'active' || s.status === 'pending'),
    [enrichedSignals]
  );

  const portfolioSummary = useMemo(() => ({
    totalValue: paperState?.equity ?? 100,
    totalPnL: paperMetrics?.totalPnL ?? 0,
    totalPnLPercent: paperMetrics?.totalPnLPercent ?? 0,
    pnlToday: paperMetrics?.pnlToday ?? 0,
    positions: paperState?.positions ?? [],
  }), [paperState, paperMetrics]);

  return {
    cryptoPairs,
    isLoading,
    selectedPair: effectivePair,
    setSelectedPair,
    enrichedSignals,
    activeSignals,
    coinScores,
    portfolioSummary,
  };
};
