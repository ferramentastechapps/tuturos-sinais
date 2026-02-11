// ═══════════════════════════════════════════════════════════
// Backtest Engine — Full Simulation Engine
// Bar-by-bar simulation with no lookahead bias
// Integrates advancedSignalGenerator + dynamicRiskAdjuster
// ═══════════════════════════════════════════════════════════

import { OHLCPoint } from '@/services/coingeckoOHLC';
import { generateAdvancedSignal, AdvancedSignal, AdvancedSignalInput, enrichSignalWithML } from '@/services/advancedSignalGenerator';
import { extractFeatures } from '@/services/ml/featureExtractor';
import {
    calculateRSI, calculateMACD, calculateEMA, calculateVWAPFromOHLC,
    calculateATRFromOHLC, calculateADXFromOHLC,
} from '@/utils/technicalIndicators';
import { TechnicalIndicator } from '@/types/trading';
import {
    BacktestConfig, BacktestTrade, EquityPoint, BacktestProgress,
} from '@/types/backtestTypes';

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

// ──────────── Pre-calculated Indicators ────────────

interface IndicatorSnapshot {
    ema20: number;
    ema50: number;
    ema200: number;
    rsi: number;
    macdValue: number;
    macdSignal: number;
    macdHistogram: number;
    vwap: number;
    atr?: number;
    adx?: number;
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

        // Pre-calculate all indicators
        const indicatorMap = this.preCalculateIndicators(history);

        // Determine lookback for 24h approximation
        const lookback24h = this.getLookback24h();

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

            // 5. Generate signal
            const indicators = indicatorMap.get(candle.timestamp);
            if (!indicators) continue;

            const window = history.slice(Math.max(0, i - 300), i + 1);
            const { signal, input } = await this.generateSignalForBar(symbol, candle, indicators, window, lookback24h);

