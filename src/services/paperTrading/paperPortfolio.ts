// ═══════════════════════════════════════════════════════════
// Paper Portfolio — Metrics, readiness, and analysis
// ═══════════════════════════════════════════════════════════

import {
    PaperOrder,
    PaperMetrics,
    PaperReadiness,
    ReadinessCriterion,
    ReadinessStatus,
    PaperEquityPoint,
    PaperBacktestComparison,
} from '@/types/paperTrading';
import { BacktestResult } from '@/types/backtestTypes';

// ──────────── Metrics Calculation ────────────

export const calculatePaperMetrics = (
    history: PaperOrder[],
    initialBalance: number,
    currentBalance: number,
): PaperMetrics => {
    if (history.length === 0) {
        return emptyMetrics();
    }

    const wins = history.filter(t => t.netPnl > 0);
    const losses = history.filter(t => t.netPnl <= 0);
    const longs = history.filter(t => t.direction === 'long');
    const shorts = history.filter(t => t.direction === 'short');
    const longWins = longs.filter(t => t.netPnl > 0);
    const shortWins = shorts.filter(t => t.netPnl > 0);

    const totalPnL = currentBalance - initialBalance;
    const totalPnLPercent = (totalPnL / initialBalance) * 100;

    const grossProfit = wins.reduce((s, t) => s + t.netPnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));

    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

    // Sharpe Ratio (simplified: annualized using daily returns assumption)
    const returns = history.map(t => t.pnlPercent);
    const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
    const stdDev = Math.sqrt(
        returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    // Max Drawdown
    const { maxDD, maxDDPercent } = calculateMaxDrawdown(history, initialBalance);

    // Consecutive wins/losses
    const { maxConsecWins, maxConsecLosses } = calculateStreaks(history);

    // Period PnL
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const pnlToday = history.filter(t => t.exitTime >= dayAgo).reduce((s, t) => s + t.netPnl, 0);
    const pnlWeek = history.filter(t => t.exitTime >= weekAgo).reduce((s, t) => s + t.netPnl, 0);
    const pnlMonth = history.filter(t => t.exitTime >= monthAgo).reduce((s, t) => s + t.netPnl, 0);

    return {
        totalTrades: history.length,
        winningTrades: wins.length,
        losingTrades: losses.length,
        winRate: (wins.length / history.length) * 100,
        winRateLong: longs.length > 0 ? (longWins.length / longs.length) * 100 : 0,
        winRateShort: shorts.length > 0 ? (shortWins.length / shorts.length) * 100 : 0,
        totalPnL,
        totalPnLPercent,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
        sharpeRatio: Number(sharpeRatio.toFixed(2)),
        maxDrawdown: maxDD,
        maxDrawdownPercent: maxDDPercent,
        avgWin,
        avgLoss,
        expectancy: avgWin * (wins.length / history.length) - avgLoss * (losses.length / history.length),
        largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.netPnl)) : 0,
        largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.netPnl)) : 0,
        maxConsecutiveWins: maxConsecWins,
        maxConsecutiveLosses: maxConsecLosses,
        totalFees: history.reduce((s, t) => s + t.fees, 0),
        totalFunding: history.reduce((s, t) => s + t.fundingPaid, 0),
        pnlToday,
        pnlWeek,
        pnlMonth,
    };
};

// ──────────── Max Drawdown ────────────

const calculateMaxDrawdown = (
    history: PaperOrder[],
    initialBalance: number,
): { maxDD: number; maxDDPercent: number } => {
    let peak = initialBalance;
    let maxDD = 0;
    let maxDDPercent = 0;
    let equity = initialBalance;

    const sorted = [...history].sort((a, b) => a.exitTime - b.exitTime);
    for (const trade of sorted) {
        equity += trade.netPnl;
        if (equity > peak) peak = equity;
        const dd = peak - equity;
        if (dd > maxDD) {
            maxDD = dd;
            maxDDPercent = (dd / peak) * 100;
        }
    }

    return { maxDD, maxDDPercent };
};

// ──────────── Streaks ────────────

const calculateStreaks = (history: PaperOrder[]): { maxConsecWins: number; maxConsecLosses: number } => {
    let maxConsecWins = 0;
    let maxConsecLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    const sorted = [...history].sort((a, b) => a.exitTime - b.exitTime);
    for (const trade of sorted) {
        if (trade.netPnl > 0) {
            currentWins++;
            currentLosses = 0;
            maxConsecWins = Math.max(maxConsecWins, currentWins);
        } else {
            currentLosses++;
            currentWins = 0;
            maxConsecLosses = Math.max(maxConsecLosses, currentLosses);
        }
    }

    return { maxConsecWins, maxConsecLosses };
};

// ──────────── Equity Curve ────────────

