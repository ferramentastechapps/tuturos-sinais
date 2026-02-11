// Signal Engine — Main orchestrator that runs signal generation loop

import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import { bybitConnector } from '../exchange/bybitConnector.js';
import { predictSignal, isModelLoaded } from '../ml/mlPredictionService.js';
import { telegramService } from '../notifications/telegramService.js';
import type { TradeSignal, TechnicalIndicator, OHLCPoint, CryptoPair } from '../types/trading.js';

// ──── State ────

let activeSignals: TradeSignal[] = [];
let signalHistory: TradeSignal[] = [];
let signalsToday = 0;
let signalsSent = 0;
let lastSignalAt: string | null = null;
let engineRunning = false;
let engineInterval: NodeJS.Timeout | null = null;

// ──── Simplified Technical Indicators (server-side) ────

function calculateRSI(closes: number[], period = 14): number {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calculateEMA(data: number[], period: number): number[] {
    if (data.length === 0) return [];
    const k = 2 / (period + 1);
    const result: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) {
        result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    return result;
}

function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);
    if (ema12.length === 0 || ema26.length === 0) return { macd: 0, signal: 0, histogram: 0 };
    const macdLine = ema12.map((v, i) => v - ema26[i]);
    const signalLine = calculateEMA(macdLine, 9);
    const last = macdLine.length - 1;
    return {
        macd: macdLine[last] || 0,
        signal: signalLine[last] || 0,
        histogram: (macdLine[last] || 0) - (signalLine[last] || 0),
    };
}

function calculateATR(ohlc: OHLCPoint[], period = 14): number {
    if (ohlc.length < period + 1) return 0;
    const trs: number[] = [];
    for (let i = 1; i < ohlc.length; i++) {
        const tr = Math.max(
            ohlc[i].high - ohlc[i].low,
            Math.abs(ohlc[i].high - ohlc[i - 1].close),
            Math.abs(ohlc[i].low - ohlc[i - 1].close)
        );
        trs.push(tr);
    }
    const recent = trs.slice(-period);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
}

function calculateADX(ohlc: OHLCPoint[], period = 14): number {
    if (ohlc.length < period * 2) return 25;
    let plusDM = 0, minusDM = 0, tr = 0;
    for (let i = ohlc.length - period; i < ohlc.length; i++) {
        const upMove = ohlc[i].high - ohlc[i - 1].high;
        const downMove = ohlc[i - 1].low - ohlc[i].low;
        plusDM += upMove > downMove && upMove > 0 ? upMove : 0;
        minusDM += downMove > upMove && downMove > 0 ? downMove : 0;
        tr += Math.max(
            ohlc[i].high - ohlc[i].low,
            Math.abs(ohlc[i].high - ohlc[i - 1].close),
            Math.abs(ohlc[i].low - ohlc[i - 1].close)
        );
    }
    if (tr === 0) return 25;
    const plusDI = (plusDM / tr) * 100;
    const minusDI = (minusDM / tr) * 100;
    const diSum = plusDI + minusDI;
    if (diSum === 0) return 0;
    return Math.abs(plusDI - minusDI) / diSum * 100;
}

// ──── Signal Scoring ────

function getIndicatorSignal(name: string, value: number): 'bullish' | 'bearish' | 'neutral' {
    if (name === 'RSI') {
        if (value < 30) return 'bullish';
        if (value > 70) return 'bearish';
        return 'neutral';
    }
    if (name === 'MACD') {
        if (value > 0) return 'bullish';
        if (value < 0) return 'bearish';
        return 'neutral';
    }
    return 'neutral';
}

