// ═══════════════════════════════════════════════════════════
// Estratégia: VWAP_REVERSION
// Mean reversion ao VWAP diário com desvio padrão ponderado por volume
// VWAP reseta às 00:00 UTC todos os dias
// Timeframe recomendado: 1m / 5m (intraday)
// ═══════════════════════════════════════════════════════════

import { logger } from '../lib/logger.js';
import { OHLCPoint } from '../types/trading.js';
import { calculateRSI } from '../engine/signalEngine.js';
import { IStrategy, StrategySignal } from './types.js';

const PARAMS = {
    rsiPeriod:       14,
    stdDevMultiplier: 1.5,
    rsiBullishMax:   35,
    rsiBearishMin:   65,
    slPadding:       0.002,  // 0.2%
} as const;

interface VWAPResult {
    vwap: number;
    stdDev: number;
    upperBand: number;
    lowerBand: number;
}

/**
 * Calcula VWAP acumulativo desde 00:00 UTC do mesmo dia da vela mais recente.
 * Inclui desvio padrão ponderado por volume.
 */
function calculateDailyVWAP(candles: OHLCPoint[]): VWAPResult {
    const last = candles[candles.length - 1];
    const dayStartUtc = new Date(last.timestamp);
    dayStartUtc.setUTCHours(0, 0, 0, 0);
    const dayStartMs = dayStartUtc.getTime();

    const todayCandles = candles.filter(c => c.timestamp >= dayStartMs);
    if (todayCandles.length === 0) {
        const p = last.close;
        return { vwap: p, stdDev: 0, upperBand: p, lowerBand: p };
    }

    // VWAP = Σ(typical_price × volume) / Σ(volume)
    let sumPV = 0, sumV = 0, sumPV2 = 0;
    for (const c of todayCandles) {
        const tp  = (c.high + c.low + c.close) / 3;
        const vol = c.volume ?? 0;
        sumPV  += tp * vol;
        sumV   += vol;
        sumPV2 += tp * tp * vol;
    }

    const vwap = sumV > 0 ? sumPV / sumV : last.close;

    // Desvio padrão ponderado por volume
    const variance = sumV > 0 ? sumPV2 / sumV - vwap * vwap : 0;
    const stdDev   = Math.sqrt(Math.max(0, variance));

    return {
        vwap,
        stdDev,
        upperBand: vwap + PARAMS.stdDevMultiplier * stdDev,
        lowerBand: vwap - PARAMS.stdDevMultiplier * stdDev,
    };
}

function isBullishCandle(c: OHLCPoint): boolean {
    return c.close > c.open;
}

function isBearishCandle(c: OHLCPoint): boolean {
    return c.close < c.open;
}

export class VwapReversionStrategy implements IStrategy {
    readonly name = 'VWAP_REVERSION';
    readonly description = 'Mean reversion ao VWAP diário (reset 00:00 UTC) com desvio padrão ×1.5 e confirmação de RSI extremo';
    readonly recommendedTimeframes = ['1m', '5m'];

    generate(candles: OHLCPoint[]): StrategySignal {
        const none: StrategySignal = { direction: 'none', stopLoss: 0, takeProfit: 0 };
        if (candles.length < PARAMS.rsiPeriod + 5) return none;

        logger.debug(`[${this.name}] Executando | stdDevMult=${PARAMS.stdDevMultiplier} rsiPeriod=${PARAMS.rsiPeriod}`);

        const closes       = candles.map(c => c.close);
        const lastCandle   = candles[candles.length - 1];
        const currentPrice = lastCandle.close;
        const rsi          = calculateRSI(closes, PARAMS.rsiPeriod);

        const { vwap, stdDev, upperBand, lowerBand } = calculateDailyVWAP(candles);

        // Sem desvio padrão suficiente (primeiras velas do dia) — aguardar
        if (stdDev < 0.0001) return none;

        // ── Long: preço ≤ VWAP − 1.5σ + RSI < 35 + vela bullish ──
        if (currentPrice <= lowerBand && rsi < PARAMS.rsiBullishMax && isBullishCandle(lastCandle)) {
            const sl = lastCandle.low * (1 - PARAMS.slPadding);
            const tp = vwap; // take profit no retorno ao VWAP
            if (tp <= currentPrice) return none; // evita TP inválido
            const confidence = Math.min(100, 70 + (PARAMS.rsiBullishMax - rsi) + (lowerBand - currentPrice) / stdDev * 5);
            logger.debug(`[${this.name}] LONG reversion | price=${currentPrice.toFixed(4)} vwap=${vwap.toFixed(4)} lower=${lowerBand.toFixed(4)} RSI=${rsi.toFixed(1)}`);
            return { direction: 'long', stopLoss: sl, takeProfit: tp, confidence, indicators: [`VWAP Reversion Long`, `Price ≤ VWAP-1.5σ (${lowerBand.toFixed(4)})`, `RSI ${rsi.toFixed(1)}`] };
        }

        // ── Short: preço ≥ VWAP + 1.5σ + RSI > 65 + vela bearish ──
        if (currentPrice >= upperBand && rsi > PARAMS.rsiBearishMin && isBearishCandle(lastCandle)) {
            const sl = lastCandle.high * (1 + PARAMS.slPadding);
            const tp = vwap; // take profit no retorno ao VWAP
            if (tp >= currentPrice) return none; // evita TP inválido
            const confidence = Math.min(100, 70 + (rsi - PARAMS.rsiBearishMin) + (currentPrice - upperBand) / stdDev * 5);
            logger.debug(`[${this.name}] SHORT reversion | price=${currentPrice.toFixed(4)} vwap=${vwap.toFixed(4)} upper=${upperBand.toFixed(4)} RSI=${rsi.toFixed(1)}`);
            return { direction: 'short', stopLoss: sl, takeProfit: tp, confidence, indicators: [`VWAP Reversion Short`, `Price ≥ VWAP+1.5σ (${upperBand.toFixed(4)})`, `RSI ${rsi.toFixed(1)}`] };
        }

        return none;
    }
}
