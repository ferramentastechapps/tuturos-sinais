/**
 * Dashboard Data Service — Abstraction Layer
 * 
 * This service acts as the single source of truth for all dashboard data.
 * Components consume these interfaces without knowing whether data comes
 * from real exchange APIs or simulated sources.
 * 
 * === FUTURE INTEGRATION ===
 * To connect to a real exchange:
 * 1. Replace the simulated position/PnL generators with real API calls
 * 2. Implement WebSocket feeds for real-time position updates
 * 3. Connect to exchange order/position endpoints
 * 4. The component interfaces remain unchanged
 */

import { CryptoPair, TradeSignal } from '@/types/trading';

// ─── Interfaces (components consume these) ───────────────────────────

export interface DashboardPosition {
    id: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    currentPrice: number;
    quantity: number;
    leverage: number;
    pnl: number;
    pnlPercent: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2?: number;
    takeProfit3?: number;
    openedAt: Date;
    trailingStop: boolean;
    marginUsed: number;
}

export interface DashboardPnL {
    daily: number;
    dailyPercent: number;
    weekly: number;
    weeklyPercent: number;
    monthly: number;
    monthlyPercent: number;
}

export interface DashboardAccount {
    totalCapital: number;
    availableBalance: number;
    marginUsed: number;
    openPositions: number;
    pnl: DashboardPnL;
    isConnected: boolean;
}

export interface PerformanceStats {
    winRate: number;
    avgRR: number;
    totalTrades: number;
    winStreak: number;
    lossStreak: number;
    maxDrawdown: number;
    sharpeRatio: number;
    equityCurve: { date: string; value: number }[];
}

export interface CoinSignalScore {
    symbol: string;
    score: number;           // 0-100
    signalType: 'buy' | 'sell' | 'neutral';
    hasActiveSignal: boolean;
}

export interface ClosedTrade {
    id: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
    openedAt: Date;
    closedAt: Date;
    result: 'tp1' | 'tp2' | 'tp3' | 'sl' | 'manual';
}

// ─── Simulated Data Generators ───────────────────────────────────────
// TODO: Replace these with real exchange API calls

/**
 * Generate simulated open positions based on active signals and live prices.
 * Uses real prices from the API, only the positions themselves are simulated.
 */
export function generateSimulatedPositions(
    signals: TradeSignal[],
    livePrices: CryptoPair[]
): DashboardPosition[] {
    const activeSignals = signals.filter(s => s.status === 'active');

    return activeSignals.slice(0, 4).map((signal, i) => {
        const pair = livePrices.find(p => p.symbol === signal.pair);
        const currentPrice = pair?.price || signal.entry;
        const direction = signal.type === 'long' ? 'LONG' as const : 'SHORT' as const;

        const priceDiff = direction === 'LONG'
            ? currentPrice - signal.entry
            : signal.entry - currentPrice;
        const pnlPercent = (priceDiff / signal.entry) * 100;

        // Use realistic leverage based on signal confidence
        const leverage = signal.confidence > 80 ? 5 : signal.confidence > 60 ? 3 : 2;
        const quantity = (1000 / signal.entry) * leverage; // ~$1000 per position
        const pnl = priceDiff * quantity;

        return {
            id: `pos-${signal.id}`,
            symbol: signal.pair,
            direction,
            entryPrice: signal.entry,
            currentPrice,
            quantity,
            leverage,
            pnl,
            pnlPercent: pnlPercent * leverage,
            stopLoss: signal.stopLoss,
            takeProfit1: signal.takeProfit1 || signal.takeProfit,
            takeProfit2: signal.takeProfit2,
            takeProfit3: signal.takeProfit3,
            openedAt: signal.createdAt,
            trailingStop: signal.confidence > 75,
            marginUsed: 1000,
        };
    });
}

/**
 * Generate simulated account overview using live data.
 */