function generateSignalFromData(
    symbol: string,
    ohlc: OHLCPoint[],
    currentPrice: number,
    high24h: number,
    low24h: number,
    volume24h: number,
    fundingRate: number,
): TradeSignal | null {
    if (ohlc.length < 50) return null;

    const closes = ohlc.map(c => c.close);
    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);
    const atr = calculateATR(ohlc);
    const adx = calculateADX(ohlc);

    const lastEma20 = ema20[ema20.length - 1] || currentPrice;
    const lastEma50 = ema50[ema50.length - 1] || currentPrice;
    const lastEma200 = ema200[ema200.length - 1] || currentPrice;

    // Build indicator list
    const indicators: TechnicalIndicator[] = [
        { name: 'RSI', value: rsi, signal: getIndicatorSignal('RSI', rsi) },
        { name: 'MACD', value: macd.histogram, signal: getIndicatorSignal('MACD', macd.histogram) },
        { name: 'EMA 20', value: lastEma20, signal: currentPrice > lastEma20 ? 'bullish' : 'bearish' },
        { name: 'EMA 50', value: lastEma50, signal: currentPrice > lastEma50 ? 'bullish' : 'bearish' },
        { name: 'EMA 200', value: lastEma200, signal: currentPrice > lastEma200 ? 'bullish' : 'bearish' },
        { name: 'ADX', value: adx, signal: adx > 25 ? 'bullish' : 'neutral' },
    ];

    // Count confluences
    const bullishCount = indicators.filter(i => i.signal === 'bullish').length;
    const bearishCount = indicators.filter(i => i.signal === 'bearish').length;

    // Determine direction
    let type: 'long' | 'short';
    let score: number;
    const confluences: string[] = [];

    if (bullishCount >= 4) {
        type = 'long';
        score = 50 + bullishCount * 7;
        confluences.push(`${bullishCount} indicadores bullish`);
    } else if (bearishCount >= 4) {
        type = 'short';
        score = 50 + bearishCount * 7;
        confluences.push(`${bearishCount} indicadores bearish`);
    } else {
        return null; // Not enough confluence
    }

    // RSI extremes bonus
    if (type === 'long' && rsi < 35) { score += 10; confluences.push('RSI oversold'); }
    if (type === 'short' && rsi > 65) { score += 10; confluences.push('RSI overbought'); }

    // Trend alignment bonus
    if (type === 'long' && currentPrice > lastEma200) { score += 5; confluences.push('Above EMA 200'); }
    if (type === 'short' && currentPrice < lastEma200) { score += 5; confluences.push('Below EMA 200'); }

    // ADX strong trend bonus
    if (adx > 35) { score += 8; confluences.push('Strong trend (ADX)'); }

    // MACD confirmation
    if ((type === 'long' && macd.histogram > 0) || (type === 'short' && macd.histogram < 0)) {
        score += 5;
        confluences.push('MACD confirmed');
    }

    // Funding rate contra-trade bonus
    if (type === 'long' && fundingRate < -0.01) { score += 5; confluences.push('Negative funding (contrarian)'); }
    if (type === 'short' && fundingRate > 0.01) { score += 5; confluences.push('Positive funding (contrarian)'); }

    // Cap score
    score = Math.min(score, 100);

    // Minimum score filter
    if (score < 55) return null;

    // Calculate levels
    const atrPercent = currentPrice > 0 ? (atr / currentPrice * 100) : 2;
    const stopLossDistance = Math.max(atrPercent * 1.5, 1);
    const tp1Distance = stopLossDistance * 1.5;
    const tp2Distance = stopLossDistance * 2.5;
    const tp3Distance = stopLossDistance * 4;

    let entry: number, stopLoss: number, tp1: number, tp2: number, tp3: number;

    if (type === 'long') {
        entry = currentPrice;
        stopLoss = currentPrice * (1 - stopLossDistance / 100);
        tp1 = currentPrice * (1 + tp1Distance / 100);
        tp2 = currentPrice * (1 + tp2Distance / 100);
        tp3 = currentPrice * (1 + tp3Distance / 100);
    } else {
        entry = currentPrice;
        stopLoss = currentPrice * (1 + stopLossDistance / 100);
        tp1 = currentPrice * (1 - tp1Distance / 100);
        tp2 = currentPrice * (1 - tp2Distance / 100);
        tp3 = currentPrice * (1 - tp3Distance / 100);
    }

    const riskReward = tp1Distance / stopLossDistance;

    return {
        id: `${symbol}-${Date.now()}`,
        pair: symbol,
        type,
        entry,
        takeProfit: tp1,
        takeProfit1: tp1,
        takeProfit2: tp2,
        takeProfit3: tp3,
        stopLoss,
        riskReward: Math.round(riskReward * 10) / 10,
        timeframe: '1h',
        status: 'active',
        confidence: score,
        createdAt: new Date(),
        indicators: confluences,
        quality: {
            score,
            factors: confluences,
        },
    };
}

