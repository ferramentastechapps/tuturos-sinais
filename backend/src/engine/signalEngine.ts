// Signal Engine — Main orchestrator that runs signal generation loop

import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import { bybitConnector } from '../exchange/bybitConnector.js';
import { predictSignal, isModelLoaded } from '../ml/mlPredictionService.js';
import { telegramService } from '../notifications/telegramService.js';
import { db } from '../lib/dbClient.js';
import { marketContextService } from '../lib/marketContextService.js';
import type { TradeSignal, TechnicalIndicator, OHLCPoint, CryptoPair } from '../types/trading.js';
import { tradeTracker } from '../trading/tradeTracker.js';
import { indicatorLearner } from '../ml/indicatorLearner.js';
import { validateSignalContext } from './marketContext.js'; // FASE 3
import { isHighLiquidity } from '../config/highLiquiditySymbols.js'; // CORREÇÃO 5
import { volatilityTracker } from '../services/volatilityTracker.js';

// ──── State ────

let activeSignals: TradeSignal[] = [];
let signalHistory: TradeSignal[] = [];
let signalsToday = 0;
let signalsSent = 0;
let lastSignalAt: string | null = null;
let engineRunning = false;
let engineInterval: NodeJS.Timeout | null = null;

// Rastreia quais moedas já geraram sinal hoje (evita repetição e força diversificação)
const symbolsSignaledToday = new Set<string>();
let lastDayReset = new Date().toDateString();

function checkAndResetDailyCounters(): void {
    const today = new Date().toDateString();
    if (today !== lastDayReset) {
        signalsToday = 0;
        symbolsSignaledToday.clear();
        lastDayReset = today;
        logger.info('[Engine] Contadores diários resetados (novo dia)');
    }
}

// Fisher-Yates shuffle — embaralha a lista de símbolos a cada ciclo
// para garantir rotação justa entre os 86+ pares (não favorece BTC/ETH/SOL)
function shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// ──── Simplified Technical Indicators (server-side) ────

export function calculateRSI(closes: number[], period = 14): number {
    if (closes.length < period + 1) return 50;

    // Seed: média simples dos primeiros N períodos
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= period; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) avgGain += diff;
        else avgLoss += Math.abs(diff);
    }
    avgGain /= period;
    avgLoss /= period;

    // Suavização de Wilder (EMA recursiva) para o resto dos dados
    for (let i = period + 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? Math.abs(diff) : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

export function calculateEMA(data: number[], period: number): number[] {
    if (data.length === 0) return [];
    const k = 2 / (period + 1);
    const result: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) {
        result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    return result;
}

export function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number; isBullishCross: boolean; isBearishCross: boolean } {
    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);
    if (ema12.length === 0 || ema26.length === 0) return { macd: 0, signal: 0, histogram: 0, isBullishCross: false, isBearishCross: false };
    const macdLine = ema12.map((v, i) => v - ema26[i]);
    const signalLine = calculateEMA(macdLine, 9);
    const last = macdLine.length - 1;
    const prev = last - 1;
    // Crossover detection: MACD crossed signal line in the last candle
    const isBullishCross = prev >= 0 && macdLine[prev] < signalLine[prev] && macdLine[last] >= signalLine[last];
    const isBearishCross = prev >= 0 && macdLine[prev] > signalLine[prev] && macdLine[last] <= signalLine[last];
    return {
        macd: macdLine[last] || 0,
        signal: signalLine[last] || 0,
        histogram: (macdLine[last] || 0) - (signalLine[last] || 0),
        isBullishCross,
        isBearishCross,
    };
}

export function calculateBollingerBands(closes: number[], period = 20, stdDev = 2): { upper: number; lower: number; middle: number; isSqueeze: boolean; percentB: number } {
    if (closes.length < period) return { upper: 0, lower: 0, middle: 0, isSqueeze: false, percentB: 0.5 };
    const slice = closes.slice(-period);
    const middle = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period;
    const std = Math.sqrt(variance);
    const upper = middle + stdDev * std;
    const lower = middle - stdDev * std;
    const bandWidth = (upper - lower) / middle;
    // Squeeze: bandwidth is in the bottom 20% of recent range (low volatility about to expand)
    const recentSlices = closes.length >= period + 20
        ? Array.from({ length: 20 }, (_, k) => {
            const s = closes.slice(-(period + 20 - k), -(20 - k) || closes.length);
            const m = s.reduce((a, b) => a + b, 0) / s.length;
            const v = s.reduce((a, b) => a + Math.pow(b - m, 2), 0) / s.length;
            const sd = Math.sqrt(v);
            return (m + stdDev * sd - (m - stdDev * sd)) / m;
          })
        : [bandWidth];
    const minBw = Math.min(...recentSlices);
    const maxBw = Math.max(...recentSlices);
    const isSqueeze = maxBw > minBw && bandWidth <= minBw * 1.1;
    const lastClose = closes[closes.length - 1];
    const percentB = upper !== lower ? (lastClose - lower) / (upper - lower) : 0.5;
    return { upper, lower, middle, isSqueeze, percentB };
}

