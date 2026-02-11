// Paper Trading Types — Direct port from frontend

import { ExecutionConfig } from './trading.js';

export type PaperTradingMode = 'manual' | 'automatic';

export interface PaperAutoTradeConfig {
    enabled: boolean;
    minScore: number;
    minMLProbability: number;
    maxSimultaneousPositions: number;
    maxCapitalPerTrade: number;
}

export interface PaperTradingConfig {
    initialBalance: number;
    currency: string;
    startDate: string;
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

export type PaperPositionStatus = 'open' | 'closed';
export type PaperExitReason = 'tp1' | 'tp2' | 'tp3' | 'sl' | 'trailing_sl' | 'liquidation' | 'manual';

export interface PaperPosition {
    id: string;
    symbol: string;
    direction: 'long' | 'short';
    status: PaperPositionStatus;
    entryPrice: number;
    entryTime: number;
    quantity: number;
    leverage: number;
    marginUsed: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number | null;
    takeProfit3: number | null;
    trailingStopActive: boolean;
    trailingStopDistance: number;
    trailingStopHighWater: number;
    tp1Hit: boolean;
    tp2Hit: boolean;
    quantityRemaining: number;
    currentPrice: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
    liquidationPrice: number;
    fundingAccumulated: number;
    signalScore: number;
    signalConfidence: number;
    mlProbability: number;
    signalIndicators: string[];
    exitPrice?: number;
    exitTime?: number;
    exitReason?: PaperExitReason;
    realizedPnl?: number;
    realizedPnlPercent?: number;
    totalFees?: number;
}

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
    duration: number;
    signalScore: number;
    signalConfidence: number;
    mlProbability: number;
    signalIndicators: string[];
}

export interface PaperEquityPoint {
    timestamp: number;
    equity: number;
    balance: number;
    openPositions: number;
}

export interface PaperPortfolioState {
    config: PaperTradingConfig;
    mode: PaperTradingMode;
    balance: number;
    equity: number;
    marginInUse: number;
    positions: PaperPosition[];
    history: PaperOrder[];
    equityCurve: PaperEquityPoint[];
    lastUpdated: number;
}

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
    pnlToday: number;
    pnlWeek: number;
    pnlMonth: number;
}
