// ═══════════════════════════════════════════════════════════
// Paper Trading Types — Virtual trading simulation system
// ═══════════════════════════════════════════════════════════

import { ExecutionConfig } from './backtestTypes';

// ──────────── Configuration ────────────

export type PaperTradingMode = 'manual' | 'automatic';

export interface PaperAutoTradeConfig {
    enabled: boolean;
    minScore: number;
    minMLProbability: number;
    maxSimultaneousPositions: number;
    maxCapitalPerTrade: number; // % of balance
}

export interface PaperTradingConfig {
    initialBalance: number;
    currency: string;
    startDate: string; // ISO date
    execution: ExecutionConfig;
    autoTrade: PaperAutoTradeConfig;
}

export const DEFAULT_PAPER_CONFIG: PaperTradingConfig = {
    initialBalance: 10000,
    currency: 'USDT',
    startDate: new Date().toISOString(),
    execution: {
        spread: 0.02,
        slippage: 0.05,
        makerFee: 0.02,
        takerFee: 0.05,
        useMarketOrders: true,
    },
    autoTrade: {
        enabled: false,
        minScore: 75,
        minMLProbability: 65,
        maxSimultaneousPositions: 5,
        maxCapitalPerTrade: 20,
    },
};

// ──────────── Position ────────────

export type PaperPositionStatus = 'open' | 'closed';
export type PaperExitReason = 'tp1' | 'tp2' | 'tp3' | 'sl' | 'trailing_sl' | 'liquidation' | 'manual';

export interface PaperPosition {
    id: string;
    symbol: string;
    direction: 'long' | 'short';
    status: PaperPositionStatus;

    // Entry
    entryPrice: number;
    entryTime: number; // timestamp
    quantity: number;
    leverage: number;
    marginUsed: number;

    // Targets
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number | null;
    takeProfit3: number | null;
    trailingStopActive: boolean;
    trailingStopDistance: number; // %
    trailingStopHighWater: number; // best price seen

    // Partial fills tracking
    tp1Hit: boolean;
    tp2Hit: boolean;
    quantityRemaining: number; // after partial TPs

    // Live data
    currentPrice: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
    liquidationPrice: number;

    // Funding
    fundingAccumulated: number;

    // Signal context
    signalScore: number;
    signalConfidence: number;
    mlProbability: number;
    signalIndicators: string[];

    // Exit (filled when closed)
    exitPrice?: number;
    exitTime?: number;
    exitReason?: PaperExitReason;
    realizedPnl?: number;
    realizedPnlPercent?: number;
    totalFees?: number;
}

// ──────────── Completed Order (History) ────────────

export interface PaperOrder {
    id: string;
    symbol: string;
    direction: 'long' | 'short';

    entryPrice: number;
    exitPrice: number;
    entryTime: number;
    exitTime: number;

    quantity: number;
    leverage: number;
    marginUsed: number;

    grossPnl: number;
    fees: number;
    fundingPaid: number;
    netPnl: number;
    pnlPercent: number;

    exitReason: PaperExitReason;
    duration: number; // ms

    signalScore: number;
    signalConfidence: number;
    mlProbability: number;
    signalIndicators: string[];
}

// ──────────── Portfolio State ────────────

export interface PaperPortfolioState {
    config: PaperTradingConfig;
    mode: PaperTradingMode;
    balance: number; // available USDT
    equity: number; // balance + unrealized PnL
    marginInUse: number;
    positions: PaperPosition[];
    history: PaperOrder[];
    equityCurve: PaperEquityPoint[];
    lastUpdated: number;
}

export interface PaperEquityPoint {
    timestamp: number;
    equity: number;
    balance: number;
    openPositions: number;
}

// ──────────── Metrics ────────────

export interface PaperMetrics {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    winRateLong: number;
    winRateShort: number;

    totalPnL: number;
    totalPnLPercent: number;

    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;

    avgWin: number;
    avgLoss: number;
    expectancy: number;

    largestWin: number;
    largestLoss: number;
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;

    totalFees: number;
    totalFunding: number;

    // Period PnL
    pnlToday: number;
    pnlWeek: number;
    pnlMonth: number;
}

// ──────────── Readiness ────────────

export interface ReadinessCriterion {
    id: string;
    label: string;
    target: string;
    currentValue: number | string;
    passed: boolean;
}

export type ReadinessStatus = 'not_ready' | 'almost_ready' | 'ready';

export interface PaperReadiness {
    status: ReadinessStatus;
    criteria: ReadinessCriterion[];
    passedCount: number;
    totalCount: number;
}

// ──────────── Comparative ────────────

export interface PaperBacktestComparison {
    paperWinRate: number;
    backtestWinRate: number;
    winRateDeviation: number;

    paperProfitFactor: number;
    backtestProfitFactor: number;
    profitFactorDeviation: number;

    paperDrawdown: number;
    backtestDrawdown: number;
    drawdownDeviation: number;

    hasDivergence: boolean; // any deviation > 15%
    divergenceWarnings: string[];
}
