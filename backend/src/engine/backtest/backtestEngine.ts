// ═══════════════════════════════════════════════════════════
// Backtest Engine — Full Simulation Engine
// Bar-by-bar simulation with no lookahead bias
// Integrates advancedSignalGenerator + dynamicRiskAdjuster
// ═══════════════════════════════════════════════════════════

import { OHLCPoint, TradeSignal, CryptoPair } from '../../types/trading.js';
import { generateSignalFromData } from '../signalEngine.js';
import { predictSignal, isModelLoaded, getSymbolId } from '../../ml/mlPredictionService.js';
import {
    BacktestConfig, BacktestTrade, EquityPoint, BacktestProgress,
} from '../../types/backtestTypes.js';

// ──────────── Active Position State ────────────

interface ActivePosition {
    id: string;
    symbol: string;
    type: 'long' | 'short';
    entryPrice: number;
    quantity: number;
    leverage: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    takeProfit3: number;
    entryTime: number;
    signalScore: number;
    signalConfidence: number;
    signalIndicators: string[];
    riskScore: number;
    maxPrice: number;      // Track max favorable
    minPrice: number;      // Track max adverse
    fundingAccumulated: number;
    tp1Hit: boolean;
    tp2Hit: boolean;
    capitalAtEntry: number;
    mlFeatures?: Record<string, number>;
}

// ──────────── Timeframe Aggregator ────────────

function aggregateOHLC(candles: OHLCPoint[], targetDurationMs: number): OHLCPoint[] {
    const result: OHLCPoint[] = [];
    if (candles.length === 0) return result;
    
    let currentCandle: OHLCPoint | null = null;
    let currentBucketStart = 0;
    
    for (const c of candles) {
        const bucketStart = Math.floor(c.timestamp / targetDurationMs) * targetDurationMs;
        if (!currentCandle || bucketStart > currentBucketStart) {
            if (currentCandle) result.push(currentCandle);
            currentBucketStart = bucketStart;
            currentCandle = {
                timestamp: bucketStart,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume || 0
            };
        } else {
            currentCandle.high = Math.max(currentCandle.high, c.high);
            currentCandle.low = Math.min(currentCandle.low, c.low);
            currentCandle.close = c.close;
            currentCandle.volume = (currentCandle.volume || 0) + (c.volume || 0);
        }
    }
    if (currentCandle) result.push(currentCandle);
    return result;
}

// ──────────── Engine ────────────

export class BacktestEngine {
    private config: BacktestConfig;
    private equity: number;
    private peakEquity: number;
    private positions: ActivePosition[] = [];
    private closedTrades: BacktestTrade[] = [];
    private equityCurve: EquityPoint[] = [];
    private dailyStartEquity: Map<string, number> = new Map();
    private tradingStopped = false;
    private consecutiveLosses = 0;
    private tradeIdCounter = 0;

    constructor(config: BacktestConfig) {
        this.config = config;
        this.equity = config.initialCapital;
        this.peakEquity = config.initialCapital;
    }

