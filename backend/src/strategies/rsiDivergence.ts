// ═══════════════════════════════════════════════════════════
// Estratégia: RSI_DIVERGENCE
// Divergência regular bullish/bearish com confirmação de vela de reversão
// Timeframe recomendado: 15m / 1h
// ═══════════════════════════════════════════════════════════

import { logger } from '../lib/logger.js';
import { OHLCPoint } from '../types/trading.js';
import { calculateRSI } from '../engine/signalEngine.js';
import { IStrategy, StrategySignal } from './types.js';

const PARAMS = {
    rsiPeriod:    14,
    pivotWindow:  5,       // velas de cada lado para detectar pivot
    rsiBullishMax: 40,     // RSI < 40 para bullish divergence
    rsiBearishMin: 60,     // RSI > 60 para bearish divergence
    reversalBodyRatio: 0.6, // corpo ≥ 60% do range
    rrRatio:       1.8,
} as const;

/** Detecta o pivot low/high mais recente (excluindo as últimas 'window' velas) */
function findPivot(values: number[], type: 'low' | 'high', window: number): { idx: number; val: number } | null {
    const end = values.length - window - 1;
    for (let i = end; i >= window; i--) {
        const slice = values.slice(i - window, i + window + 1);
        const center = values[i];
        const isExtreme = type === 'low'
            ? slice.every(v => v >= center)
            : slice.every(v => v <= center);
        if (isExtreme) return { idx: i, val: center };
    }
    return null;
}

function isReversalCandle(c: OHLCPoint, direction: 'long' | 'short', ratio: number): boolean {
    const range = c.high - c.low;
    if (range === 0) return false;
    const body = Math.abs(c.close - c.open);
    if (body / range < ratio) return false;
    return direction === 'long' ? c.close > c.open : c.close < c.open;
}

export class RsiDivergenceStrategy implements IStrategy {
    readonly name = 'RSI_DIVERGENCE';
    readonly description = 'Divergência regular bullish/bearish RSI 14 com confirmação de vela de reversão (corpo ≥ 60%)';
    readonly recommendedTimeframes = ['15m', '1h'];

    generate(candles: OHLCPoint[]): StrategySignal {
        const none: StrategySignal = { direction: 'none', stopLoss: 0, takeProfit: 0 };
        const min = PARAMS.rsiPeriod + PARAMS.pivotWindow * 2 + 5;
        if (candles.length < min) return none;

        logger.debug(`[${this.name}] Executando | rsiPeriod=${PARAMS.rsiPeriod} pivotWindow=${PARAMS.pivotWindow}`);

        const closes = candles.map(c => c.close);
        const rsiSeries: number[] = candles.map((_, i) =>
            calculateRSI(closes.slice(0, i + 1), PARAMS.rsiPeriod)
        );

        const last = candles.length - 1;
        const currentCandle = candles[last];
        const currentRsi    = rsiSeries[last];
        const currentClose  = closes[last];

        // ── Bullish Divergence: price lower low + RSI higher low ──
        if (currentRsi < PARAMS.rsiBullishMax) {
            const prevPriceLow = findPivot(closes.slice(0, last), 'low', PARAMS.pivotWindow);
            const prevRsiLow   = findPivot(rsiSeries.slice(0, last), 'low', PARAMS.pivotWindow);

            if (prevPriceLow && prevRsiLow) {
                const priceMakesLowerLow = currentClose < prevPriceLow.val;
                const rsiMakesHigherLow  = currentRsi   > prevRsiLow.val;

                if (priceMakesLowerLow && rsiMakesHigherLow && isReversalCandle(currentCandle, 'long', PARAMS.reversalBodyRatio)) {
                    const swingLow = Math.min(...candles.slice(Math.max(0, last - 20), last + 1).map(c => c.low));
                    const sl = swingLow;
                    const tp = currentClose + (currentClose - sl) * PARAMS.rrRatio;
                    const confidence = Math.min(100, 65 + (PARAMS.rsiBullishMax - currentRsi));
                    logger.debug(`[${this.name}] LONG divergência | preço LL=${currentClose.toFixed(4)} RSI HL=${currentRsi.toFixed(1)} SL=${sl.toFixed(4)} TP=${tp.toFixed(4)}`);
                    return { direction: 'long', stopLoss: sl, takeProfit: tp, confidence, indicators: ['RSI Bullish Divergence', `RSI ${currentRsi.toFixed(1)}`, 'Reversal candle'] };
                }
            }
        }

        // ── Bearish Divergence: price higher high + RSI lower high ──
        if (currentRsi > PARAMS.rsiBearishMin) {
            const prevPriceHigh = findPivot(closes.slice(0, last), 'high', PARAMS.pivotWindow);
            const prevRsiHigh   = findPivot(rsiSeries.slice(0, last), 'high', PARAMS.pivotWindow);

            if (prevPriceHigh && prevRsiHigh) {
                const priceMakesHigherHigh = currentClose > prevPriceHigh.val;
                const rsiMakesLowerHigh    = currentRsi   < prevRsiHigh.val;

                if (priceMakesHigherHigh && rsiMakesLowerHigh && isReversalCandle(currentCandle, 'short', PARAMS.reversalBodyRatio)) {
                    const swingHigh = Math.max(...candles.slice(Math.max(0, last - 20), last + 1).map(c => c.high));
                    const sl = swingHigh;
                    const tp = currentClose - (sl - currentClose) * PARAMS.rrRatio;
                    const confidence = Math.min(100, 65 + (currentRsi - PARAMS.rsiBearishMin));
                    logger.debug(`[${this.name}] SHORT divergência | preço HH=${currentClose.toFixed(4)} RSI LH=${currentRsi.toFixed(1)} SL=${sl.toFixed(4)} TP=${tp.toFixed(4)}`);
                    return { direction: 'short', stopLoss: sl, takeProfit: tp, confidence, indicators: ['RSI Bearish Divergence', `RSI ${currentRsi.toFixed(1)}`, 'Reversal candle'] };
                }
            }
        }

        return none;
    }
}