export function calculateATR(ohlc: OHLCPoint[], period = 14): number {
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

export function calculateADX(ohlc: OHLCPoint[], period = 14): number {
    const needed = period * 2 + 1;
    if (ohlc.length < needed) return 25;

    // Step 1: Seed — simple sum of first `period` TR/DM values
    let smoothTR = 0, smoothPlusDM = 0, smoothMinusDM = 0;
    for (let i = 1; i <= period; i++) {
        const upMove   = ohlc[i].high - ohlc[i - 1].high;
        const downMove = ohlc[i - 1].low - ohlc[i].low;
        smoothTR       += Math.max(ohlc[i].high - ohlc[i].low, Math.abs(ohlc[i].high - ohlc[i - 1].close), Math.abs(ohlc[i].low - ohlc[i - 1].close));
        smoothPlusDM   += (upMove > downMove && upMove > 0) ? upMove : 0;
        smoothMinusDM  += (downMove > upMove && downMove > 0) ? downMove : 0;
    }

    // Step 2: Wilder smoothing (RMA) for DI values
    let adxSmooth = 0;
    for (let i = period + 1; i < ohlc.length; i++) {
        const upMove   = ohlc[i].high - ohlc[i - 1].high;
        const downMove = ohlc[i - 1].low - ohlc[i].low;
        const tr       = Math.max(ohlc[i].high - ohlc[i].low, Math.abs(ohlc[i].high - ohlc[i - 1].close), Math.abs(ohlc[i].low - ohlc[i - 1].close));
        const plusDM   = (upMove > downMove && upMove > 0) ? upMove : 0;
        const minusDM  = (downMove > upMove && downMove > 0) ? downMove : 0;

        smoothTR      = smoothTR - (smoothTR / period) + tr;
        smoothPlusDM  = smoothPlusDM - (smoothPlusDM / period) + plusDM;
        smoothMinusDM = smoothMinusDM - (smoothMinusDM / period) + minusDM;

        if (smoothTR === 0) continue;
        const plusDI  = (smoothPlusDM / smoothTR) * 100;
        const minusDI = (smoothMinusDM / smoothTR) * 100;
        const diSum   = plusDI + minusDI;
        const dx      = diSum === 0 ? 0 : (Math.abs(plusDI - minusDI) / diSum) * 100;

        // Wilder smooth ADX from period+1 seeds onward
        if (i === period + 1) {
            adxSmooth = dx;
        } else {
            adxSmooth = (adxSmooth * (period - 1) + dx) / period;
        }
    }

    return adxSmooth;
}

export function calculateVWAP(ohlc: OHLCPoint[]): number {
    if (ohlc.length === 0) return 0;
    let cumulativeVolume = 0;
    let cumulativeTypicalPriceVolume = 0;

    for (let i = 0; i < ohlc.length; i++) {
        const candle = ohlc[i];
        const typicalPrice = (candle.high + candle.low + candle.close) / 3;
        const volume = candle.volume || 0;
        
        cumulativeTypicalPriceVolume += typicalPrice * volume;
        cumulativeVolume += volume;
    }

    if (cumulativeVolume === 0) return 0;
    return cumulativeTypicalPriceVolume / cumulativeVolume;
}

export function calculateRVOL(ohlc: OHLCPoint[], period = 20): number {
    if (ohlc.length < period + 1) return 1;
    
    // Calcula o volume médio das N últimas velas (excluindo a última que ainda está a formar)
    const prevCandles = ohlc.slice(-(period + 1), -1);
    let totalVol = 0;
    for (let i = 0; i < prevCandles.length; i++) {
        totalVol += prevCandles[i].volume || 0;
    }
    
    const avgVolume = totalVol / period;
    if (avgVolume === 0) return 1;

    // Volume da vela actual
    const currentVolume = ohlc[ohlc.length - 1].volume || 0;
    
    // Retorna o RVOL (Ex: 1.5 significa 50% superior ao volume médio)
    return currentVolume / avgVolume;
}

// ──── Smart Money Concepts (ICT) ────

export function calculateAnchoredVWAP(ohlc: OHLCPoint[], anchorType: 'day' | 'week' = 'day'): number {
    if (ohlc.length === 0) return 0;
    let cumulativeVolume = 0;
    let cumulativeTypicalPriceVolume = 0;
    
    // Encontrar o índice da âncora (ex: início do dia ou da semana em UTC)
    let anchorIdx = 0;
    const lastTimestamp = ohlc[ohlc.length - 1].timestamp;
    const lastDate = new Date(lastTimestamp);
    
    for (let i = ohlc.length - 1; i >= 0; i--) {
        const d = new Date(ohlc[i].timestamp);
        if (anchorType === 'day' && d.getUTCDate() !== lastDate.getUTCDate()) {
            anchorIdx = i + 1;
            break;
        }
        if (anchorType === 'week' && d.getUTCDay() === 1 && d.getUTCHours() === 0) { // Segunda-feira à meia noite
            anchorIdx = i;
            break;
        }
    }
    
    for (let i = anchorIdx; i < ohlc.length; i++) {
        const candle = ohlc[i];
        const typicalPrice = (candle.high + candle.low + candle.close) / 3;
        const vol = candle.volume || 0;
        
        cumulativeTypicalPriceVolume += typicalPrice * vol;
        cumulativeVolume += vol;
    }
    
    if (cumulativeVolume === 0) return 0;
    return cumulativeTypicalPriceVolume / cumulativeVolume;
}

export function detectFVG(ohlc: OHLCPoint[]): { isBullishFvg: boolean, isBearishFvg: boolean } {
    if (ohlc.length < 3) return { isBullishFvg: false, isBearishFvg: false };
    const c1 = ohlc[ohlc.length - 3];
    const c3 = ohlc[ohlc.length - 1];
    
    // Bullish FVG: Low da vela 3 é muito MAIOR que a High da vela 1 (GAP de Alta)
    const isBullishFvg = c3.low > c1.high && c1.close > c1.open; 
    
    // Bearish FVG: High da vela 3 é muito MENOR que a Low da vela 1 (GAP de Baixa)
    const isBearishFvg = c3.high < c1.low && c1.close < c1.open;
    
    return { isBullishFvg, isBearishFvg };
}

export function detectLiquiditySweep(ohlc: OHLCPoint[], high24h: number, low24h: number): { isSweepLow: boolean, isSweepHigh: boolean } {
    if (ohlc.length === 0) return { isSweepLow: false, isSweepHigh: false };
    const last = ohlc[ohlc.length - 1]; // Vela Actual
    
    // Sweeplow (Caça Stops de Compra): O pavio (Low) rompeu a low das 24h, mas o corpo fechou ACIMA da low24h.
    const isSweepLow = last.low < low24h && last.close > low24h && last.open > low24h;
    
    // Sweephigh (Caça Stops de Venda): O pavio (High) rompeu a high das 24h, mas o corpo fechou ABAIXO da high24h.
    const isSweepHigh = last.high > high24h && last.close < high24h && last.open < high24h;
    
    return { isSweepLow, isSweepHigh };
}

// ──── Order Block (ICT) Detection ────

export interface OrderBlock {
    high: number;
    low: number;
    midpoint: number;
    index: number;
}

/**
 * detectOrderBlock — Identifies the last candle of the opposite type before a strong impulse
 * Bullish OB: Last bearish candle before a strong upward move (>= 1.5x ATR)
 * Bearish OB: Last bullish candle before a strong downward move (>= 1.5x ATR)
 */
export function detectOrderBlock(ohlc: OHLCPoint[], atr: number): {
    bullishOB: OrderBlock | null;
    bearishOB: OrderBlock | null;
    priceInBullishOB: boolean;
    priceInBearishOB: boolean;
} {
    if (ohlc.length < 10 || atr === 0) {
        return { bullishOB: null, bearishOB: null, priceInBullishOB: false, priceInBearishOB: false };
    }

    const impulseThreshold = atr * 1.5;
    const currentPrice = ohlc[ohlc.length - 1].close;
    let bullishOB: OrderBlock | null = null;
    let bearishOB: OrderBlock | null = null;

    const lookback = Math.min(ohlc.length - 2, 30);
    for (let i = ohlc.length - 2; i >= ohlc.length - lookback; i--) {
        const candle = ohlc[i];
        const nextCandle = ohlc[i + 1];

        if (!bullishOB) {
            const isBearishCandle = candle.close < candle.open;
            const isBullishImpulse = (nextCandle.close - nextCandle.open) >= impulseThreshold && nextCandle.close > candle.high;
            if (isBearishCandle && isBullishImpulse) {
                bullishOB = { high: candle.open, low: candle.close, midpoint: (candle.open + candle.close) / 2, index: i };
            }
        }

        if (!bearishOB) {
            const isBullishCandle = candle.close > candle.open;
            const isBearishImpulse = (candle.open - nextCandle.close) >= impulseThreshold && nextCandle.close < candle.low;
            if (isBullishCandle && isBearishImpulse) {
                bearishOB = { high: candle.close, low: candle.open, midpoint: (candle.open + candle.close) / 2, index: i };
            }
        }

        if (bullishOB && bearishOB) break;
    }

    const priceInBullishOB = bullishOB !== null && currentPrice >= bullishOB.low && currentPrice <= bullishOB.high;
    const priceInBearishOB = bearishOB !== null && currentPrice >= bearishOB.low && currentPrice <= bearishOB.high;

    return { bullishOB, bearishOB, priceInBullishOB, priceInBearishOB };
}

/**
 * detectSwingStructure — Detects most recent swing low and swing high for structural SL placement
 */
export function detectSwingStructure(ohlc: OHLCPoint[], lookback = 15): { swingLow: number; swingHigh: number } {
    if (ohlc.length < lookback + 4) {
        const last = ohlc[ohlc.length - 1];
        return { swingLow: last.low, swingHigh: last.high };
    }

    let swingLow = Infinity;
    let swingHigh = -Infinity;
    const windowSize = 3;
    const slice = ohlc.slice(-(lookback + windowSize * 2));

    for (let i = windowSize; i < slice.length - windowSize; i++) {
        const curr = slice[i];
        const leftCandles = slice.slice(i - windowSize, i);
        const rightCandles = slice.slice(i + 1, i + 1 + windowSize);

        if (leftCandles.every(c => c.low >= curr.low) && rightCandles.every(c => c.low >= curr.low)) {
            if (curr.low < swingLow) swingLow = curr.low;
        }
        if (leftCandles.every(c => c.high <= curr.high) && rightCandles.every(c => c.high <= curr.high)) {
            if (curr.high > swingHigh) swingHigh = curr.high;
        }
    }

    if (swingLow === Infinity) swingLow = Math.min(...ohlc.slice(-lookback).map(c => c.low));
    if (swingHigh === -Infinity) swingHigh = Math.max(...ohlc.slice(-lookback).map(c => c.high));

    return { swingLow, swingHigh };
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

/**
 * Market Hours Filter — Avoids entries during low-liquidity Asian night session (00:00–06:00 UTC).
 * Crypto is 24/7 but institutional volume drops sharply in this window, increasing fake-outs.
 */
function isWithinTradingHours(): boolean {
    const utcHour = new Date().getUTCHours();
    return utcHour >= 6 && utcHour < 23; // Block only 23:00-05:59 UTC (deepest dead zone)
}

function detectEMA21Pullback(ohlc: OHLCPoint[], ema21: number[], type: 'long' | 'short'): boolean {
    if (ohlc.length < 2) return false;
    const current = ohlc[ohlc.length - 1];
    const prev = ohlc[ohlc.length - 2];
    const ema21Curr = ema21[ema21.length - 1];
    const ema21Prev = ema21[ema21.length - 2];
    
    if (type === 'long') {
        const touched = current.low <= ema21Curr || prev.low <= ema21Prev;
        const closedAbove = current.close > ema21Curr;
        return touched && closedAbove && current.close > current.open; // Vela verde fechando acima
    } else {
        const touched = current.high >= ema21Curr || prev.high >= ema21Prev;
        const closedBelow = current.close < ema21Curr;
        return touched && closedBelow && current.close < current.open; // Vela vermelha fechando abaixo
    }
}

function detectReversalCandles(ohlc: OHLCPoint[], type: 'long' | 'short'): { isEngulfing: boolean, isPinBar: boolean } {
    if (ohlc.length < 2) return { isEngulfing: false, isPinBar: false };
    const current = ohlc[ohlc.length - 1];
    const prev = ohlc[ohlc.length - 2];
    
    const bodySize = Math.abs(current.close - current.open);
    const upperWick = current.high - Math.max(current.open, current.close);
    const lowerWick = Math.min(current.open, current.close) - current.low;
    const totalSize = current.high - current.low;
    
    let isEngulfing = false;
    let isPinBar = false;
    
    if (type === 'long') {
        // Bullish Engulfing: Vela anterior vermelha, atual verde e engolfa o corpo
        isEngulfing = prev.close < prev.open && current.close > current.open && current.close > prev.open && current.open < prev.close;
        // Bullish Pinbar (Martelo): Pavio inferior 2x maior que o corpo, pavio superior pequeno
        isPinBar = lowerWick >= 2 * bodySize && upperWick <= 0.2 * totalSize && current.close > (current.high + current.low) / 2;
    } else {
        // Bearish Engulfing: Vela anterior verde, atual vermelha e engolfa o corpo
        isEngulfing = prev.close > prev.open && current.close < current.open && current.close < prev.open && current.open > prev.close;
        // Bearish Pinbar (Estrela Cadente): Pavio superior 2x maior que o corpo, pavio inferior pequeno
        isPinBar = upperWick >= 2 * bodySize && lowerWick <= 0.2 * totalSize && current.close < (current.high + current.low) / 2;
    }
    
    return { isEngulfing, isPinBar };
}

export function generateSignalFromData(
    symbol: string,
    ohlc: OHLCPoint[], // 1h data
    currentPrice: number,
    high24h: number,
    low24h: number,
    volume24h: number,
    fundingRate: number,
    ohlc15m?: OHLCPoint[],
    ohlc4h?: OHLCPoint[],
    customMinScore?: number,
    indicatorPerf?: Record<string, { winRate: number, avgPnl: number, totalTrades: number }>
): TradeSignal | null {
    if (ohlc.length < 50) return null;

    const closes = ohlc.map(c => c.close);
    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const bb = calculateBollingerBands(closes);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);
    const atr = calculateATR(ohlc);
    const adx = calculateADX(ohlc);
    const vwap = calculateVWAP(ohlc);
    const rvol = calculateRVOL(ohlc);

    // VETOS ABSOLUTOS (Condições extremas de morte de mercado)
    if (adx < 15) {
        logger.debug(`[SIGNAL-DIAG] ${symbol} ❌ VETO ADX: ${adx.toFixed(1)} < 15 (mercado lateral extremo)`);
        return null;
    }
    const currentPriceForVeto = ohlc[ohlc.length - 1].close;
    const atrPercentForVeto = currentPriceForVeto > 0 ? (atr / currentPriceForVeto) * 100 : 0;
    if (atrPercentForVeto < 0.4) {
        logger.debug(`[SIGNAL-DIAG] ${symbol} ❌ VETO ATR: ${atrPercentForVeto.toFixed(2)}% < 0.4% (volatilidade morta)`);
        return null;
    }

    // Calcular volatility_24h
    const volatility_24h_calculated = high24h > 0 ? (high24h - low24h) / ((high24h + low24h) / 2) * 100 : 0;

    // Registrar e verificar volatilidade alta
    volatilityTracker.record(symbol, atrPercentForVeto, volatility_24h_calculated);
    const volCheck = volatilityTracker.isHighVolatility(symbol, atrPercentForVeto, volatility_24h_calculated, 1.3);
    if (volCheck.isHigh) {
        logger.debug(`[SIGNAL-VETO] ${symbol} ❌ VETO VOLATILIDADE ALTA: ${volCheck.reason}`);
        return null;
    }

    const lastEma20 = ema20[ema20.length - 1] || currentPrice;
    const lastEma50 = ema50[ema50.length - 1] || currentPrice;
    const lastEma200 = ema200[ema200.length - 1] || currentPrice;

    // Define a direção (Type) baseada no alinhamento das EMAs 20 e 50 no 1H
    let type: 'long' | 'short';
    if (lastEma20 > lastEma50) type = 'long';
    else type = 'short';

    const mtfContext = { macro: [] as string[], medium: [] as string[], micro: [] as string[] };
    let macroTrend: 'long' | 'short' | 'neutral' = 'neutral';
    
    let trend4h: 'long' | 'short' | 'neutral' = 'neutral';
    let trend1h = type; // EMA20 > EMA50 = long
    let trend15m: 'long' | 'short' | 'neutral' = 'neutral';

    let strongContradict4H = false;

    // Análise MTF - 4H
    if (ohlc4h && ohlc4h.length >= 50) {
        const closes4h = ohlc4h.map(c => c.close);
        const ema20_4h = calculateEMA(closes4h, 20).pop() || currentPrice;
        const ema50_4h  = calculateEMA(closes4h,  50).pop() || currentPrice;
        const ema200_4h = calculateEMA(closes4h, 200).pop() || currentPrice;
        const macd4h = calculateMACD(closes4h);

        trend4h = (currentPrice > ema20_4h && currentPrice > ema50_4h) ? 'long'
                : (currentPrice < ema20_4h && currentPrice < ema50_4h) ? 'short'
                : 'neutral';
        macroTrend = trend4h === 'neutral' ? (currentPrice > ema200_4h ? 'long' : 'short') : trend4h;

        // CORREÇÃO 2: Filtro de tendência macro
        // A pedido do usuário, agora permite trades contra a tendência 4H (EMA200), mas avisa no log.
        const trend4hMacro = currentPrice > ema200_4h ? 'long' : 'short';
        
        if (type === 'long' && trend4hMacro !== 'long') {
            logger.debug(`[SIGNAL-WARN] ${symbol} ⚠️ LONG contra-tendência - tendência 4H bearish (preço < EMA200)`);
            // return null; // Removido a pedido do usuário
        }
        if (type === 'short' && trend4hMacro !== 'short') {
            logger.debug(`[SIGNAL-WARN] ${symbol} ⚠️ SHORT contra-tendência - tendência 4H bullish (preço > EMA200)`);
            // return null; // Removido a pedido do usuário
        }

        // "4H não contradiz fortemente o 1H" -> Veta se preço < EMA200 e MACD cruzado para o lado oposto
        if (type === 'long') {
            strongContradict4H = currentPrice < ema200_4h && macd4h.histogram < 0;
        } else {
            strongContradict4H = currentPrice > ema200_4h && macd4h.histogram > 0;
        }
    } else {
        // CORREÇÃO 2: Se não há dados 4H suficientes, rejeitar o sinal
        logger.debug(`[SIGNAL-VETO] ${symbol} ❌ Dados 4H insuficientes para validar tendência macro`);
        return null;
    }

    if (strongContradict4H) {
        logger.debug(`[SIGNAL-WARN] ${symbol} ⚠️ MTF: 4H fortemente oposto (Preço + MACD contra)`);
        // return null; // Removido a pedido do usuário para permitir contra-tendência
    }

    // Análise MTF - 15M
    if (ohlc15m && ohlc15m.length >= 20) {
        const closes15m = ohlc15m.map(c => c.close);
        const ema20_15m = calculateEMA(closes15m, 20).pop() || currentPrice;
        const ema50_15m = calculateEMA(closes15m, 50).pop() || currentPrice;
        trend15m = (currentPrice > ema20_15m && currentPrice > ema50_15m) ? 'long'
                 : (currentPrice < ema20_15m && currentPrice < ema50_15m) ? 'short'
                 : 'neutral';
    }

    // --- SMART MONEY CONCEPTS (ICT) ---
    const { isBullishFvg, isBearishFvg } = detectFVG(ohlc);
    const { isSweepLow, isSweepHigh } = detectLiquiditySweep(ohlc, high24h, low24h);
    const { bullishOB, bearishOB, priceInBullishOB, priceInBearishOB } = detectOrderBlock(ohlc, atr);
    const { swingLow, swingHigh } = detectSwingStructure(ohlc, 20);

    // --- PRICE ACTION & PATTERNS ---
    const pullback = detectEMA21Pullback(ohlc, ema20, type); // Utiliza a EMA20 como proxy para a EMA21
    const { isEngulfing, isPinBar } = detectReversalCandles(ohlc, type);

    // --- SISTEMA DE PONTUAÇÃO (SCORE 0 a 10) ---
    let rawScore = 0;
    const confluences: string[] = [];

    // 1. EMA Alinhada 1H e 4H (+2)
    if (trend4h === type) {
        rawScore += 2;
        confluences.push('EMA Alinhada 1H e 4H +2');
        mtfContext.macro.push(type === 'long' ? 'Tendência 4H bullish ✅' : 'Tendência 4H bearish ✅');
    } else {
        mtfContext.macro.push('Tendência 4H neutra/oposta ⚠️');
    }

    // 2. Volume RVOL > 1.0 (+2)
    if (rvol > 1.0) {
        rawScore += 2;
        confluences.push('Volume RVOL > 1.0 +2');
    }

    // 3. RSI em zona favorável (40-60) (+1)
    if (rsi >= 40 && rsi <= 60) {
        rawScore += 1;
        confluences.push('RSI Favorável (40-60) +1');
        mtfContext.medium.push('RSI em zona de pullback ✅');
    }

    // 4. ADX > 18 (+1)
    if (adx > 18) {
        rawScore += 1;
        confluences.push('ADX > 18 (Força) +1');
    }

    // 5. ATR > 0.5% (+1)
    if (atrPercentForVeto > 0.5) {
        rawScore += 1;
        confluences.push('ATR > 0.5% (Volatilidade) +1');
    }

    // 6. Sessão London/NY (+1)
    if (isWithinTradingHours()) {
        rawScore += 1;
        confluences.push('Sessão Ativa (London/NY) +1');
    }

    // 7. 4H não em tendência oposta forte (+1)
    // Se não foi vetado antes, significa que não está "fortemente" oposto, mas só ganha ponto se estiver a favor ou neutro
    if (trend4h === type || trend4h === 'neutral') {
        rawScore += 1;
        confluences.push('4H Não Oposto +1');
    }

    // 8. Bônus ICT + Candlesticks (Capped separadamente)
    let ictScore = 0;
    let candleScore = 0;
    
    if (type === 'long') {
        if (isBullishFvg) { ictScore += 1; confluences.push('Bullish FVG +1'); }
        if (isSweepLow) { ictScore += 1; confluences.push('Liquidity Sweep Low +1'); }
        if (priceInBullishOB) { ictScore += 1; confluences.push('Price in OB +1'); }
    } else {
        if (isBearishFvg) { ictScore += 1; confluences.push('Bearish FVG +1'); }
        if (isSweepHigh) { ictScore += 1; confluences.push('Liquidity Sweep High +1'); }
        if (priceInBearishOB) { ictScore += 1; confluences.push('Price in OB +1'); }
    }
    
    if (pullback) { candleScore += 1; confluences.push('Pullback EMA20/21 +1'); }
    if (isEngulfing) { candleScore += 1; confluences.push('Vela Engulfing +1'); }
    if (isPinBar) { candleScore += 1; confluences.push('Pin Bar +1'); }
    
    // Limita cada categoria de bônus independentemente a +2 pontos
    rawScore += Math.min(ictScore, 2);
    rawScore += Math.min(candleScore, 2);

    // --- LÓGICA DE APRENDIZADO (INDICATOR LEARNER) ---
    if (indicatorPerf) {
        for (const ind of confluences) {
            const cleanName = ind.replace(/[✅❌⚡🐋\+0-9]/g, '').trim();
            const perf = indicatorPerf[cleanName];
            if (perf && perf.totalTrades >= 3) {
                if (perf.winRate > 0.6) {
                    rawScore += 1;
                    logger.debug(`[LEARNER-SWING] ${symbol} 👍 Bônus pelo indicador ${cleanName}`);
                } else if (perf.winRate < 0.4) {
                    rawScore -= 1;
                    logger.debug(`[LEARNER-SWING] ${symbol} 👎 Penalidade pelo indicador ${cleanName}`);
                }
            }
        }
    }

    // Cap global: Limita o score cru em 10 pontos
    rawScore = Math.max(0, Math.min(rawScore, 10));

    // Regra de Aprovação: Score >= limiar
    // customMinScore está em escala 0-100, rawScore em 0-10 → converter
    const scoreThreshold = customMinScore !== undefined ? Math.floor(customMinScore / 10) : 6;
    if (rawScore < scoreThreshold) {
        logger.debug(`[SIGNAL-DIAG] ${symbol} ❌ VETO SCORE: Pontuação ${rawScore}/10 < ${scoreThreshold} (min=${customMinScore ?? 60}).`);
        return null;
    }

    // Multiplica por 10 para compatibilidade
    const finalScore = rawScore * 10;

    // --- ICT Order Block + Structural Stop + Fibonacci TPs ---
    // CORREÇÃO 1: Stop Loss dinâmico baseado em ATR(14)
    const atr14 = calculateATR(ohlc, 14);
    const atrMultiplierSL = parseFloat(process.env.ATR_SL_MULTIPLIER || '1.5');
    const atrMultiplierTP = parseFloat(process.env.ATR_TP_MULTIPLIER || '3.0');
    
    // Rejeitar trade se ATR não disponível ou muito baixo
    if (atr14 === 0) {
        logger.debug(`[SIGNAL-VETO] ${symbol} ❌ ATR(14) = 0 - dados insuficientes`);
        return null;
    }
    
    const atrBasedSLDistance = (atr14 * atrMultiplierSL / currentPrice) * 100;
    
    if (atrBasedSLDistance < 0.3) {
        logger.debug(`[SIGNAL-VETO] ${symbol} ❌ ATR-based SL ${atrBasedSLDistance.toFixed(2)}% < 0.3% (volatilidade morta)`);
        return null;
    }
    
    let stopLossDistance = atrBasedSLDistance;
    const atrPercent = currentPrice > 0 ? (atr14 / currentPrice * 100) : 2;
    let obEntryLow = currentPrice * 0.998;
    let obEntryHigh = currentPrice * 1.002;
    let usingStructuralStop = false;

    if (type === 'long' && priceInBullishOB && bullishOB) {
        const structuralStop = Math.min(swingLow, bullishOB.low) * 0.999;
        const structuralDistance = Math.max(((currentPrice - structuralStop) / currentPrice) * 100, 0.5);
        
        // Usar o maior entre ATR-based e structural (mais conservador)
        stopLossDistance = Math.max(atrBasedSLDistance, structuralDistance);
        obEntryLow = bullishOB.low;
        obEntryHigh = bullishOB.high;
        usingStructuralStop = true;
    } else if (type === 'short' && priceInBearishOB && bearishOB) {
        const structuralStop = Math.max(swingHigh, bearishOB.high) * 1.001;
        const structuralDistance = Math.max(((structuralStop - currentPrice) / currentPrice) * 100, 0.5);
        
        // Usar o maior entre ATR-based e structural (mais conservador)
        stopLossDistance = Math.max(atrBasedSLDistance, structuralDistance);
        obEntryLow = bearishOB.low;
        obEntryHigh = bearishOB.high;
        usingStructuralStop = true;
    } else if (type === 'long' && isSweepLow) {
        const lowestWick = ohlc[ohlc.length - 1].low;
        const sweepDistance = Math.max(((currentPrice - lowestWick) / currentPrice * 100) * 1.05, 0.5);
        stopLossDistance = Math.max(atrBasedSLDistance, sweepDistance);
    } else if (type === 'short' && isSweepHigh) {
        const highestWick = ohlc[ohlc.length - 1].high;
        const sweepDistance = Math.max(((highestWick - currentPrice) / currentPrice * 100) * 1.05, 0.5);
        stopLossDistance = Math.max(atrBasedSLDistance, sweepDistance);
    }
    
    // CORREÇÃO 1: TPs baseados em múltiplos de ATR
    let tp1Distance: number, tp2Distance: number, tp3Distance: number;
    if (usingStructuralStop) {
        tp1Distance = stopLossDistance * 1.5;
        tp2Distance = stopLossDistance * 2.0;
        tp3Distance = stopLossDistance * 3.0;
    } else {
        const tpScale = type === macroTrend ? 1 : 0.7;
        tp1Distance = stopLossDistance * 2.0 * tpScale;  // RR 2:1
        tp2Distance = stopLossDistance * 3.0 * tpScale;  // RR 3:1
        tp3Distance = stopLossDistance * 4.5 * tpScale;  // RR 4.5:1
    }

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

    // VETO: R:R mínimo 1.5:1
    if (riskReward < 1.5) {
        logger.debug(`[SIGNAL-DIAG] ${symbol} ❌ VETO R:R: ${riskReward.toFixed(2)} < 1.5 (expectativa negativa)`);
        return null;
    }

    const accountRiskLevel = config.riskManagement.riskPercent;
    const marginPercent = config.riskManagement.marginPercent;
    let dynamicLeverage = Math.round((accountRiskLevel / stopLossDistance) / (marginPercent / 100));
    
    // CORREÇÃO 6: Inverter lógica de alavancagem - score alto = alavancagem MENOR (mais conservador)
    // Problema original: score alto correlacionado com win rate baixo porque aumentava alavancagem
    if (finalScore >= 80) dynamicLeverage = Math.round(dynamicLeverage * 0.8);  // Reduz 20%
    else if (finalScore < 70) dynamicLeverage = Math.round(dynamicLeverage * 1.0); // Mantém base
    
    if (dynamicLeverage < 2) dynamicLeverage = 2;
    if (dynamicLeverage > 30) dynamicLeverage = 30;
    
    logger.debug(`[SCORE-DEBUG] ${symbol} ${type} - Score: ${finalScore}/100, Leverage: ${dynamicLeverage}x, SL: ${stopLossDistance.toFixed(2)}%`);

    let tradeType = 'Day Trade';
    let expectedDuration = '12-24 horas';
    let contextNarrative = `${symbol} demonstra presença ${type === 'long' ? 'compradora' : 'vendedora'}. `;
    
    if (type === macroTrend) {
        tradeType = 'Swing Trade';
        expectedDuration = '2-5 dias';
        contextNarrative += `Sinal alinhado com a tendência macro (4H), proporcionando um Swing Trade com R:R de 1:${riskReward.toFixed(1)}.`;
    } else {
        tradeType = 'Day Trade (Contra-tendência)';
        expectedDuration = '4-12 horas';
        contextNarrative += `Atenção: Operação contra a tendência macro (4H). Alvos reduzidos para Day Trade com R:R de 1:${riskReward.toFixed(1)}.`;
    }

    return {
        id: `SWING-${symbol}-${Date.now()}`,
        pair: symbol,
        type,
        entry,
        takeProfit: tp1,
        takeProfit1: tp1,
        takeProfit2: tp2,
        takeProfit3: tp3,
        stopLoss,
        riskReward: Math.round(riskReward * 10) / 10,
        dynamicLeverage,
        positionSizePercent: marginPercent,
        riskPercent: accountRiskLevel,
        timeframe: '1h',
        status: 'PENDING',
        confidence: finalScore,
        createdAt: new Date(),
        indicators: confluences,
        quality: { score: finalScore, factors: confluences },
        tradeType,
        expectedDuration,
        mtfContext,
        contextNarrative,
        obEntryZone: usingStructuralStop ? { low: obEntryLow, high: obEntryHigh } : null,
        smartMoney: {
            orderBlocks: usingStructuralStop
                ? [{ type, high: obEntryHigh, low: obEntryLow, midpoint: (obEntryLow + obEntryHigh) / 2 }]
                : [],
            fvgs: [],
            liquidity: [],
            isLiquiditySweep: isSweepHigh || isSweepLow,
            fvgZone: isBullishFvg || isBearishFvg,
            isOrderBlock: usingStructuralStop,
        },
        mlData: {
            _rsi: rsi,
            _adx: adx,
            _atr_rel: atr / currentPrice,
            _dist_ema20: (currentPrice - lastEma20) / currentPrice,
            _dist_ema50: (currentPrice - lastEma50) / currentPrice,
            _dist_ema200: (currentPrice - lastEma200) / currentPrice,
            _dist_vwap: (currentPrice - vwap) / currentPrice,
            _volume_rel: rvol,
        },
    } satisfies TradeSignal;
}

// ──── Engine Loop ────

async function runSignalCycle(): Promise<void> {
    logger.info('Running signal generation cycle...');

    // Reseta contadores diários se mudou o dia
    checkAndResetDailyCounters();

    // Limite diário: qualidade > quantidade
    if (signalsToday >= config.engine.maxSignalsPerDay) {
        logger.info(`[Engine] Limite diário de ${config.engine.maxSignalsPerDay} sinais atingido. Próximo ciclo amanhã.`);
        return;
    }

    // Fetch global macro context once per cycle (results are cached internally)
    const globalCtx = await marketContextService.getGlobalContext();
    logger.debug('[Engine] Global context', globalCtx);

    // Embaralha símbolos para rotação justa (evita sempre analisar BTC/ETH/SOL primeiro)
    const symbols = shuffleArray([...config.monitoredSymbols]);
    const newSignals: TradeSignal[] = [];

    for (const symbol of symbols) {
        try {
            // CORREÇÃO 5: Filtrar símbolos de baixa liquidez
            if (!isHighLiquidity(symbol)) {
                logger.debug(`[Engine] ${symbol} ignorado - baixa liquidez (< $100M volume diário)`);
                continue;
            }
            
            // Get OHLC data - prefer cached WebSocket data, fallback to REST
            let ohlc = bybitConnector.getKlineData(symbol);
            if (ohlc.length < 50) {
                ohlc = await bybitConnector.fetchKlines(symbol, '60', 200);
            }
            if (ohlc.length < 50) continue;

            const ohlc15m = await bybitConnector.fetchKlines(symbol, '15', 50);
            const ohlc4h = await bybitConnector.fetchKlines(symbol, '240', 200);

            const ticker = bybitConnector.getTicker(symbol);
            const currentPrice = ticker?.lastPrice || ohlc[ohlc.length - 1].close;
            const high24h = ticker?.highPrice24h || Math.max(...ohlc.slice(-25, -1).map(c => c.high));
            const low24h = ticker?.lowPrice24h || Math.min(...ohlc.slice(-25, -1).map(c => c.low));
            const volume24h = ticker?.turnover24h || 0;
            const fundingRate = parseFloat(ticker?.fundingRate || '0');

            const perf = await indicatorLearner.getPairPerformance(symbol);

            const signal = generateSignalFromData(
                symbol, ohlc, currentPrice, high24h, low24h, volume24h, fundingRate, ohlc15m, ohlc4h, undefined, perf
            );

            if (signal && signal.quality && signal.quality.score >= 60) {
                // FASE 3: Validar contexto de mercado ANTES de processar o sinal
                const contextValidation = await validateSignalContext(symbol, signal.type);
                if (!contextValidation.allowed) {
                    logger.debug(`[Engine] ${symbol} ${signal.type.toUpperCase()} vetado por contexto: ${contextValidation.reason}`);
                    continue;
                }
                
                // Não gerar segundo sinal da mesma moeda no mesmo dia
                if (symbolsSignaledToday.has(symbol)) {
                    logger.debug(`[Engine] ${symbol} já gerou sinal hoje — rotação de moedas ativa`);
                    continue;
                }

                // Prevent duplicate spam: check if we already have a recent signal for this same pair and direction
                const existingRecent = activeSignals.find(s => 
                    s.pair === symbol && 
                    s.type === signal.type && 
                    (Date.now() - new Date(s.createdAt).getTime()) < 12 * 60 * 60 * 1000 // 12 hours cooldown
                );

                if (existingRecent) {
                    logger.debug(`Skipping duplicate signal for ${symbol} (${signal.type}) - cooldown active`);
                    continue;
                }

                // Data Collection para o Machine Learning — reusa os valores pré-calculados que
                // foram armazenados no signal.mlData durante generateSignalFromData.
                // Isso elimina o duplo recalculo de RSI, ADX, ATR, VWAP, RVOL, EMAs.
                const precomputed = signal.mlData ?? {};
                const features = {
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
                    open_interest_var: await marketContextService.getOpenInterestVar(symbol),
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
                    btc_trend: globalCtx.btcTrend,
                    dominance_btc: globalCtx.dominanceBtc,
                    fear_greed: globalCtx.fearGreed,
                };

                // Salva o contexto completo substituindo os campos _underscored pelo features final
                signal.mlData = { ...features };

                // ML enrichment
                if (isModelLoaded()) {
                    try {
                        const prediction = await predictSignal(features, symbol, 'swing');
                        if (prediction) {
                            signal.mlData = {
                                ...signal.mlData,
                                probability: prediction.probability,
                                predictedClass: prediction.predictedClass,
                                confidence: prediction.confidence,
                                modelSource: prediction.modelSource,
                                isFiltered: prediction.probability < 0.5,
                            };

                            // Filter out signals rejected by ML
                            // FASE 1: Aumentado de 55% para 65% (vantagem real sobre random)
                            if (prediction.probability < 0.65) {
                                logger.debug(`Signal ${symbol} filtered by ML (prob: ${prediction.probability.toFixed(3)} < 0.65)`);
                                continue;
                            }
                        }
                    } catch (mlError) {
                        logger.warn(`ML enrichment failed for ${symbol}`, { error: mlError });
                    }
                }


                // Populate definitive entry ranges and take profits
                const anySignal = signal as any; // Para usar os paramétros suplementares MTF
                const isOB = anySignal.smartMoney?.isOrderBlock;
                const isSweep = anySignal.smartMoney?.isLiquiditySweep;
                const obZone = anySignal.obEntryZone;
                
                let entryZone;
                if (obZone && signal.type === 'long' && signal.entry > obZone.high) {
                    entryZone = { min: obZone.low, max: obZone.high };
                } else if (obZone && signal.type === 'short' && signal.entry < obZone.low) {
                    entryZone = { min: obZone.low, max: obZone.high };
                } else {
                    const pullback = 0.002;
                    entryZone = signal.type === 'long'
                        ? { min: signal.entry * (1 - pullback - 0.002), max: signal.entry * (1 - pullback) }
                        : { min: signal.entry * (1 + pullback), max: signal.entry * (1 + pullback + 0.002) };
                }
                
                signal.entry_range_low = entryZone.min;
                signal.entry_range_high = entryZone.max;
                signal.take_profits = [
                    { level: 1, price: signal.takeProfit1 || signal.takeProfit, percentage: 100, hit: false },
                    ...(signal.takeProfit2 ? [{ level: 2, price: signal.takeProfit2, percentage: 50, hit: false }] : []),
                    ...(signal.takeProfit3 ? [{ level: 3, price: signal.takeProfit3, percentage: 33, hit: false }] : []),
                ];

                newSignals.push(signal);
                signalsToday++;
                symbolsSignaledToday.add(symbol); // Bloquear segunda análise desta moeda hoje
                lastSignalAt = new Date().toISOString();

                // Verificar limite diário após cada novo sinal
                if (signalsToday >= config.engine.maxSignalsPerDay) {
                    logger.info(`[Engine] Limite diário de ${config.engine.maxSignalsPerDay} atingido durante o ciclo. Abortando análise restante.`);
                    break;
                }

                // Send Telegram notification
                if (signal.status !== 'BLOCKED' && telegramService.isEnabled && signal.quality.score >= config.telegram.minScore) {
                    try {
                        const tgResult = await telegramService.sendNewSignal({
                            type: signal.type,
                            symbol: signal.pair,
                            score: signal.quality.score,
                            scoreLabel: signal.quality.score >= 80 ? 'Excelente' : signal.quality.score >= 70 ? 'Bom' : 'Moderado',
                            timeframe: signal.timeframe,
                            currentPrice: signal.entry,
                            entryZone,
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
                            leverage: anySignal.dynamicLeverage || 5,
                            positionSizePercent: anySignal.positionSizePercent || 10,
                            riskPercent: anySignal.riskPercent || 2,
                            timestamp: new Date().toISOString(),
                            tradeType: isSweep ? 'Smart Money (ICT)' : isOB ? 'Order Block (ICT)' : anySignal.tradeType,
                            expectedDuration: anySignal.expectedDuration,
                            mtfContext: anySignal.mtfContext,
                            contextNarrative: `${anySignal.contextNarrative} ${isSweep ? '**ESTRUTURA ICT E CAÇA DE STOPS DETECTADA.** O Alvo 3 funcionará como Trailing Stop para espremer a tendência real!' : isOB ? '**ORDER BLOCK ICT CONFIRMADO.** Entrada na zona institucional com Stop no swing estrutural. TPs por extensões Fibonacci.' : 'Utilize o trailing stop após o Alvo 2 para garantir o lucro.'}`,
                        });
                        signalsSent++;

                        // --- ATIVAR O GESTOR DE POSIÇÕES ---
                        tradeTracker.registerNewSignal({
                            id: signal.id,
                            pair: signal.pair,
                            type: signal.type.toUpperCase() as 'LONG' | 'SHORT',
                            trade_type: anySignal.tradeType,
                            entry_range_low: signal.entry_range_low,
                            entry_range_high: signal.entry_range_high,
                            stop_loss: signal.stopLoss,
                            initial_stop_loss: signal.stopLoss,
                            take_profits: signal.take_profits,
                            status: signal.status as 'PENDING' | 'BLOCKED',
                            telegram_message_id: tgResult?.messageId?.toString() || undefined,
                            expected_duration: anySignal.expectedDuration,
                            score: signal.quality.score,
                            indicators: signal.indicators,
                            mlData: anySignal.mlData,
                        }).catch((e: any) => logger.warn(`[TradeTracker] erro ao registrar: ${e.message}`));

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

    // Persist to Supabase
    if (newSignals.length > 0) {
        try {
            const rows = newSignals.map(s => ({
                id: s.id,
                pair: s.pair,
                type: s.type,
                trade_type: s.tradeType || 'Day Trade',
                entry_range_low: s.entry_range_low || s.entry,
                entry_range_high: s.entry_range_high || s.entry,
                stop_loss: s.stop_loss || s.stopLoss,
                initial_stop_loss: s.stopLoss,
                take_profits: JSON.stringify(s.take_profits || [{ level: 1, price: s.takeProfit, percentage: 100, hit: false }]),
                risk_reward: s.riskReward,
                status: s.status,
                confidence: s.confidence,
                ml_data: s.mlData ? JSON.stringify(s.mlData) : null,
                created_at: s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt)
            }));

            await db.$transaction(
                rows.map(row => db.tradeSignal.upsert({
                    where: { id: row.id },
                    update: row,
                    create: row
                }))
            );

            logger.info(`Persisted ${rows.length} signals to local DB`);
        } catch (dbError) {
            logger.warn('SQLite persistence error', { error: dbError });
        }
    }

    logger.info(`Signal cycle complete: ${newSignals.length} new signals`, {
        totalActive: activeSignals.length,
        signalsToday,
        signalsSent,
    });
}

// ──── Public API ────

export async function loadPersistedSignals(): Promise<void> {
    try {
        const data = await db.tradeSignal.findMany({
            orderBy: { created_at: 'desc' },
            take: 200
        });

        const loadedSignals: TradeSignal[] = data.map((s: any) => {
            let tps: any[] = [];
            try { tps = JSON.parse(s.take_profits || '[]'); } catch (e) {}
            let inds: string[] = [];
            try { inds = JSON.parse(s.indicators || '[]'); } catch (e) {}
            let mlData: any = undefined;
            try { if (s.ml_data) mlData = JSON.parse(s.ml_data); } catch (e) {}

            return {
                id: s.id,
                pair: s.pair,
                type: s.type as 'long' | 'short',
                tradeType: s.trade_type,
                entry: s.entry_range_low,
                takeProfit: tps[0]?.price || 0,
                takeProfit1: tps[0]?.price || 0,
                takeProfit2: tps[1]?.price || undefined,
                takeProfit3: tps[2]?.price || undefined,
                stopLoss: s.stop_loss,
                riskReward: s.risk_reward || 0,
                timeframe: '1h',
                status: s.status as any,
                confidence: s.confidence || 0,
                createdAt: new Date(s.created_at),
                indicators: inds,
                quality: { score: s.confidence || 0, factors: inds },
                mlData: mlData,
            };
        });

        activeSignals = loadedSignals.filter(s => s.status === 'ACTIVE' || s.status === 'PENDING').slice(0, 50);
        signalHistory = loadedSignals.slice(0, 500);

        logger.info(`[Engine] Loaded ${loadedSignals.length} persisted signals from DB (${activeSignals.length} active)`);
    } catch (err) {
        logger.error('Failed to load persisted signals', { error: err });
    }
}

export function startEngine(): void {
    if (engineRunning) return;
    engineRunning = true;
    signalsToday = 0;
    signalsSent = 0;

    loadPersistedSignals().then(() => {
        // Run immediately, then on interval
        runSignalCycle().catch(err => logger.error('Signal cycle error', { error: err }));

        engineInterval = setInterval(() => {
            runSignalCycle().catch(err => logger.error('Signal cycle error', { error: err }));
        }, config.engine.signalIntervalMs);

        logger.info('Signal engine started', { interval: `${config.engine.signalIntervalMs / 1000}s` });
    });
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