            // 6. Process signal (if any)
            if (signal && this.shouldEnterTrade(signal)) {
                // Close opposite positions first
                this.handleSignalFlip(symbol, signal, candle.timestamp);

                // Enter new position if allowed
                if (this.canOpenNewPosition(symbol)) {
                    this.executeEntry(signal, symbol, candle.timestamp, input);
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

    // ──────────── Pre-calc Indicators ────────────

    private preCalculateIndicators(ohlcData: OHLCPoint[]): Map<number, IndicatorSnapshot> {
        const prices = ohlcData.map(d => ({ timestamp: d.timestamp, price: d.close }));

        const ema20 = calculateEMA(prices, 20);
        const ema50 = calculateEMA(prices, 50);
        const ema200 = calculateEMA(prices, 200);
        const rsi = calculateRSI(prices, 14);
        const macd = calculateMACD(prices);
        const vwap = calculateVWAPFromOHLC(ohlcData);

        // ATR and ADX (from OHLC)
        let atrResults: Array<{ timestamp: number; atr: number }> = [];
        let adxResults: Array<{ timestamp: number; adx: number }> = [];
        try {
            atrResults = calculateATRFromOHLC(ohlcData, 14);
            adxResults = calculateADXFromOHLC(ohlcData, 14);
        } catch {
            // Functions may not exist in all versions
        }

        // Build indexed maps for O(1) access
        const ema20Map = new Map(ema20.map(e => [e.timestamp, e.value]));
        const ema50Map = new Map(ema50.map(e => [e.timestamp, e.value]));
        const ema200Map = new Map(ema200.map(e => [e.timestamp, e.value]));
        const rsiMap = new Map(rsi.map(e => [e.timestamp, e.value]));
        const macdMap = new Map(macd.map(e => [e.timestamp, e] as [number, typeof e]));
        const vwapMap = new Map(vwap.map(e => [e.timestamp, e.vwap] as [number, number]));
        const atrMap = new Map(atrResults.map(e => [e.timestamp, e.atr] as [number, number]));
        const adxMap = new Map(adxResults.map(e => [e.timestamp, e.adx] as [number, number]));

        const result = new Map<number, IndicatorSnapshot>();

        for (const candle of ohlcData) {
            const t = candle.timestamp;
            const macdEntry = macdMap.get(t);

            result.set(t, {
                ema20: ema20Map.get(t) || 0,
                ema50: ema50Map.get(t) || 0,
                ema200: ema200Map.get(t) || 0,
                rsi: rsiMap.get(t) || 50,
                macdValue: macdEntry?.macd || 0,
                macdSignal: macdEntry?.signal || 0,
                macdHistogram: macdEntry?.histogram || 0,
                vwap: vwapMap.get(t) || 0,
                atr: atrMap.get(t),
                adx: adxMap.get(t),
            });
        }

        return result;
    }

    // ──────────── Signal Generation ────────────

    private async generateSignalForBar(
        symbol: string,
        candle: OHLCPoint,
        indicators: IndicatorSnapshot,
        window: OHLCPoint[],
        lookback24h: number
    ): Promise<{ signal: AdvancedSignal | null; input: AdvancedSignalInput }> {
        const rsiValue = indicators.rsi;
        const rsiSignal: TechnicalIndicator['signal'] =
            rsiValue < 30 ? 'bullish' : rsiValue > 70 ? 'bearish' : 'neutral';

        const macdSignal: TechnicalIndicator['signal'] =
            indicators.macdHistogram > 0 ? 'bullish' : indicators.macdHistogram < 0 ? 'bearish' : 'neutral';

        const ema20Signal: TechnicalIndicator['signal'] =
            candle.close > indicators.ema20 ? 'bullish' : 'bearish';
        const ema50Signal: TechnicalIndicator['signal'] =
            candle.close > indicators.ema50 ? 'bullish' : 'bearish';
        const ema200Signal: TechnicalIndicator['signal'] =
            candle.close > indicators.ema200 ? 'bullish' : 'bearish';
        const vwapSignal: TechnicalIndicator['signal'] =
            candle.close > indicators.vwap ? 'bullish' : 'bearish';

        const technicalIndicators: TechnicalIndicator[] = [
            { name: 'RSI', value: rsiValue, signal: rsiSignal },
            { name: 'MACD', value: indicators.macdValue, signal: macdSignal },
            { name: 'EMA 20', value: indicators.ema20, signal: ema20Signal },
            { name: 'EMA 50', value: indicators.ema50, signal: ema50Signal },
            { name: 'EMA 200', value: indicators.ema200, signal: ema200Signal },
            { name: 'VWAP', value: indicators.vwap, signal: vwapSignal },
        ];

        // Add ATR/ADX if available
        if (indicators.atr !== undefined) {
            technicalIndicators.push({ name: 'ATR', value: indicators.atr, signal: 'neutral' });
        }
        if (indicators.adx !== undefined) {
            const adxSignal: TechnicalIndicator['signal'] = indicators.adx > 25 ? 'bullish' : 'neutral';
            technicalIndicators.push({ name: 'ADX', value: indicators.adx, signal: adxSignal });
        }

        const recentSlice = window.slice(-lookback24h);
        const high24h = Math.max(...recentSlice.map(c => c.high));
        const low24h = Math.min(...recentSlice.map(c => c.low));
        const volume24h = recentSlice.reduce((sum, c) => sum + (c.volume || 0), 0);

        const signalInput: AdvancedSignalInput = {
            symbol,
            currentPrice: candle.close,
            indicators: technicalIndicators,
            high24h,
            low24h,
            ohlcData: window,
            volume24h,
        };

        try {
            let signal = generateAdvancedSignal(signalInput);
            if (signal) {
                signal = await enrichSignalWithML(signal, signalInput);
            }
            return { signal, input: signalInput };
        } catch (e) {
            // Swallow errors from signal generator
            return { signal: null, input: signalInput };
        }
    }

    // ──────────── Helper Methods ────────────

    private handleSignalFlip(symbol: string, signal: AdvancedSignal, timestamp: number): void {
        const existingPositionIndex = this.positions.findIndex(p => p.symbol === symbol);
        if (existingPositionIndex !== -1) {
            const existingPosition = this.positions[existingPositionIndex];
            if (existingPosition.type !== signal.type) {
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

    private shouldEnterTrade(signal: AdvancedSignal): boolean {
        const { minScore, allowLong, allowShort } = this.config.signal;

        // Direction filter
        if (signal.type === 'long' && !allowLong) return false;
        if (signal.type === 'short' && !allowShort) return false;

        // Score filter
        if (signal.quality.score < minScore) return false;

        // Confidence filter (min 60)
        if (signal.confidence < 60) return false;

        // Capital per position
        const maxCapitalForPosition = this.equity * (this.config.signal.maxCapitalPerPosition / 100);
        if (maxCapitalForPosition < 10) return false; // Min $10

        // Risk blocked
        if (signal.riskData?.isBlocked) return false;

        return true;
    }

    // ──────────── Trade Execution ────────────

    private executeEntry(
        signal: AdvancedSignal,
        symbol: string,
        timestamp: number,
        signalInput: AdvancedSignalInput
    ): void {
        const maxCapital = this.equity * (this.config.signal.maxCapitalPerPosition / 100);

        // Apply slippage + spread
        const feeRate = this.config.execution.useMarketOrders
            ? this.config.execution.takerFee / 100
            : this.config.execution.makerFee / 100;
        const spreadImpact = this.config.execution.spread / 100 / 2;
        const slippageImpact = this.config.execution.slippage / 100;
        const totalEntryImpact = spreadImpact + slippageImpact;

        const entryPrice = signal.type === 'long'
            ? signal.entry * (1 + totalEntryImpact)
            : signal.entry * (1 - totalEntryImpact);

        // Position sizing
        const riskPerTrade = signal.riskData?.riskPerTradePercent || 1;
        const riskAmount = this.equity * (riskPerTrade / 100);
        const priceDiff = Math.abs(entryPrice - signal.stopLoss);

        if (priceDiff === 0) return;

        let quantity = riskAmount / priceDiff;
        const leverage = signal.riskData?.leverage || 1;
        const maxQty = (maxCapital * leverage) / entryPrice;
        quantity = Math.min(quantity, maxQty);

        if (quantity * entryPrice < 5) return; // Min notional

        const position: ActivePosition = {
            id: `bt_${this.tradeIdCounter++}`,
            symbol,
            type: signal.type,
            entryPrice,
            quantity,
            leverage,
            stopLoss: signal.stopLoss,
            takeProfit1: signal.takeProfit1 || signal.takeProfit,
            takeProfit2: signal.takeProfit2 || signal.takeProfit,
            takeProfit3: signal.takeProfit3 || signal.takeProfit * 1.5,
            entryTime: timestamp,
            signalScore: signal.quality.score,
            signalConfidence: signal.confidence,
            signalIndicators: signal.indicators || [],
            riskScore: signal.riskData?.score || 50,
            maxPrice: entryPrice,
            minPrice: entryPrice,
            fundingAccumulated: 0,
            tp1Hit: false,
            tp2Hit: false,
            capitalAtEntry: this.equity,
            mlFeatures: extractFeatures(signal, signalInput) as unknown as Record<string, number>,
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