    /**
     * Executa backtest para um único símbolo.
     * Retorna trades fechados e equity curve.
     */
    public async runSymbol(
        symbol: string,
        history: OHLCPoint[],
        onProgress?: (progress: BacktestProgress) => void
    ): Promise<{ trades: BacktestTrade[]; equityCurve: EquityPoint[] }> {
        if (history.length < 200) {
            console.warn(`[BacktestEngine] Insufficient data for ${symbol}: ${history.length} candles`);
            return { trades: [], equityCurve: [] };
        }

        const startIndex = 200; // Indicator warmup
        const totalBars = history.length - startIndex;

        for (let i = startIndex; i < history.length; i++) {
            if (this.tradingStopped) break;

            const candle = history[i];
            const barIndex = i - startIndex;

            // Progress
            if (barIndex % 100 === 0) {
                onProgress?.({
                    phase: 'simulating',
                    currentSymbol: symbol,
                    currentBar: barIndex,
                    totalBars,
                    percentComplete: Math.round((barIndex / totalBars) * 100),
                    message: `Simulando ${symbol}: ${barIndex}/${totalBars} barras`,
                });
            }

            // Track daily equity for drawdown limit
            this.trackDailyEquity(candle.timestamp);

            // 1. Update open positions (check SL/TP hits)
            this.updatePositions(candle, symbol);

            // 2. Check drawdown limits
            this.checkDrawdownLimits(candle.timestamp);

            // 3. Record equity point
            this.recordEquityPoint(candle.timestamp);

            // 4. If trading is stopped or max positions reached, skip signal
            if (this.tradingStopped) continue;
            if (this.positions.length >= this.config.signal.maxSimultaneousPositions) continue;

            // 5. Generate signal via Original Backend Logic
            const window = history.slice(Math.max(0, i - 1000), i + 1);
            
            // Build MTF aggregates mock
            const ohlc4h = aggregateOHLC(window, 4 * 60 * 60 * 1000);
            const ohlc15m = aggregateOHLC(window, 15 * 60 * 1000);

            // Construct additional environment required
            const currentPrice = candle.close;
            // The recent slice must NOT include the current candle for calculating liquidity sweeps
            // otherwise last.low < low24h will be impossible if low24h includes last.low!
            const recentSlice = window.slice(-25, -1); // Assuming 1h window
            const high24h = Math.max(...recentSlice.map(c => c.high));
            const low24h = Math.min(...recentSlice.map(c => c.low));
            const volume24h = recentSlice.reduce((sum, c) => sum + (c.volume || 0), 0);
            const fundingRate = 0; // Mock 0% funding for backtesting

            // Force dynamic wait for signal Engine
            const signal = generateSignalFromData(
                symbol, window, currentPrice, high24h, low24h, volume24h, fundingRate, ohlc15m, ohlc4h, this.config.signal.minScore
            );

            // 6. Process signal (if any)
            if (signal && this.shouldEnterTrade(signal)) {
                let passML = true;

                // Emular a Inteligência Artificial do Robô (somente se useMLFilter=true)
                if (this.config.signal.useMLFilter && isModelLoaded()) {
                    const precomputed = signal.mlData ?? {};
                    const features = {
                        symbol_id: getSymbolId(symbol),
                        rsi:        precomputed._rsi        ?? 50,
                        adx:        precomputed._adx        ?? 25,
                        atr_rel:    precomputed._atr_rel    ?? 0,
                        dist_ema20: precomputed._dist_ema20 ?? 0,
                        dist_ema50: precomputed._dist_ema50 ?? 0,
                        dist_ema200:precomputed._dist_ema200 ?? 0,
                        dist_vwap:  precomputed._dist_vwap  ?? 0,
                        volatility_24h: high24h > 0 ? (high24h - low24h) / ((high24h + low24h) / 2) * 100 : 0,
                        volume_rel: precomputed._volume_rel ?? 1,
                        funding_rate: fundingRate,
                        open_interest_var: 0,
                        long_short_ratio: 1,
                        is_long: signal.type === 'long' ? 1 : 0,
                        confidence: signal.confidence / 100,
                        quality_score: (signal.quality?.score ?? signal.confidence) / 100,
                        confluence_count: signal.indicators.length,
                        stop_loss_pct: Math.abs(signal.entry - signal.stopLoss) / signal.entry * 100,
                        take_profit_pct: Math.abs(signal.takeProfit - signal.entry) / signal.entry * 100,
                        risk_reward: signal.riskReward,
                        hour_of_day: new Date(candle.timestamp).getUTCHours(),
                        day_of_week: new Date(candle.timestamp).getUTCDay(),
                        btc_trend: 0,
                        dominance_btc: 50,
                        fear_greed: 50,
                    };

                    const prediction = await predictSignal(features);
                    if (prediction) {
                        signal.mlData = {
                            ...features,
                            probability: prediction.probability,
                            predictedClass: prediction.predictedClass,
                            confidence: prediction.confidence,
                            isFiltered: prediction.probability < 0.5,
                        };

                        // Filtro que o Robô Real usa
                        if (prediction.probability < 0.65) {
                            passML = false;
                        }
                    }
                }

                if (passML) {
                    // Close opposite positions first
                    this.handleSignalFlip(symbol, signal, candle.timestamp);

                    // Enter new position if allowed
                    if (this.canOpenNewPosition(symbol)) {
                        this.executeEntry(signal, symbol, candle.timestamp);
                    }
                }
            }
        }

        // Force close remaining positions
        if (history.length > 0) {
            const lastCandle = history[history.length - 1];
            this.closeAllPositions(lastCandle, 'end_of_data');
        }

        return {
            trades: [...this.closedTrades],
            equityCurve: [...this.equityCurve],
        };
    }

