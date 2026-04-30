// ═══════════════════════════════════════════════════════════
// Estratégia: BOLLINGER_SQUEEZE
// Bollinger Bands squeeze (BB dentro do Keltner Channel)
// Entrada quando o squeeze libera + fechamento fora da banda + momentum
// Timeframe recomendado: 15m / 1h
// ═══════════════════════════════════════════════════════════

import { logger } from '../lib/logger.js';
import { OHLCPoint } from '../types/trading.js';
import { calculateEMA, calculateATR, calculateBollingerBands } from '../engine/signalEngine.js';
import { IStrategy, StrategySignal } from './types.js';

const PARAMS = {
    bbPeriod:   20,
    bbStdDev:   2.0,
    kcPeriod:   20,
    kcMultiplier: 1.5,
    momPeriod:  12,
    rrRatio:    2.0,
} as const;

/** Keltner Channel: EMA ± ATR * multiplier */
function calculateKeltnerChannel(
    candles: OHLCPoint[],
    period: number,
    multiplier: number
): { upper: number; lower: number; middle: number } {
    const closes = candles.map(c => c.close);
    const emaArr = calculateEMA(closes, period);
    const middle = emaArr[emaArr.length - 1] ?? closes[closes.length - 1];
    const atr    = calculateATR(candles, period);
    return { upper: middle + multiplier * atr, lower: middle - multiplier * atr, middle };
}

/** Momentum simples: close[last] - close[last - period] */
function calculateMomentum(closes: number[], period: number): number {
    if (closes.length < period + 1) return 0;
    return closes[closes.length - 1] - closes[closes.length - 1 - period];
}

export class BollingerSqueezeStrategy implements IStrategy {
    readonly name = 'BOLLINGER_SQUEEZE';
    readonly description = 'Squeeze entre BB(20,2) e KC(20,1.5) — entrada quando squeeze libera + momentum confirma';
    readonly recommendedTimeframes = ['15m', '1h'];

    generate(candles: OHLCPoint[]): StrategySignal {
        const none: StrategySignal = { direction: 'none', stopLoss: 0, takeProfit: 0 };
        const minNeeded = PARAMS.bbPeriod + PARAMS.momPeriod + 2;
        if (candles.length < minNeeded) return none;

        logger.debug(`[${this.name}] Executando | BB(${PARAMS.bbPeriod},${PARAMS.bbStdDev}) KC(${PARAMS.kcPeriod},${PARAMS.kcMultiplier}) Mom=${PARAMS.momPeriod}`);

        const closes  = candles.map(c => c.close);
        const lastPrice = closes[closes.length - 1];

        // BB atual e anterior
        const bb     = calculateBollingerBands(closes, PARAMS.bbPeriod, PARAMS.bbStdDev);
        const bbPrev = calculateBollingerBands(closes.slice(0, -1), PARAMS.bbPeriod, PARAMS.bbStdDev);

        // KC atual e anterior
        const kc     = calculateKeltnerChannel(candles, PARAMS.kcPeriod, PARAMS.kcMultiplier);
        const kcPrev = calculateKeltnerChannel(candles.slice(0, -1), PARAMS.kcPeriod, PARAMS.kcMultiplier);

        // Squeeze: BB está dentro do KC
        const isSqueeze     = bb.upper < kc.upper && bb.lower > kc.lower;
        const wasSqueeze    = bbPrev.upper < kcPrev.upper && bbPrev.lower > kcPrev.lower;
        const squeezeReleased = wasSqueeze && !isSqueeze;

        if (!squeezeReleased) return none;

        const momentum = calculateMomentum(closes, PARAMS.momPeriod);
        const bandWidth = bb.upper - bb.lower;

        // Long: fechamento acima da banda superior + momentum positivo
        if (lastPrice > bb.upper && momentum > 0) {
            const sl = bb.lower;
            const tp = lastPrice + bandWidth * PARAMS.rrRatio;
            const confidence = Math.min(100, 70 + Math.min(momentum / lastPrice * 1000, 20));
            logger.debug(`[${this.name}] LONG squeeze release @ ${lastPrice} | mom=${momentum.toFixed(4)} bw=${bandWidth.toFixed(4)}`);
            return { direction: 'long', stopLoss: sl, takeProfit: tp, confidence, indicators: ['BB Squeeze Release', 'Close > BB Upper', `Momentum +${momentum.toFixed(2)}`] };
        }

        // Short: fechamento abaixo da banda inferior + momentum negativo
        if (lastPrice < bb.lower && momentum < 0) {
            const sl = bb.upper;
            const tp = lastPrice - bandWidth * PARAMS.rrRatio;
            const confidence = Math.min(100, 70 + Math.min(Math.abs(momentum) / lastPrice * 1000, 20));
            logger.debug(`[${this.name}] SHORT squeeze release @ ${lastPrice} | mom=${momentum.toFixed(4)} bw=${bandWidth.toFixed(4)}`);
            return { direction: 'short', stopLoss: sl, takeProfit: tp, confidence, indicators: ['BB Squeeze Release', 'Close < BB Lower', `Momentum ${momentum.toFixed(2)}`] };
        }

        return none;
    }
}
