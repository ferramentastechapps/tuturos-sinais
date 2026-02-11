// ═══════════════════════════════════════════════════════════
// Backtest Analyzer — Comprehensive Metrics Calculator
// Processes trade list into detailed performance analysis
// ═══════════════════════════════════════════════════════════

import {
    BacktestTrade, EquityPoint, BacktestMetrics, BacktestConfig,
    MainMetrics, RiskMetrics, TimeMetrics, SignalMetrics,
    MonthlyPerformance, DayPerformance, HourPerformance,
    SignalContribution, SignalCombination, BuyAndHoldComparison,
} from '@/types/backtestTypes';
import { OHLCPoint } from '@/services/coingeckoOHLC';

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// ──────────── Main Analysis ────────────

export const analyzeBacktestResults = (
    trades: BacktestTrade[],
    equityCurve: EquityPoint[],
    config: BacktestConfig
): BacktestMetrics => {
    return {
        main: calculateMainMetrics(trades, config),
        risk: calculateRiskMetrics(trades, equityCurve, config),
        time: calculateTimeMetrics(trades),
        signal: calculateSignalMetrics(trades),
    };
};

// ──────────── Main Metrics ────────────

const calculateMainMetrics = (trades: BacktestTrade[], config: BacktestConfig): MainMetrics => {
    const wins = trades.filter(t => t.netPnl > 0);
    const losses = trades.filter(t => t.netPnl <= 0);
    const longs = trades.filter(t => t.type === 'long');
    const shorts = trades.filter(t => t.type === 'short');
    const longWins = longs.filter(t => t.netPnl > 0);
    const shortWins = shorts.filter(t => t.netPnl > 0);

    const totalPnL = trades.reduce((sum, t) => sum + t.netPnl, 0);
    const totalFees = trades.reduce((sum, t) => sum + t.fees, 0);
    const totalFunding = trades.reduce((sum, t) => sum + t.fundingPaid, 0);

    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.netPnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.netPnl, 0) / losses.length) : 0;
    const avgWinPct = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPercent, 0) / wins.length : 0;
    const avgLossPct = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnlPercent, 0) / losses.length) : 0;

    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
    const winRateLong = longs.length > 0 ? (longWins.length / longs.length) * 100 : 0;
    const winRateShort = shorts.length > 0 ? (shortWins.length / shorts.length) * 100 : 0;

    // Expectancy = (WinRate * AvgWin) - (LossRate * AvgLoss)
    const winProb = wins.length / (trades.length || 1);
    const lossProb = losses.length / (trades.length || 1);
    const expectancy = (winProb * avgWin) - (lossProb * avgLoss);

    const pnlValues = trades.map(t => t.netPnl);
    const largestWin = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
    const largestLoss = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;

    return {
        initialCapital: config.initialCapital,
        finalCapital: config.initialCapital + totalPnL,
        totalPnL,
        totalPnLPercent: (totalPnL / config.initialCapital) * 100,
        totalTrades: trades.length,
        winningTrades: wins.length,
        losingTrades: losses.length,
        winRate,
        winRateLong,
        winRateShort,
        totalLongTrades: longs.length,
        totalShortTrades: shorts.length,
        avgWin,
        avgLoss,
        avgWinPercent: avgWinPct,
        avgLossPercent: avgLossPct,
        largestWin,
        largestLoss,
        expectancy,
        totalFees,
        totalFundingPaid: totalFunding,
    };
};

// ──────────── Risk Metrics ────────────