    /**
     * Reset engine state for a new run (keeps config).
     */
    public reset(): void {
        this.equity = this.config.initialCapital;
        this.peakEquity = this.config.initialCapital;
        this.positions = [];
        this.closedTrades = [];
        this.equityCurve = [];
        this.dailyStartEquity.clear();
        this.tradingStopped = false;
        this.consecutiveLosses = 0;
        this.tradeIdCounter = 0;
    }

    // ──────────── Helper Methods ────────────

    private handleSignalFlip(symbol: string, signal: TradeSignal, timestamp: number): void {
        const existingPositionIndex = this.positions.findIndex(p => p.symbol === symbol);
        if (existingPositionIndex !== -1) {
            const existingPosition = this.positions[existingPositionIndex];
            const sigType = signal.type.toLowerCase() as 'long'|'short';
            if (existingPosition.type !== sigType) {
                // Close the existing position at current candle's close price (signal generation price)
                this.closePosition(existingPositionIndex, signal.entry, 'signal_flip', timestamp);
            }
        }
    }

    private canOpenNewPosition(symbol: string): boolean {
        // Check max open positions
        if (this.positions.length >= this.config.signal.maxSimultaneousPositions) return false;

        // Check if already in position for this symbol
        const existing = this.positions.find(p => p.symbol === symbol);
        if (existing) return false;

        return true;
    }

    // ──────────── Trade Filtering ────────────

    private shouldEnterTrade(signal: TradeSignal): boolean {
        const { minScore, allowLong, allowShort } = this.config.signal;

        const typeLower = signal.type.toLowerCase();
        // Direction filter
        if (typeLower === 'long' && !allowLong) return false;
        if (typeLower === 'short' && !allowShort) return false;

        // Score filter
        if ((signal.score || 0) < minScore) return false;

        // Capital per position
        const maxCapitalForPosition = this.equity * (this.config.signal.maxCapitalPerPosition / 100);
        if (maxCapitalForPosition < 10) return false; // Min $10
        
        return true;
    }

    // ──────────── Trade Execution ────────────

    private executeEntry(
        signal: TradeSignal,
        symbol: string,
        timestamp: number
    ): void {
        const maxCapital = this.equity * (this.config.signal.maxCapitalPerPosition / 100);

        // Apply slippage + spread
        const feeRate = this.config.execution.useMarketOrders
            ? this.config.execution.takerFee / 100
            : this.config.execution.makerFee / 100;
        const spreadImpact = this.config.execution.spread / 100 / 2;
        const slippageImpact = this.config.execution.slippage / 100;
        const totalEntryImpact = spreadImpact + slippageImpact;

        const entry = signal.entry;
        const typeLower = signal.type.toLowerCase() as 'long'|'short';

        const entryPrice = typeLower === 'long'
            ? entry * (1 + totalEntryImpact)
            : entry * (1 - totalEntryImpact);

        // Position sizing
        const riskPerTrade = signal.riskPercent || 1;
        const riskAmount = this.equity * (riskPerTrade / 100);
        const priceDiff = Math.abs(entryPrice - signal.stopLoss);

        if (priceDiff === 0) return;

        let quantity = riskAmount / priceDiff;
        const leverage = signal.dynamicLeverage || 1;
        const maxQty = (maxCapital * leverage) / entryPrice;
        quantity = Math.min(quantity, maxQty);

        if (quantity * entryPrice < 5) return; // Min notional

        const position: ActivePosition = {
            id: `bt_${this.tradeIdCounter++}`,
            symbol,
            type: typeLower,
            entryPrice,
            quantity,
            leverage,
            stopLoss: signal.stopLoss,
            takeProfit1: signal.takeProfit1 || signal.takeProfit,
            takeProfit2: signal.takeProfit2 || signal.takeProfit,
            takeProfit3: signal.takeProfit3 || signal.takeProfit * 1.5,
            entryTime: timestamp,
            signalScore: signal.score || 0,
            signalConfidence: signal.score || 0,
            signalIndicators: [],
            riskScore: 50,
            maxPrice: entryPrice,
            minPrice: entryPrice,
            fundingAccumulated: 0,
            tp1Hit: false,
            tp2Hit: false,
            capitalAtEntry: this.equity,
            mlFeatures: signal.metricsValues,
        };

        this.positions.push(position);
    }