// ──── Engine Loop ────

async function runSignalCycle(): Promise<void> {
    logger.info('Running signal generation cycle...');

    const symbols = config.monitoredSymbols;
    const newSignals: TradeSignal[] = [];

    for (const symbol of symbols) {
        try {
            // Get OHLC data - prefer cached WebSocket data, fallback to REST
            let ohlc = bybitConnector.getKlineData(symbol);
            if (ohlc.length < 50) {
                ohlc = await bybitConnector.fetchKlines(symbol, '60', 200);
            }
            if (ohlc.length < 50) continue;

            const ticker = bybitConnector.getTicker(symbol);
            const currentPrice = ticker?.lastPrice || ohlc[ohlc.length - 1].close;
            const high24h = ticker?.highPrice24h || Math.max(...ohlc.slice(-24).map(c => c.high));
            const low24h = ticker?.lowPrice24h || Math.min(...ohlc.slice(-24).map(c => c.low));
            const volume24h = ticker?.turnover24h || 0;
            const fundingRate = parseFloat(ticker?.fundingRate || '0');

            const signal = generateSignalFromData(
                symbol, ohlc, currentPrice, high24h, low24h, volume24h, fundingRate
            );

            if (signal && signal.quality && signal.quality.score >= 60) {
                // ML enrichment
                if (isModelLoaded()) {
                    try {
                        const features = {
                            rsi: calculateRSI(ohlc.map(c => c.close)),
                            adx: calculateADX(ohlc),
                            atr_rel: calculateATR(ohlc) / currentPrice,
                            dist_ema20: (currentPrice - (calculateEMA(ohlc.map(c => c.close), 20).pop() || currentPrice)) / currentPrice,
                            dist_ema50: (currentPrice - (calculateEMA(ohlc.map(c => c.close), 50).pop() || currentPrice)) / currentPrice,
                            dist_ema200: (currentPrice - (calculateEMA(ohlc.map(c => c.close), 200).pop() || currentPrice)) / currentPrice,
                            dist_vwap: 0,
                            volatility_24h: high24h > 0 ? (high24h - low24h) / ((high24h + low24h) / 2) * 100 : 0,
                            volume_rel: 1,
                            funding_rate: fundingRate,
                            open_interest_var: 0,
                            long_short_ratio: 1,
                            is_long: signal.type === 'long' ? 1 : 0,
                            confidence: signal.confidence / 100,
                            quality_score: signal.quality.score / 100,
                            confluence_count: signal.indicators.length,
                            stop_loss_pct: Math.abs(signal.entry - signal.stopLoss) / signal.entry * 100,
                            take_profit_pct: Math.abs(signal.takeProfit - signal.entry) / signal.entry * 100,
                            risk_reward: signal.riskReward,
                            hour_of_day: new Date().getHours(),
                            day_of_week: new Date().getDay(),
                            btc_trend: 0,
                            dominance_btc: 50,
                            fear_greed: 50,
                        };

                        const prediction = await predictSignal(features);
                        if (prediction) {
                            signal.mlData = {
                                probability: prediction.probability,
                                predictedClass: prediction.predictedClass,
                                confidence: prediction.confidence,
                                isFiltered: prediction.probability < 0.5,
                            };

                            // Filter out signals rejected by ML
                            if (prediction.probability < 0.4) {
                                logger.debug(`Signal ${symbol} filtered by ML (prob: ${prediction.probability.toFixed(3)})`);
                                continue;
                            }
                        }
                    } catch (mlError) {
                        logger.warn(`ML enrichment failed for ${symbol}`, { error: mlError });
                    }
                }

                newSignals.push(signal);
                signalsToday++;
                lastSignalAt = new Date().toISOString();

                // Send Telegram notification
                if (telegramService.isEnabled && signal.quality.score >= config.telegram.minScore) {
                    try {
                        await telegramService.sendNewSignal({
                            type: signal.type,
                            symbol: signal.pair,
                            score: signal.quality.score,
                            scoreLabel: signal.quality.score >= 80 ? 'Excelente' : signal.quality.score >= 70 ? 'Bom' : 'Moderado',
                            timeframe: signal.timeframe,
                            currentPrice: signal.entry,
                            entryZone: { min: signal.entry * 0.998, max: signal.entry * 1.002 },
                            stopLoss: {
                                price: signal.stopLoss,
                                percent: Math.abs(signal.entry - signal.stopLoss) / signal.entry * 100,
                            },
                            takeProfits: [
                                { level: 1, price: signal.takeProfit1 || signal.takeProfit, percent: Math.abs(signal.takeProfit - signal.entry) / signal.entry * 100, closePercent: 40 },
                                ...(signal.takeProfit2 ? [{ level: 2, price: signal.takeProfit2, percent: Math.abs(signal.takeProfit2 - signal.entry) / signal.entry * 100, closePercent: 30 }] : []),
                                ...(signal.takeProfit3 ? [{ level: 3, price: signal.takeProfit3, percent: Math.abs(signal.takeProfit3 - signal.entry) / signal.entry * 100, closePercent: 30 }] : []),
                            ],
                            riskReward: signal.riskReward,
                            confluences: signal.indicators.map(i => ({ name: i, confirmed: true })),
                            leverage: 5,
                            positionSizePercent: 10,
                            riskPercent: 2,
                            timestamp: new Date().toISOString(),
                        });
                        signalsSent++;
                    } catch (telegramError) {
                        logger.warn(`Telegram notification failed for ${symbol}`, { error: telegramError });
                    }
                }

                logger.info(`Signal generated: ${signal.type.toUpperCase()} ${symbol}`, {
                    score: signal.quality.score,
                    rr: signal.riskReward,
                    indicators: signal.indicators,
                });
            }
        } catch (error) {
            logger.error(`Error processing ${symbol}`, { error });
        }
    }

    // Update active signals (keep last 50)
    activeSignals = [...newSignals, ...activeSignals].slice(0, 50);

    // Move to history
    signalHistory = [...newSignals, ...signalHistory].slice(0, 500);

    logger.info(`Signal cycle complete: ${newSignals.length} new signals`, {
        totalActive: activeSignals.length,
        signalsToday,
        signalsSent,
    });
}

