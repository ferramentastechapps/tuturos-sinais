// Signal Engine — Main orchestrator that runs signal generation loop

import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import { bybitConnector } from '../exchange/bybitConnector.js';
import { predictSignal, isModelLoaded, getSymbolId } from '../ml/mlPredictionService.js';
import { telegramService } from '../notifications/telegramService.js';
import { db } from '../lib/dbClient.js';
import { marketContextService } from '../lib/marketContextService.js';
import type { TradeSignal, TechnicalIndicator, OHLCPoint, CryptoPair } from '../types/trading.js';
import { tradeTracker } from '../trading/tradeTracker.js';

// ──── State ────

let activeSignals: TradeSignal[] = [];
let signalHistory: TradeSignal[] = [];
let signalsToday = 0;
let signalsSent = 0;
let lastSignalAt: string | null = null;
let engineRunning = false;
let engineInterval: NodeJS.Timeout | null = null;

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

export function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
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
    customMinScore?: number
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
    const vwap = calculateVWAP(ohlc);
    const rvol = calculateRVOL(ohlc);

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
        { name: 'VWAP', value: vwap, signal: currentPrice > vwap ? 'bullish' : 'bearish' },
        { name: 'RVOL', value: rvol, signal: rvol > 1.2 ? 'bullish' : 'neutral' },
    ];

    // Count confluences
    const bullishCount = indicators.filter(i => i.signal === 'bullish').length;
    const bearishCount = indicators.filter(i => i.signal === 'bearish').length;

    // Determine direction
    let type: 'long' | 'short';
    let score: number;
    const confluences: string[] = [];
    
    // --- MTF LOGIC INJECTION ---
    const mtfContext = { macro: [] as string[], medium: [] as string[], micro: [] as string[] };
    let macroTrend: 'long' | 'short' | 'neutral' = 'neutral';
    
    if (ohlc4h && ohlc4h.length >= 50) {
        const closes4h = ohlc4h.map(c => c.close);
        const ema200_4h = calculateEMA(closes4h, 200).pop() || currentPrice;
        if (currentPrice > ema200_4h) {
            macroTrend = 'long';
        } else {
            macroTrend = 'short';
        }
    }
    
    let rsi15 = 50;
    if (ohlc15m && ohlc15m.length >= 20) {
        const closes15m = ohlc15m.map(c => c.close);
        rsi15 = calculateRSI(closes15m);
    }
    // --- SMART MONEY CONCEPTS (ICT) ---
    const { isBullishFvg, isBearishFvg } = detectFVG(ohlc);
    const { isSweepLow, isSweepHigh } = detectLiquiditySweep(ohlc, high24h, low24h);
    const anchoredVwapDay = calculateAnchoredVWAP(ohlc, 'day');
    const { bullishOB, bearishOB, priceInBullishOB, priceInBearishOB } = detectOrderBlock(ohlc, atr);
    const { swingLow, swingHigh } = detectSwingStructure(ohlc, 20);

    if (bullishCount >= 4) {
        type = 'long';
        // --- VETOS ABSOLUTOS (ANTI-SARDINHA) ---
        if (rsi > 65) return null; // Nunca comprar na máxima saturação (Topo)
        if (rvol < 0.70) return null; // Sem volume / Feriado = Abortar
        if (macroTrend === 'short') return null; // Bloqueio total contra a tendência macro de 4H
        
        // Formata MTF para LONG
        mtfContext.macro.push(macroTrend === 'long' ? 'Preço acima da EMA 200 (4H) ✅' : 'Preço abaixo da EMA 200 (4H) ❌');
        if (rsi < 40) mtfContext.medium.push('RSI em região sobrevendida ✅');
        else if (rsi > 60) mtfContext.medium.push('RSI em região sobrecomprada ❌');

        if (rsi15 < 35) mtfContext.micro.push('Reversão de curto prazo (RSI 15m oversold) ✅');
        else if (rsi15 > 65) mtfContext.micro.push('Recuo de curto prazo (RSI 15m overbought) ❌');

        score = 60 + bullishCount * 5; // Start higher
        confluences.push(`${bullishCount} ind. bullish`);
    } else if (bearishCount >= 4) {
        type = 'short';
        // --- VETOS ABSOLUTOS (ANTI-SARDINHA) ---
        if (rsi < 35) return null; // Nunca vender no fundo saturado
        if (rvol < 0.70) return null; // Sem volume / Feriado = Abortar
        if (macroTrend === 'long') return null; // Bloqueio total contra a tendência macro de 4H
        
        // Formata MTF para SHORT
        mtfContext.macro.push(macroTrend === 'short' ? 'Preço abaixo da EMA 200 (4H) ✅' : 'Preço acima da EMA 200 (4H) ❌');
        if (rsi > 60) mtfContext.medium.push('RSI em região sobrecomprada ✅');
        else if (rsi < 40) mtfContext.medium.push('RSI em região sobrevendida ❌');

        if (rsi15 > 65) mtfContext.micro.push('Reversão de curto prazo (RSI 15m overbought) ✅');
        else if (rsi15 < 35) mtfContext.micro.push('Recuo de curto prazo (RSI 15m oversold) ❌');

        score = 60 + bearishCount * 5;
        confluences.push(`${bearishCount} ind. bearish`);
    } else {
        return null; // Not enough confluence
    }

    // --- VETO SNIPER EXTREMO ---
    // Proíbe abrir operação sem Rastro Institucional comprovado (Liquidity Sweep, FVG ou Order Block)
    const hasIctValidation = (
        (type === 'long'  && (isBullishFvg  || isSweepLow  || priceInBullishOB)) ||
        (type === 'short' && (isBearishFvg  || isSweepHigh || priceInBearishOB))
    );
    if (!hasIctValidation) {
        return null;
    }

    // RSI extremes bonus (Apenas a favor do recuo natural, já que os vetos acima impedem a entrada contrária)
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
    
    // Liquidity Sweeps (Highest weight out of all metrics)
    if (type === 'long' && isSweepLow) {
        score += 20;
        confluences.push('Liquidity Sweep (Reversão de Fundo)');
        mtfContext.macro.push('Tubarões ativaram Stops de Varejo na mínima do dia! FORTE SINAL LONG 🐋');
    }
    if (type === 'short' && isSweepHigh) {
        score += 20;
        confluences.push('Liquidity Sweep (Reversão de Topo)');
        mtfContext.macro.push('Tubarões distribuíram ativando Stops de Compra no topo! FORTE SINAL SHORT 🐋');
    }

    // Order Block (ICT) bonus
    if (type === 'long' && priceInBullishOB && bullishOB) {
        score += 15;
        confluences.push('Order Block Bullish (ICT)');
        mtfContext.medium.push(`Preço retornou à zona do Order Block ($${bullishOB.low.toFixed(2)} – $${bullishOB.high.toFixed(2)}) ✅`);
        if (isBullishFvg) { score += 5; confluences.push('OB + FVG Confluence'); }
        if (currentPrice > anchoredVwapDay) { score += 5; confluences.push('OB + Anchored VWAP'); }
    }
    if (type === 'short' && priceInBearishOB && bearishOB) {
        score += 15;
        confluences.push('Order Block Bearish (ICT)');
        mtfContext.medium.push(`Preço retornou à zona de distribuição ($${bearishOB.low.toFixed(2)} – $${bearishOB.high.toFixed(2)}) ✅`);
        if (isBearishFvg) { score += 5; confluences.push('OB + FVG Confluence'); }
        if (currentPrice < anchoredVwapDay) { score += 5; confluences.push('OB + Anchored VWAP'); }
    }
    
    // Fair Value Gaps
    if (type === 'long' && isBullishFvg) {
        score += 10;
        confluences.push('FVG Detectado (Gap de Valor Justo de C.)');
        mtfContext.medium.push('Recuo respeitou um Bloco de Ordens / FVG ✅');
    }
    if (type === 'short' && isBearishFvg) {
        score += 10;
        confluences.push('FVG Detectado (Gap de Valor Justo de V.)');
        mtfContext.medium.push('Rali esbarrou em FVG de Venda / Order Block ✅');
    }
    
    // VWAP Ancorada (Daily)
    if (type === 'long' && currentPrice > anchoredVwapDay) { 
        score += 5; 
        confluences.push('Acima Anchored VWAP'); 
    }
    if (type === 'short' && currentPrice < anchoredVwapDay) { 
        score += 5; 
        confluences.push('Abaixo Anchored VWAP'); 
    }

    // --- VOLUME & VWAP CONFLUENCE ---
    // VWAP Alignment: Operating in the right direction according to Institutional Value
    if (type === 'long' && currentPrice > vwap) { 
        score += 5; 
        confluences.push('Acima da VWAP'); 
    }
    if (type === 'short' && currentPrice < vwap) { 
        score += 5; 
        confluences.push('Abaixo da VWAP'); 
    }
    // RVOL (Relative Volume): Avoid fakeouts low-liquid entries
    if (rvol > 1.5) {
        score += 8;
        confluences.push('Alto volume (+50%)');
        mtfContext.micro.push('Rompimento suportado por alto volume Relativo (RVOL) ✅');
    }

    // Funding rate contra-trade bonus
    if (type === 'long' && fundingRate < -0.01) { score += 5; confluences.push('Negative funding (contrarian)'); }
    if (type === 'short' && fundingRate > 0.01) { score += 5; confluences.push('Positive funding (contrarian)'); }

    // Cap score
    score = Math.min(score, 100);

    // Minimum score filter (Raised significantly to 75 to ensure only high probability setups pass)
    const finalMinScore = customMinScore !== undefined ? customMinScore : 75;
    if (score < finalMinScore) return null;

    // --- ICT Order Block + Structural Stop + Fibonacci TPs ---
    let stopLossDistance = 0;
    const atrPercent = currentPrice > 0 ? (atr / currentPrice * 100) : 2;
    let obEntryLow = currentPrice * 0.998;
    let obEntryHigh = currentPrice * 1.002;
    let usingStructuralStop = false;

    if (type === 'long' && priceInBullishOB && bullishOB) {
        // ICT: stop below structural swing low OR the order block low, whichever is safer (lower)
        const structuralStop = Math.min(swingLow, bullishOB.low) * 0.999;
        stopLossDistance = Math.max(((currentPrice - structuralStop) / currentPrice) * 100, 0.5);
        obEntryLow = bullishOB.low;
        obEntryHigh = bullishOB.high;
        usingStructuralStop = true;
    } else if (type === 'short' && priceInBearishOB && bearishOB) {
        // ICT: stop above structural swing high OR the order block high, whichever is safer (higher)
        const structuralStop = Math.max(swingHigh, bearishOB.high) * 1.001;
        stopLossDistance = Math.max(((structuralStop - currentPrice) / currentPrice) * 100, 0.5);
        obEntryLow = bearishOB.low;
        obEntryHigh = bearishOB.high;
        usingStructuralStop = true;
    } else if (type === 'long' && isSweepLow) {
        const lowestWick = ohlc[ohlc.length - 1].low;
        stopLossDistance = Math.max(((currentPrice - lowestWick) / currentPrice * 100) * 1.05, 0.5);
    } else if (type === 'short' && isSweepHigh) {
        const highestWick = ohlc[ohlc.length - 1].high;
        stopLossDistance = Math.max(((highestWick - currentPrice) / currentPrice * 100) * 1.05, 0.5);
    } else {
        const atrMultiplier = type === macroTrend ? 1.5 : 1.0;
        stopLossDistance = Math.max(atrPercent * atrMultiplier, 0.5);
    }

    // Fibonacci TP extensions when structural stop is used, standard ratio otherwise
    let tp1Distance: number, tp2Distance: number, tp3Distance: number;
    if (usingStructuralStop) {
        // ICT Fibonacci projections from the Order Block midpoint
        tp1Distance = stopLossDistance * 1.0;   // 1:1 — first target (TP1)
        tp2Distance = stopLossDistance * 1.618; // Golden ratio extension (TP2)
        tp3Distance = stopLossDistance * 2.5;   // Major liquidity target (TP3)
    } else {
        const tpScale = type === macroTrend ? 1 : 0.6;
        tp1Distance = stopLossDistance * 1.5 * tpScale;
        tp2Distance = stopLossDistance * 2.5 * tpScale;
        tp3Distance = stopLossDistance * 4.0 * tpScale;
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

    // --- VETO: Recusa sinais com R:R menor que 1:1 ---
    if (riskReward < 1.0) return null;

    // --- GERENCIAMENTO DE RISCO DINÂMICO (SMART SIZING) ---
    const accountRiskLevel = config.riskManagement.riskPercent;
    const marginPercent = config.riskManagement.marginPercent;
    
    // Fórmula Mágica Corrigida:
    let dynamicLeverage = Math.round((accountRiskLevel / stopLossDistance) / (marginPercent / 100));
    
    // Limites de Segurança Institucional de Alavancagem
    if (dynamicLeverage < 2) dynamicLeverage = 2;   // Minimo 2x
    if (dynamicLeverage > 50) dynamicLeverage = 50; // Cap máximo institucional

    // Definir tipo de trade e narrativa baseada no MTF
    let tradeType = 'Day Trade';
    let expectedDuration = '12-24 horas';
    let contextNarrative = `${symbol} demonstra presença ${type === 'long' ? 'compradora' : 'vendedora'}. `;
    
    if (type === macroTrend) {
        tradeType = 'Swing Trade';
        expectedDuration = '2-5 dias';
        contextNarrative += `O sinal está alinhado com a tendência macro (4H), proporcionando um Swing Trade com R:R de 1:${riskReward.toFixed(1)}.`;
    } else {
        tradeType = 'Day Trade (Contra-tendência)';
        expectedDuration = '4-12 horas';
        contextNarrative += `Atenção: Operação contra a tendência macro (4H). Alvos reduzidos para um Day Trade rápido com R:R de 1:${riskReward.toFixed(1)}.`;
    }

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
        dynamicLeverage,
        positionSizePercent: marginPercent,
        riskPercent: accountRiskLevel,
        timeframe: '1h',
        status: 'pending',
        confidence: score,
        createdAt: new Date(),
        indicators: confluences,
        quality: { score, factors: confluences },
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
        // Pre-computed indicator values — used by runSignalCycle to build ML features
        // without recalculating the same indicators a second time.
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

    // Fetch global macro context once per cycle (results are cached internally)
    const globalCtx = await marketContextService.getGlobalContext();
    logger.debug('[Engine] Global context', globalCtx);

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

            const ohlc15m = await bybitConnector.fetchKlines(symbol, '15', 50);
            const ohlc4h = await bybitConnector.fetchKlines(symbol, '240', 200);

            const ticker = bybitConnector.getTicker(symbol);
            const currentPrice = ticker?.lastPrice || ohlc[ohlc.length - 1].close;
            const high24h = ticker?.highPrice24h || Math.max(...ohlc.slice(-25, -1).map(c => c.high));
            const low24h = ticker?.lowPrice24h || Math.min(...ohlc.slice(-25, -1).map(c => c.low));
            const volume24h = ticker?.turnover24h || 0;
            const fundingRate = parseFloat(ticker?.fundingRate || '0');

            const signal = generateSignalFromData(
                symbol, ohlc, currentPrice, high24h, low24h, volume24h, fundingRate, ohlc15m, ohlc4h
            );

            if (signal && signal.quality && signal.quality.score >= 75) {
                // Prevent duplicate spam: check if we already have a recent signal for this same pair and direction
                const existingRecent = activeSignals.find(s => 
                    s.pair === symbol && 
                    s.type === signal.type && 
                    (Date.now() - new Date(s.createdAt).getTime()) < 4 * 60 * 60 * 1000 // 4 hours cooldown
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
                        const prediction = await predictSignal(features);
                        if (prediction) {
                            signal.mlData = {
                                ...signal.mlData,
                                probability: prediction.probability,
                                predictedClass: prediction.predictedClass,
                                confidence: prediction.confidence,
                                isFiltered: prediction.probability < 0.5,
                            };

                            // Filter out signals rejected by ML
                            // Aumentado drasticamente a exigência do ML para aceitar somente sinais com probabilidade de Win >= 65%
                            if (prediction.probability < 0.65) {
                                logger.debug(`Signal ${symbol} filtered by ML (prob: ${prediction.probability.toFixed(3)} < 0.65)`);
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
                        const anySignal = signal as any; // Para usar os paramétros suplementares MTF
                        const isOB = anySignal.smartMoney?.isOrderBlock;
                        const isSweep = anySignal.smartMoney?.isLiquiditySweep;
                        const obZone = anySignal.obEntryZone;

                        // BUG FIX: Calcular entryZone com recuo (pullback) para criar uma verdadeira ORDEM PENDENTE limit.
                        // Isso dá tempo para o usuário reagir antes do preço ativar a ordem.
                        let entryZone;
                        if (obZone && signal.type === 'long' && signal.entry > obZone.high) {
                            entryZone = { min: obZone.low, max: obZone.high };
                        } else if (obZone && signal.type === 'short' && signal.entry < obZone.low) {
                            entryZone = { min: obZone.low, max: obZone.high };
                        } else {
                            // Se já estiver dentro ou for outro indicador, forçamos um recuo de 0.2%
                            const pullback = 0.002;
                            entryZone = signal.type === 'long'
                                ? { min: signal.entry * (1 - pullback - 0.002), max: signal.entry * (1 - pullback) }
                                : { min: signal.entry * (1 + pullback), max: signal.entry * (1 + pullback + 0.002) };
                        }

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
                            entry_range_low: entryZone.min,
                            entry_range_high: entryZone.max,
                            stop_loss: signal.stopLoss,
                            initial_stop_loss: signal.stopLoss,
                            take_profits: [
                                { level: 1, price: signal.takeProfit1 || signal.takeProfit, hit: false },
                                ...(signal.takeProfit2 ? [{ level: 2, price: signal.takeProfit2, hit: false }] : []),
                                ...(signal.takeProfit3 ? [{ level: 3, price: signal.takeProfit3, hit: false }] : []),
                            ],
                            status: 'PENDING',
                            telegram_message_id: tgResult.messageId?.toString(),
                            expected_duration: anySignal.expectedDuration,
                            score: signal.quality.score,
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
                indicators: JSON.stringify(s.indicators),
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