    // ──────────── Position Update ────────────

    private updatePositions(candle: OHLCPoint, _symbol: string): void {
        const toClose: Array<{ index: number; exitPrice: number; reason: BacktestTrade['exitReason'] }> = [];

        for (let idx = 0; idx < this.positions.length; idx++) {
            const pos = this.positions[idx];

            // Track extremes
            if (candle.high > pos.maxPrice) pos.maxPrice = candle.high;
            if (candle.low < pos.minPrice) pos.minPrice = candle.low;

            // Simulate funding (every 8h, simplified)
            const timeSinceEntry = candle.timestamp - pos.entryTime;
            const fundingPeriods = Math.floor(timeSinceEntry / (8 * 60 * 60 * 1000));
            const estFundingRate = 0.01; // 0.01% per period (average)
            pos.fundingAccumulated = fundingPeriods * (estFundingRate / 100) * pos.quantity * pos.entryPrice;

            if (pos.type === 'long') {
                // SL check (pessimistic: SL checked before TP on same candle)
                if (candle.low <= pos.stopLoss) {
                    toClose.push({ index: idx, exitPrice: pos.stopLoss, reason: 'sl' });
                    continue;
                }
                // TP3
                if (candle.high >= pos.takeProfit3) {
                    toClose.push({ index: idx, exitPrice: pos.takeProfit3, reason: 'tp3' });
                    continue;
                }
                // TP2
                if (!pos.tp2Hit && candle.high >= pos.takeProfit2) {
                    pos.tp2Hit = true;
                    // Move SL to entry (breakeven)
                    pos.stopLoss = pos.entryPrice * 1.001;
                }
                // TP1
                if (!pos.tp1Hit && candle.high >= pos.takeProfit1) {
                    pos.tp1Hit = true;
                }
            } else {
                // SHORT
                if (candle.high >= pos.stopLoss) {
                    toClose.push({ index: idx, exitPrice: pos.stopLoss, reason: 'sl' });
                    continue;
                }
                if (candle.low <= pos.takeProfit3) {
                    toClose.push({ index: idx, exitPrice: pos.takeProfit3, reason: 'tp3' });
                    continue;
                }
                if (!pos.tp2Hit && candle.low <= pos.takeProfit2) {
                    pos.tp2Hit = true;
                    pos.stopLoss = pos.entryPrice * 0.999;
                }
                if (!pos.tp1Hit && candle.low <= pos.takeProfit1) {
                    pos.tp1Hit = true;
                }
            }
        }

        // Close positions (process in reverse to maintain indices)
        toClose.sort((a, b) => b.index - a.index);
        for (const { index, exitPrice, reason } of toClose) {
            this.closePosition(index, exitPrice, reason, candle.timestamp);
        }
    }