export function generateSimulatedAccount(
    positions: DashboardPosition[]
): DashboardAccount {
    const totalCapital = 10000; // Simulated starting capital
    const marginUsed = positions.reduce((sum, p) => sum + p.marginUsed, 0);
    const unrealizedPnl = positions.reduce((sum, p) => sum + p.pnl, 0);

    return {
        totalCapital: totalCapital + unrealizedPnl,
        availableBalance: totalCapital - marginUsed + unrealizedPnl,
        marginUsed,
        openPositions: positions.length,
        pnl: {
            daily: unrealizedPnl,
            dailyPercent: (unrealizedPnl / totalCapital) * 100,
            weekly: unrealizedPnl * 2.3,
            weeklyPercent: (unrealizedPnl * 2.3 / totalCapital) * 100,
            monthly: unrealizedPnl * 5.7,
            monthlyPercent: (unrealizedPnl * 5.7 / totalCapital) * 100,
        },
        isConnected: true, // TODO: Check real connection status
    };
}

/**
 * Map signals to coin-level scores for the sidebar.
 */
export function getCoinSignalScores(
    pairs: CryptoPair[],
    signals: TradeSignal[]
): CoinSignalScore[] {
    return pairs.map(pair => {
        const pairSignals = signals.filter(s => s.pair === pair.symbol);
        const activeSignal = pairSignals.find(s => s.status === 'active');
        const bestScore = pairSignals.reduce(
            (max, s) => Math.max(max, s.quality?.score || s.confidence || 0),
            0
        );

        return {
            symbol: pair.symbol,
            score: bestScore,
            signalType: activeSignal
                ? (activeSignal.type === 'long' ? 'buy' : 'sell')
                : 'neutral' as const,
            hasActiveSignal: !!activeSignal,
        };
    });
}

/**
 * Generate simulated performance stats.
 */
export function generateSimulatedPerformance(): PerformanceStats {
    const days = 30;
    const equityCurve: { date: string; value: number }[] = [];
    let equity = 10000;

    for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        equity += (Math.random() - 0.4) * 200; // Slight upward bias
        equityCurve.push({
            date: date.toISOString().split('T')[0],
            value: Math.round(equity * 100) / 100,
        });
    }

    return {
        winRate: 62.5,
        avgRR: 2.1,
        totalTrades: 48,
        winStreak: 7,
        lossStreak: 3,
        maxDrawdown: 8.4,
        sharpeRatio: 1.85,
        equityCurve,
    };
}

/**
 * Generate simulated closed trades history.
 */
export function generateSimulatedHistory(): ClosedTrade[] {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT'];
    const trades: ClosedTrade[] = [];

    for (let i = 0; i < 20; i++) {
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const direction = Math.random() > 0.5 ? 'LONG' as const : 'SHORT' as const;
        const entry = 100 + Math.random() * 60000;
        const isWin = Math.random() < 0.625;
        const resultOptions = isWin ? ['tp1', 'tp2', 'tp3'] : ['sl'];
        const result = resultOptions[Math.floor(Math.random() * resultOptions.length)] as ClosedTrade['result'];

        const pnlPercent = isWin
            ? 1 + Math.random() * 8
            : -(1 + Math.random() * 4);
        const exitPrice = direction === 'LONG'
            ? entry * (1 + pnlPercent / 100)
            : entry * (1 - pnlPercent / 100);

        const closedAt = new Date();
        closedAt.setHours(closedAt.getHours() - Math.floor(Math.random() * 720));
        const openedAt = new Date(closedAt);
        openedAt.setHours(openedAt.getHours() - Math.floor(1 + Math.random() * 48));

        trades.push({
            id: `trade-${i}`,
            symbol,
            direction,
            entryPrice: Math.round(entry * 100) / 100,
            exitPrice: Math.round(exitPrice * 100) / 100,
            pnl: Math.round(pnlPercent * 10) / 10 * 10, // Scale to ~$10-80
            pnlPercent: Math.round(pnlPercent * 100) / 100,
            openedAt,
            closedAt,
            result,
        });
    }

    return trades.sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime());
}