export const calculateEquityCurve = (
    history: PaperOrder[],
    initialBalance: number,
): PaperEquityPoint[] => {
    const points: PaperEquityPoint[] = [{
        timestamp: history.length > 0 ? history[0].entryTime : Date.now(),
        equity: initialBalance,
        balance: initialBalance,
        openPositions: 0,
    }];

    let balance = initialBalance;
    const sorted = [...history].sort((a, b) => a.exitTime - b.exitTime);

    for (const trade of sorted) {
        balance += trade.netPnl;
        points.push({
            timestamp: trade.exitTime,
            equity: balance,
            balance,
            openPositions: 0,
        });
    }

    return points;
};

// ──────────── Readiness Check ────────────

export const calculateReadiness = (
    metrics: PaperMetrics,
    history: PaperOrder[],
    startDate: string,
): PaperReadiness => {
    const daysSinceStart = Math.floor(
        (Date.now() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000)
    );

    const avgMLProb = history.length > 0
        ? history.reduce((s, t) => s + t.mlProbability, 0) / history.length
        : 0;

    const criteria: ReadinessCriterion[] = [
        {
            id: 'min_trades',
            label: 'Mínimo 50 operações',
            target: '≥ 50',
            currentValue: metrics.totalTrades,
            passed: metrics.totalTrades >= 50,
        },
        {
            id: 'win_rate',
            label: 'Win Rate ≥ 55%',
            target: '≥ 55%',
            currentValue: `${metrics.winRate.toFixed(1)}%`,
            passed: metrics.winRate >= 55,
        },
        {
            id: 'profit_factor',
            label: 'Profit Factor ≥ 1.3',
            target: '≥ 1.3',
            currentValue: metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2),
            passed: metrics.profitFactor >= 1.3,
        },
        {
            id: 'max_drawdown',
            label: 'Drawdown máximo ≤ 15%',
            target: '≤ 15%',
            currentValue: `${metrics.maxDrawdownPercent.toFixed(1)}%`,
            passed: metrics.maxDrawdownPercent <= 15,
        },
        {
            id: 'min_days',
            label: 'Mínimo 30 dias de paper trading',
            target: '≥ 30 dias',
            currentValue: `${daysSinceStart} dias`,
            passed: daysSinceStart >= 30,
        },
        {
            id: 'ml_probability',
            label: 'ML probability média ≥ 65%',
            target: '≥ 65%',
            currentValue: `${avgMLProb.toFixed(1)}%`,
            passed: avgMLProb >= 65,
        },
        {
            id: 'backtest_similarity',
            label: 'Performance similar ao backtesting (< 15% desvio)',
            target: '< 15%',
            currentValue: 'N/A', // requires backtest comparison
            passed: false, // calculated separately with backtest data
        },
    ];

    const passedCount = criteria.filter(c => c.passed).length;
    const totalCount = criteria.length;

    let status: ReadinessStatus = 'not_ready';
    if (passedCount === totalCount) {
        status = 'ready';
    } else if (passedCount >= Math.ceil(totalCount * 0.7)) {
        status = 'almost_ready';
    }

    return { status, criteria, passedCount, totalCount };
};

// ──────────── Backtest Comparison ────────────

export const compareWithBacktest = (
    metrics: PaperMetrics,
    backtestResult: BacktestResult | null,
): PaperBacktestComparison | null => {
    if (!backtestResult) return null;

    const bt = backtestResult.metrics;
    const winRateDev = Math.abs(metrics.winRate - bt.main.winRate);
    const pfDev = Math.abs(metrics.profitFactor - bt.risk.profitFactor);
    const ddDev = Math.abs(metrics.maxDrawdownPercent - bt.risk.maxDrawdownPercent);

    const warnings: string[] = [];
    if (winRateDev > 15) warnings.push(`Win Rate divergindo ${winRateDev.toFixed(1)}% do backtest`);
    if (pfDev > 0.5) warnings.push(`Profit Factor divergindo do backtest`);
    if (ddDev > 15) warnings.push(`Drawdown divergindo ${ddDev.toFixed(1)}% do backtest`);

    return {
        paperWinRate: metrics.winRate,
        backtestWinRate: bt.main.winRate,
        winRateDeviation: winRateDev,
        paperProfitFactor: metrics.profitFactor,
        backtestProfitFactor: bt.risk.profitFactor,
        profitFactorDeviation: pfDev,
        paperDrawdown: metrics.maxDrawdownPercent,
        backtestDrawdown: bt.risk.maxDrawdownPercent,
        drawdownDeviation: ddDev,
        hasDivergence: warnings.length > 0,
        divergenceWarnings: warnings,
    };
};

// ──────────── Empty Metrics ────────────

const emptyMetrics = (): PaperMetrics => ({
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    winRateLong: 0,
    winRateShort: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
    profitFactor: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    avgWin: 0,
    avgLoss: 0,
    expectancy: 0,
    largestWin: 0,
    largestLoss: 0,
    maxConsecutiveWins: 0,
    maxConsecutiveLosses: 0,
    totalFees: 0,
    totalFunding: 0,
    pnlToday: 0,
    pnlWeek: 0,
    pnlMonth: 0,
});