    private closePosition(
        index: number,
        rawExitPrice: number,
        reason: BacktestTrade['exitReason'],
        timestamp: number
    ): void {
        const pos = this.positions[index];
        if (!pos) return;

        // Apply slippage on exit
        const slippageImpact = this.config.execution.slippage / 100;
        const exitPrice = pos.type === 'long'
            ? rawExitPrice * (1 - slippageImpact)
            : rawExitPrice * (1 + slippageImpact);

        // Calculate PnL
        const grossPnl = pos.type === 'long'
            ? (exitPrice - pos.entryPrice) * pos.quantity
            : (pos.entryPrice - exitPrice) * pos.quantity;

        // Fees
        const feeRate = this.config.execution.useMarketOrders
            ? this.config.execution.takerFee / 100
            : this.config.execution.makerFee / 100;
        const entryFee = pos.entryPrice * pos.quantity * feeRate;
        const exitFee = exitPrice * pos.quantity * feeRate;
        const totalFees = entryFee + exitFee;

        const netPnl = grossPnl - totalFees - pos.fundingAccumulated;
        const pnlPercent = (netPnl / pos.capitalAtEntry) * 100;

        // MFE / MAE
        let maxFavorable = 0;
        let maxAdverse = 0;
        if (pos.type === 'long') {
            maxFavorable = ((pos.maxPrice - pos.entryPrice) / pos.entryPrice) * 100;
            maxAdverse = ((pos.entryPrice - pos.minPrice) / pos.entryPrice) * 100;
        } else {
            maxFavorable = ((pos.entryPrice - pos.minPrice) / pos.entryPrice) * 100;
            maxAdverse = ((pos.maxPrice - pos.entryPrice) / pos.entryPrice) * 100;
        }

        const trade: BacktestTrade = {
            id: pos.id,
            symbol: pos.symbol,
            type: pos.type,
            entryTime: pos.entryTime,
            exitTime: timestamp,
            entryPrice: pos.entryPrice,
            exitPrice,
            quantity: pos.quantity,
            leverage: pos.leverage,
            grossPnl,
            fees: totalFees,
            fundingPaid: pos.fundingAccumulated,
            netPnl,
            pnlPercent,
            exitReason: reason,
            signalScore: pos.signalScore,
            signalConfidence: pos.signalConfidence,
            signalIndicators: pos.signalIndicators,
            riskScore: pos.riskScore,
            maxFavorableExcursion: maxFavorable,
            maxAdverseExcursion: maxAdverse,
            duration: timestamp - pos.entryTime,
            mlFeatures: pos.mlFeatures,
        };

        this.closedTrades.push(trade);
        this.positions.splice(index, 1);

        // Update equity
        this.equity += netPnl;

        // Track consecutive losses
        if (netPnl < 0) {
            this.consecutiveLosses++;
        } else {
            this.consecutiveLosses = 0;
        }

        // Update peak
        if (this.equity > this.peakEquity) {
            this.peakEquity = this.equity;
        }
    }

    private closeAllPositions(candle: OHLCPoint, reason: BacktestTrade['exitReason']): void {
        while (this.positions.length > 0) {
            this.closePosition(0, candle.close, reason, candle.timestamp);
        }
    }

    // ──────────── Drawdown ────────────

    private trackDailyEquity(timestamp: number): void {
        const dateKey = new Date(timestamp).toISOString().split('T')[0];
        if (!this.dailyStartEquity.has(dateKey)) {
            this.dailyStartEquity.set(dateKey, this.equity);
        }
    }

    private checkDrawdownLimits(timestamp: number): void {
        if (!this.config.risk.stopTradingOnMaxDrawdown) return;

        // Total drawdown
        const totalDD = ((this.peakEquity - this.equity) / this.peakEquity) * 100;
        if (totalDD >= this.config.risk.maxTotalDrawdown) {
            this.tradingStopped = true;
            return;
        }

        // Daily drawdown
        const dateKey = new Date(timestamp).toISOString().split('T')[0];
        const dayStart = this.dailyStartEquity.get(dateKey);
        if (dayStart) {
            const dailyDD = ((dayStart - this.equity) / dayStart) * 100;
            if (dailyDD >= this.config.risk.maxDailyDrawdown) {
                // Only stop for the day — we simplify to stop trading entirely
                // In a real system we'd resume next day
                this.tradingStopped = true;
            }
        }
    }

    // ──────────── Equity Curve ────────────

    private recordEquityPoint(timestamp: number): void {
        const ddValue = this.peakEquity - this.equity;
        const ddPercent = this.peakEquity > 0 ? (ddValue / this.peakEquity) * 100 : 0;

        this.equityCurve.push({
            timestamp,
            equity: this.equity,
            drawdown: ddPercent,
            drawdownValue: ddValue,
            openPositions: this.positions.length,
        });
    }

    // ──────────── Helpers ────────────

    private getLookback24h(): number {
        const tf = this.config.timeframe;
        switch (tf) {
            case '1m': return 1440;
            case '5m': return 288;
            case '15m': return 96;
            case '1h': return 24;
            case '4h': return 6;
            case '1d': return 1;
            default: return 24;
        }
    }

    // ──────────── Getters ────────────

    public getTrades(): BacktestTrade[] { return this.closedTrades; }
    public getEquityCurve(): EquityPoint[] { return this.equityCurve; }
    public getCurrentEquity(): number { return this.equity; }
}
