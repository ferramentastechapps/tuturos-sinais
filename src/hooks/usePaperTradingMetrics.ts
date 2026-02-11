// ═══════════════════════════════════════════════════════════
// usePaperTradingMetrics — Derived performance metrics hook
// ═══════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { PaperPortfolioState, PaperMetrics, PaperReadiness, PaperBacktestComparison } from '@/types/paperTrading';
import { calculatePaperMetrics, calculateReadiness, compareWithBacktest } from '@/services/paperTrading/paperPortfolio';
import { getLatestResult } from '@/services/backtestService';

export const usePaperTradingMetrics = (state: PaperPortfolioState | null) => {
    const metrics: PaperMetrics | null = useMemo(() => {
        if (!state) return null;
        return calculatePaperMetrics(state.history, state.config.initialBalance, state.balance);
    }, [state]);

    const readiness: PaperReadiness | null = useMemo(() => {
        if (!state || !metrics) return null;
        const r = calculateReadiness(metrics, state.history, state.config.startDate);

        // Update backtest similarity criterion dynamically
        const backtestResult = getLatestResult();
        if (backtestResult) {
            const comp = compareWithBacktest(metrics, backtestResult);
            if (comp) {
                const criterion = r.criteria.find(c => c.id === 'backtest_similarity');
                if (criterion) {
                    const maxDev = Math.max(comp.winRateDeviation, comp.drawdownDeviation);
                    criterion.currentValue = `${maxDev.toFixed(1)}%`;
                    criterion.passed = !comp.hasDivergence;
                    // Recalculate counts
                    r.passedCount = r.criteria.filter(c => c.passed).length;
                    if (r.passedCount === r.totalCount) {
                        r.status = 'ready';
                    } else if (r.passedCount >= Math.ceil(r.totalCount * 0.7)) {
                        r.status = 'almost_ready';
                    } else {
                        r.status = 'not_ready';
                    }
                }
            }
        }

        return r;
    }, [state, metrics]);

    const backtestComparison: PaperBacktestComparison | null = useMemo(() => {
        if (!metrics) return null;
        return compareWithBacktest(metrics, getLatestResult());
    }, [metrics]);

    return { metrics, readiness, backtestComparison };
};
