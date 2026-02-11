import { FibonacciLevels, calculateFibonacciLevels } from './technicalIndicators';

export interface RiskConfig {
    accountBalance: number;
    riskPercentage: number; // e.g., 1 for 1%
    entryPrice: number;
    stopLossPrice: number;
    leverage?: number;
}

export interface PositionSizeResult {
    positionSizeQuote: number; // Size in USDT
    positionSizeBase: number;  // Size in BTC/ETH
    leverageRecommended: number;
    riskAmount: number;
}

export interface ExitStrategy {
    stopLoss: number;
    tp1: number;
    tp2: number;
    tp3: number;
    riskRewardRatio: number;
}

/**
 * Calculates position size based on risk percentage and stop loss distance.
 */
export const calculatePositionSize = (config: RiskConfig): PositionSizeResult => {
    const { accountBalance, riskPercentage, entryPrice, stopLossPrice, leverage = 1 } = config;

    const riskAmount = accountBalance * (riskPercentage / 100);
    const priceDifferencePercent = Math.abs(entryPrice - stopLossPrice) / entryPrice;

    // Position size = Risk Amount / Stop Loss %
    let positionSizeQuote = riskAmount / priceDifferencePercent;

    // Cap leverage if needed (simplified for spot/futures)
    // If user provides leverage, we might adjust, but standard risk sizing 
    // determines position size first, then you apply leverage to match that size with less margin.

    const positionSizeBase = positionSizeQuote / entryPrice;

    return {
        positionSizeQuote,
        positionSizeBase,
        leverageRecommended: Math.ceil(positionSizeQuote / accountBalance), // Suggest leverage to open this position size
        riskAmount
    };
};

/**
 * Calculates dynamic exits using ATR and Fibonacci extensions.
 */
export const calculateDynamicExits = (
    entryPrice: number,
    stopLoss: number,
    trend: 'bullish' | 'bearish',
    high24h: number,
    low24h: number
): ExitStrategy => {
    const risk = Math.abs(entryPrice - stopLoss);

    // Basic R:R targets
    // TP1 = 1:1.5
    // TP2 = 1:2.5
    // TP3 = 1:4.0

    let tp1, tp2, tp3;

    // Use Fibonacci extensions if available context suggests (simplified here using 24h high/low as proxy for swing)
    // For a more robust implementation, we would pass the actual swing high/low points
    const fib = calculateFibonacciLevels(high24h, low24h, trend);

    if (trend === 'bullish') {
        // Logic: If we are close to High, use extensions. If in a dip, use retracements back to high.
        // For simplicity and safety, we combine Risk-based targets with Fib levels.

        const riskBasedTP1 = entryPrice + (risk * 1.5);
        const riskBasedTP2 = entryPrice + (risk * 2.5);
        const riskBasedTP3 = entryPrice + (risk * 4.0);

        // Confluence check: Adjust to nearest Fib level if close?
        // Here we just return the calculated risk-based targets, but could blend logic.
        tp1 = riskBasedTP1;
        tp2 = riskBasedTP2;
        tp3 = riskBasedTP3;

    } else {
        const riskBasedTP1 = entryPrice - (risk * 1.5);
        const riskBasedTP2 = entryPrice - (risk * 2.5);
        const riskBasedTP3 = entryPrice - (risk * 4.0);

        tp1 = riskBasedTP1;
        tp2 = riskBasedTP2;
        tp3 = riskBasedTP3;
    }

    return {
        stopLoss,
        tp1,
        tp2,
        tp3,
        riskRewardRatio: (tp2 - entryPrice) / (entryPrice - stopLoss) // Using TP2 as 'standard' target for R:R calc
    };
};