// ──── Public API ────

export function startEngine(): void {
    if (engineRunning) return;
    engineRunning = true;
    signalsToday = 0;
    signalsSent = 0;

    // Run immediately, then on interval
    runSignalCycle().catch(err => logger.error('Signal cycle error', { error: err }));

    engineInterval = setInterval(() => {
        runSignalCycle().catch(err => logger.error('Signal cycle error', { error: err }));
    }, config.engine.signalIntervalMs);

    logger.info('Signal engine started', { interval: `${config.engine.signalIntervalMs / 1000}s` });
}

export function stopEngine(): void {
    if (engineInterval) clearInterval(engineInterval);
    engineRunning = false;
    logger.info('Signal engine stopped');
}

export function getActiveSignals(): TradeSignal[] {
    return activeSignals;
}

export function getSignalHistory(): TradeSignal[] {
    return signalHistory;
}

export function getSignalById(id: string): TradeSignal | undefined {
    return [...activeSignals, ...signalHistory].find(s => s.id === id);
}

export function getEngineStats() {
    return {
        running: engineRunning,
        signalsToday,
        signalsSent,
        lastSignalAt,
        activeCount: activeSignals.length,
        historyCount: signalHistory.length,
    };
}

export function isEngineRunning(): boolean {
    return engineRunning;
}
