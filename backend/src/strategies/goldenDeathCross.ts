// ═══════════════════════════════════════════════════════════
// Estratégia: GOLDEN_DEATH_CROSS
// EMA 50 x EMA 200 — Posições de médio/longo prazo
// Timeframe recomendado: 4h / 1d
// ═══════════════════════════════════════════════════════════

import { logger } from '../lib/logger.js';
import { OHLCPoint } from '../types/trading.js';
import { calculateEMA, calculateRSI, calculateATR } from '../engine/signalEngine.js';
import { IStrategy, StrategySignal } from './types.js';

const PARAMS = {
    emaFast:   50,
    emaSlow:   200,
    rsiPeriod: 14,
    rsiMin:    40,  // Long só acima de 40
    rsiMax:    60,  // Short só abaixo de 60
    rrRatio:   3.0, // R:R maior pois é swing
    atrMultSL: 1.5,
} as const;

export class GoldenDeathCrossStrategy implements IStrategy {
    readonly name = 'GOLDEN_DEATH_CROSS';
    readonly description = 'Golden Cross (EMA50 cruza EMA200 pra cima) e Death Cross (pra baixo) — Swing/Position';
    readonly recommendedTimeframes = ['4h', '1d'];

    generate(candles: OHLCPoint[]): StrategySignal {
        const none: StrategySignal = { direction: 'none', stopLoss: 0, takeProfit: 0 };
        if (candles.length < PARAMS.emaSlow + 3) return none;

        const closes = candles.map(c => c.close);
        const last = candles.length - 1;
        const prev = last - 1;
        const currentPrice = closes[last];

        const ema50Arr  = calculateEMA(closes, PARAMS.emaFast);
        const ema200Arr = calculateEMA(closes, PARAMS.emaSlow);
        const rsi  = calculateRSI(closes, PARAMS.rsiPeriod);
        const atr  = calculateATR(candles, PARAMS.rsiPeriod);

        const e50Curr  = ema50Arr[last];
        const e50Prev  = ema50Arr[prev];
        const e200Curr = ema200Arr[last];
        const e200Prev = ema200Arr[prev];

        if (!e50Curr || !e200Curr || !e50Prev || !e200Prev) return none;

        // Golden Cross: EMA50 cruza EMA200 de baixo para cima
        const goldenCross = e50Prev <= e200Prev && e50Curr > e200Curr;
        // Death Cross: EMA50 cruza EMA200 de cima para baixo
        const deathCross  = e50Prev >= e200Prev && e50Curr < e200Curr;

        if (!goldenCross && !deathCross) return none;

        logger.debug(`[${this.name}] ${goldenCross ? '🌟 Golden' : '💀 Death'} Cross | EMA50=${e50Curr.toFixed(4)} EMA200=${e200Curr.toFixed(4)} RSI=${rsi.toFixed(1)}`);

        if (goldenCross && rsi >= PARAMS.rsiMin) {
            const sl = currentPrice - atr * PARAMS.atrMultSL;
            const tp = currentPrice + (currentPrice - sl) * PARAMS.rrRatio;
            const confidence = Math.min(100, 80 + (rsi - 40) * 0.5);
            return {
                direction: 'long', stopLoss: sl, takeProfit: tp, confidence,
                indicators: ['Golden Cross EMA50×EMA200', `RSI ${rsi.toFixed(1)}`],
            };
        }

        if (deathCross && rsi <= PARAMS.rsiMax) {
            const sl = currentPrice + atr * PARAMS.atrMultSL;
            const tp = currentPrice - (sl - currentPrice) * PARAMS.rrRatio;
            const confidence = Math.min(100, 80 + (60 - rsi) * 0.5);
            return {
                direction: 'short', stopLoss: sl, takeProfit: tp, confidence,
                indicators: ['Death Cross EMA50×EMA200', `RSI ${rsi.toFixed(1)}`],
            };
        }

        return none;
    }
}