const calculateRiskMetrics = (
    trades: BacktestTrade[],
    equityCurve: EquityPoint[],
    config: BacktestConfig
): RiskMetrics => {
    // Max Drawdown from equity curve
    let peak = -Infinity;
    let maxDD = 0;
    let maxDDPercent = 0;
    let maxDDStart = 0;
    let maxDDEnd = 0;
    let ddStartCandidate = 0;

    for (const point of equityCurve) {
        if (point.equity > peak) {
            peak = point.equity;
            ddStartCandidate = point.timestamp;
        }
        const dd = peak - point.equity;
        const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
        if (ddPct > maxDDPercent) {
            maxDD = dd;
            maxDDPercent = ddPct;
            maxDDStart = ddStartCandidate;
            maxDDEnd = point.timestamp;
        }
    }

    // Sharpe Ratio (annualized, using daily returns)
    const dailyReturns = calculateDailyReturns(equityCurve);
    const sharpe = calculateSharpeRatio(dailyReturns);

    // Sortino Ratio
    const sortino = calculateSortinoRatio(dailyReturns);

    // Calmar Ratio = Annual Return / Max Drawdown
    const totalPnL = trades.reduce((s, t) => s + t.netPnl, 0);
    const totalPnLPct = (totalPnL / config.initialCapital) * 100;
    const daysInTest = equityCurve.length > 1
        ? (equityCurve[equityCurve.length - 1].timestamp - equityCurve[0].timestamp) / (24 * 60 * 60 * 1000)
        : 1;
    const annualizedReturn = (totalPnLPct / Math.max(daysInTest, 1)) * 365;
    const calmar = maxDDPercent > 0 ? annualizedReturn / maxDDPercent : 0;

    // Profit Factor
    const grossProfit = trades.filter(t => t.netPnl > 0).reduce((s, t) => s + t.netPnl, 0);
    const grossLoss = Math.abs(trades.filter(t => t.netPnl <= 0).reduce((s, t) => s + t.netPnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Recovery Factor = Total PnL / Max Drawdown
    const recoveryFactor = maxDD > 0 ? totalPnL / maxDD : 0;

    // Average R:R
    const rrValues = trades.map(t => {
        if (t.netPnl > 0) {
            const risk = Math.abs(t.maxAdverseExcursion) || 1;
            return t.pnlPercent / risk;
        }
        return -(Math.abs(t.pnlPercent) / (t.maxFavorableExcursion || 1));
    });
    const avgRR = rrValues.length > 0 ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : 0;

    return {
        maxDrawdown: maxDD,
        maxDrawdownPercent: maxDDPercent,
        maxDrawdownStart: maxDDStart,
        maxDrawdownEnd: maxDDEnd,
        maxDrawdownDuration: maxDDEnd - maxDDStart,
        sharpeRatio: sharpe,
        sortinoRatio: sortino,
        calmarRatio: calmar,
        profitFactor,
        recoveryFactor,
        avgRiskReward: avgRR,
    };
};

const calculateDailyReturns = (equityCurve: EquityPoint[]): number[] => {
    if (equityCurve.length < 2) return [];

    const dailyMap = new Map<string, number>();

    for (const point of equityCurve) {
        const dateKey = new Date(point.timestamp).toISOString().split('T')[0];
        dailyMap.set(dateKey, point.equity);
    }

    const dates = Array.from(dailyMap.keys()).sort();
    const returns: number[] = [];

    for (let i = 1; i < dates.length; i++) {
        const prev = dailyMap.get(dates[i - 1])!;
        const curr = dailyMap.get(dates[i])!;
        if (prev > 0) {
            returns.push((curr - prev) / prev);
        }
    }

    return returns;
};

const calculateSharpeRatio = (dailyReturns: number[]): number => {
    if (dailyReturns.length < 2) return 0;

    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (dailyReturns.length - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    // Annualize: sqrt(365) for crypto (trades 365 days)
    return (mean / stdDev) * Math.sqrt(365);
};

const calculateSortinoRatio = (dailyReturns: number[]): number => {
    if (dailyReturns.length < 2) return 0;

    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const negativeReturns = dailyReturns.filter(r => r < 0);

    if (negativeReturns.length === 0) return mean > 0 ? Infinity : 0;

    const downVariance = negativeReturns.reduce((s, r) => s + Math.pow(r, 2), 0) / negativeReturns.length;
    const downDev = Math.sqrt(downVariance);

    if (downDev === 0) return 0;

    return (mean / downDev) * Math.sqrt(365);
};

// ──────────── Time Metrics ────────────

const calculateTimeMetrics = (trades: BacktestTrade[]): TimeMetrics => {
    const wins = trades.filter(t => t.netPnl > 0);
    const losses = trades.filter(t => t.netPnl <= 0);

    // Average durations
    const avgWinDuration = wins.length > 0
        ? wins.reduce((s, t) => s + t.duration, 0) / wins.length : 0;
    const avgLossDuration = losses.length > 0
        ? losses.reduce((s, t) => s + t.duration, 0) / losses.length : 0;

    // Consecutive streaks
    let maxConsWins = 0, maxConsLosses = 0;
    let curWins = 0, curLosses = 0;
    for (const t of trades) {
        if (t.netPnl > 0) {
            curWins++;
            curLosses = 0;
            maxConsWins = Math.max(maxConsWins, curWins);
        } else {
            curLosses++;
            curWins = 0;
            maxConsLosses = Math.max(maxConsLosses, curLosses);
        }
    }

    // Monthly performance
    const monthlyMap = new Map<string, BacktestTrade[]>();
    for (const t of trades) {
        const d = new Date(t.entryTime);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (!monthlyMap.has(key)) monthlyMap.set(key, []);
        monthlyMap.get(key)!.push(t);
    }

    const monthlyPerformance: MonthlyPerformance[] = [];
    for (const [key, monthTrades] of monthlyMap) {
        const [year, month] = key.split('-').map(Number);
        const pnl = monthTrades.reduce((s, t) => s + t.netPnl, 0);
        const pnlPercent = monthTrades.reduce((s, t) => s + t.pnlPercent, 0);
        const monthWins = monthTrades.filter(t => t.netPnl > 0).length;
        monthlyPerformance.push({
            year,
            month,
            pnl,
            pnlPercent,
            trades: monthTrades.length,
            winRate: monthTrades.length > 0 ? (monthWins / monthTrades.length) * 100 : 0,
        });
    }
    monthlyPerformance.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

    const bestMonth = [...monthlyPerformance].sort((a, b) => b.pnl - a.pnl)[0] || { year: 0, month: 0, pnl: 0, pnlPercent: 0, trades: 0, winRate: 0 };
    const worstMonth = [...monthlyPerformance].sort((a, b) => a.pnl - b.pnl)[0] || { year: 0, month: 0, pnl: 0, pnlPercent: 0, trades: 0, winRate: 0 };

    // Day of week
    const dayMap = new Map<number, BacktestTrade[]>();
    for (let d = 0; d < 7; d++) dayMap.set(d, []);
    for (const t of trades) {
        const day = new Date(t.entryTime).getDay();
        dayMap.get(day)!.push(t);
    }
    const dayOfWeekPerformance: DayPerformance[] = Array.from(dayMap.entries()).map(([day, dayTrades]) => ({
        day,
        dayName: DAY_NAMES[day],
        pnl: dayTrades.reduce((s, t) => s + t.netPnl, 0),
        trades: dayTrades.length,
        winRate: dayTrades.length > 0 ? (dayTrades.filter(t => t.netPnl > 0).length / dayTrades.length) * 100 : 0,
    }));

    // Hour of day
    const hourMap = new Map<number, BacktestTrade[]>();
    for (let h = 0; h < 24; h++) hourMap.set(h, []);
    for (const t of trades) {
        const hour = new Date(t.entryTime).getHours();
        hourMap.get(hour)!.push(t);
    }
    const hourOfDayPerformance: HourPerformance[] = Array.from(hourMap.entries()).map(([hour, hourTrades]) => ({
        hour,
        pnl: hourTrades.reduce((s, t) => s + t.netPnl, 0),
        trades: hourTrades.length,
        winRate: hourTrades.length > 0 ? (hourTrades.filter(t => t.netPnl > 0).length / hourTrades.length) * 100 : 0,
    }));

    return {
        avgWinDuration,
        avgLossDuration,
        maxConsecutiveWins: maxConsWins,
        maxConsecutiveLosses: maxConsLosses,
        bestMonth,
        worstMonth,
        monthlyPerformance,
        dayOfWeekPerformance,
        hourOfDayPerformance,
    };
};

// ──────────── Signal Metrics ────────────

const calculateSignalMetrics = (trades: BacktestTrade[]): SignalMetrics => {
    const wins = trades.filter(t => t.netPnl > 0);
    const losses = trades.filter(t => t.netPnl <= 0);

    // Signal contribution
    const signalPnlMap = new Map<string, { pnl: number; appearances: number; wins: number }>();

    for (const t of trades) {
        for (const sig of t.signalIndicators) {
            if (!signalPnlMap.has(sig)) signalPnlMap.set(sig, { pnl: 0, appearances: 0, wins: 0 });
            const entry = signalPnlMap.get(sig)!;
            entry.pnl += t.netPnl;
            entry.appearances++;
            if (t.netPnl > 0) entry.wins++;
        }
    }

    const contributions: SignalContribution[] = Array.from(signalPnlMap.entries()).map(([signal, data]) => ({
        signal,
        appearances: data.appearances,
        totalPnl: data.pnl,
        winRate: data.appearances > 0 ? (data.wins / data.appearances) * 100 : 0,
    }));

    const topWinningSignals = [...contributions].sort((a, b) => b.totalPnl - a.totalPnl).slice(0, 10);
    const topLosingSignals = [...contributions].sort((a, b) => a.totalPnl - b.totalPnl).slice(0, 10);

    // Score averages
    const avgScoreWinners = wins.length > 0 ? wins.reduce((s, t) => s + t.signalScore, 0) / wins.length : 0;
    const avgScoreLosers = losses.length > 0 ? losses.reduce((s, t) => s + t.signalScore, 0) / losses.length : 0;
    const avgConfidenceWinners = wins.length > 0 ? wins.reduce((s, t) => s + t.signalConfidence, 0) / wins.length : 0;
    const avgConfidenceLosers = losses.length > 0 ? losses.reduce((s, t) => s + t.signalConfidence, 0) / losses.length : 0;

    // Best combinations (look at pairs of signals)
    const comboMap = new Map<string, { trades: number; wins: number; totalPnl: number }>();

    for (const t of trades) {
        const sigs = [...t.signalIndicators].sort();
        // Generate pairs
        for (let i = 0; i < sigs.length; i++) {
            for (let j = i + 1; j < sigs.length; j++) {
                const key = `${sigs[i]}+${sigs[j]}`;
                if (!comboMap.has(key)) comboMap.set(key, { trades: 0, wins: 0, totalPnl: 0 });
                const entry = comboMap.get(key)!;
                entry.trades++;
                entry.totalPnl += t.netPnl;
                if (t.netPnl > 0) entry.wins++;
            }
        }
    }

    const bestCombinations: SignalCombination[] = Array.from(comboMap.entries())
        .filter(([, data]) => data.trades >= 3) // Min 3 occurrences
        .map(([key, data]) => ({
            signals: key.split('+'),
            trades: data.trades,
            winRate: (data.wins / data.trades) * 100,
            avgPnl: data.totalPnl / data.trades,
            totalPnl: data.totalPnl,
        }))
        .sort((a, b) => b.totalPnl - a.totalPnl)
        .slice(0, 10);

    return {
        topWinningSignals,
        topLosingSignals,
        avgScoreWinners,
        avgScoreLosers,
        avgConfidenceWinners,
        avgConfidenceLosers,
        bestCombinations,
    };
};

// ──────────── Buy & Hold Comparison ────────────

export const calculateBuyAndHold = (
    ohlcData: OHLCPoint[],
    initialCapital: number,
    symbol: string
): BuyAndHoldComparison => {
    if (ohlcData.length < 2) {
        return {
            symbol, startPrice: 0, endPrice: 0, returnPercent: 0,
            equityCurve: [],
        };
    }

    const startPrice = ohlcData[0].close;
    const endPrice = ohlcData[ohlcData.length - 1].close;
    const returnPercent = ((endPrice - startPrice) / startPrice) * 100;

    const equityCurve: EquityPoint[] = ohlcData.map(candle => {
        const equity = initialCapital * (candle.close / startPrice);
        return {
            timestamp: candle.timestamp,
            equity,
            drawdown: 0,
            drawdownValue: 0,
            openPositions: 1,
        };
    });

    // Calculate drawdown for B&H
    let peak = 0;
    for (const point of equityCurve) {
        if (point.equity > peak) peak = point.equity;
        point.drawdownValue = peak - point.equity;
        point.drawdown = peak > 0 ? (point.drawdownValue / peak) * 100 : 0;
    }

    return { symbol, startPrice, endPrice, returnPercent, equityCurve };
};

// ──────────── CSV Export ────────────

export const exportTradesToCSV = (trades: BacktestTrade[]): string => {
    const headers = [
        'ID', 'Symbol', 'Type', 'Entry Time', 'Exit Time', 'Entry Price', 'Exit Price',
        'Quantity', 'Leverage', 'Gross PnL', 'Fees', 'Funding', 'Net PnL', 'PnL %',
        'Exit Reason', 'Signal Score', 'Confidence', 'Risk Score', 'MFE %', 'MAE %',
        'Duration (h)', 'Signals',
    ];

    const rows = trades.map(t => [
        t.id,
        t.symbol,
        t.type,
        new Date(t.entryTime).toISOString(),
        new Date(t.exitTime).toISOString(),
        t.entryPrice.toFixed(4),
        t.exitPrice.toFixed(4),
        t.quantity.toFixed(6),
        t.leverage,
        t.grossPnl.toFixed(2),
        t.fees.toFixed(2),
        t.fundingPaid.toFixed(2),
        t.netPnl.toFixed(2),
        t.pnlPercent.toFixed(2),
        t.exitReason,
        t.signalScore,
        t.signalConfidence,
        t.riskScore,
        t.maxFavorableExcursion.toFixed(2),
        t.maxAdverseExcursion.toFixed(2),
        (t.duration / (60 * 60 * 1000)).toFixed(1),
        t.signalIndicators.join('; '),
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
};
