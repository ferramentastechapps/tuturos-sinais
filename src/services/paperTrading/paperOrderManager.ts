// ═══════════════════════════════════════════════════════════
// Paper Order Manager — Simulates order execution realistically
// ═══════════════════════════════════════════════════════════

import { ExecutionConfig } from '@/types/backtestTypes';

// ──────────── Market Entry ────────────

export const simulateMarketEntry = (
    price: number,
    direction: 'long' | 'short',
    config: ExecutionConfig,
): number => {
    const spreadImpact = price * (config.spread / 100);
    const slippageImpact = price * (config.slippage / 100);
    const totalImpact = spreadImpact + slippageImpact;

    // Long entry: price goes up (worse fill); Short entry: price goes down
    return direction === 'long'
        ? price + totalImpact
        : price - totalImpact;
};

// ──────────── Stop Loss Fill ────────────

export const simulateStopLossFill = (
    triggerPrice: number,
    direction: 'long' | 'short',
    slippagePercent: number = 0.1,
): number => {
    // SL fills slightly worse than trigger (gap simulation)
    const gap = triggerPrice * (slippagePercent / 100);
    return direction === 'long'
        ? triggerPrice - gap   // Long SL: fill below trigger
        : triggerPrice + gap;  // Short SL: fill above trigger
};

// ──────────── Take Profit Fill ────────────

export const simulateTakeProfitFill = (triggerPrice: number): number => {
    // TP fills at exact price (limit order)
    return triggerPrice;
};

// ──────────── Fee Calculation ────────────

export const calculateEntryFees = (
    notionalValue: number,
    config: ExecutionConfig,
): number => {
    const feeRate = config.useMarketOrders ? config.takerFee : config.makerFee;
    return notionalValue * (feeRate / 100);
};

export const calculateExitFees = (
    notionalValue: number,
    config: ExecutionConfig,
): number => {
    return notionalValue * (config.takerFee / 100);
};

// ──────────── Liquidation Price ────────────

export const calculateLiquidationPrice = (
    entryPrice: number,
    leverage: number,
    direction: 'long' | 'short',
    maintenanceMarginRate: number = 0.5, // 0.5% for most Binance pairs
): number => {
    // Simplified Binance-style liquidation formula
    const marginRatio = 1 / leverage;
    const buffer = maintenanceMarginRate / 100;

    if (direction === 'long') {
        return entryPrice * (1 - marginRatio + buffer);
    }
    return entryPrice * (1 + marginRatio - buffer);
};

// ──────────── Position Sizing ────────────

export const calculatePositionSize = (
    availableBalance: number,
    maxCapitalPercent: number,
    entryPrice: number,
    leverage: number,
): { quantity: number; marginRequired: number; notionalValue: number } => {
    const maxCapital = availableBalance * (maxCapitalPercent / 100);
    const marginRequired = Math.min(maxCapital, availableBalance);
    const notionalValue = marginRequired * leverage;
    const quantity = notionalValue / entryPrice;

    return {
        quantity: Math.floor(quantity * 1e8) / 1e8, // 8 decimal precision
        marginRequired,
        notionalValue,
    };
};

// ──────────── PnL Calculation ────────────

export const calculateUnrealizedPnl = (
    entryPrice: number,
    currentPrice: number,
    quantity: number,
    direction: 'long' | 'short',
): { pnl: number; pnlPercent: number } => {
    const priceDiff = direction === 'long'
        ? currentPrice - entryPrice
        : entryPrice - currentPrice;

    const pnl = priceDiff * quantity;
    const pnlPercent = (priceDiff / entryPrice) * 100;

    return { pnl, pnlPercent };
};

// ──────────── Trailing Stop ────────────

export const calculateTrailingStop = (
    direction: 'long' | 'short',
    highWaterPrice: number,
    trailingDistance: number, // %
): number => {
    const distance = highWaterPrice * (trailingDistance / 100);
    return direction === 'long'
        ? highWaterPrice - distance
        : highWaterPrice + distance;
};

// ──────────── SL/TP Hit Detection ────────────

export const checkStopLossHit = (
    currentPrice: number,
    stopLoss: number,
    direction: 'long' | 'short',
): boolean => {
    return direction === 'long'
        ? currentPrice <= stopLoss
        : currentPrice >= stopLoss;
};

export const checkTakeProfitHit = (
    currentPrice: number,
    takeProfit: number,
    direction: 'long' | 'short',
): boolean => {
    return direction === 'long'
        ? currentPrice >= takeProfit
        : currentPrice <= takeProfit;
};

// ──────────── Liquidation Check ────────────

export const checkLiquidation = (
    currentPrice: number,
    liquidationPrice: number,
    direction: 'long' | 'short',
): boolean => {
    return direction === 'long'
        ? currentPrice <= liquidationPrice
        : currentPrice >= liquidationPrice;
};

// ──────────── Margin Health ────────────

export const calculateMarginHealth = (
    entryPrice: number,
    currentPrice: number,
    liquidationPrice: number,
    direction: 'long' | 'short',
): number => {
    // Returns 0-100, where 0 = liquidation, 100 = healthy
    const totalRange = Math.abs(entryPrice - liquidationPrice);
    if (totalRange === 0) return 0;

    const currentDistance = direction === 'long'
        ? currentPrice - liquidationPrice
        : liquidationPrice - currentPrice;

    return Math.max(0, Math.min(100, (currentDistance / totalRange) * 100));
};
