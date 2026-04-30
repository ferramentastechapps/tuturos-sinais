// ═══════════════════════════════════════════════════════════
// Estratégia: EMA_CROSS_VOLUME
// EMA 9/21 crossover confirmado por volume acima da média e RSI neutro
// Timeframe recomendado: 15m
// ═══════════════════════════════════════════════════════════

import { logger } from '../lib/logger.js';
import { OHLCPoint } from '../types/trading.js';
import { calculateEMA, calculateRSI } from '../engine/signalEngine.js';
import { IStrategy, StrategySignal } from './types.js';

const PARAMS = {
    emFast:     9,
    emaSlow:    21,
    rsiPeriod:  14,
    volPeriod:  20,
    volMultiplier: 1.5,
    rsiLongMin: 45, rsiLongMax: 65,
    rsiShortMin: 35, rsiShortMax: 55,
    slPadding:  0.0015,  // 0.15%
    rrRatio:    2.0,
} as const;

export class EmaCrossVolumeStrategy implements IStrategy {
    readonly name = 'EMA_CROSS_VOLUME';
    readonly description = 'EMA 9/21 crossover com confirmação de volume (≥1.5×) e RSI neutro';
    readonly recommendedTimeframes = ['15m', '1h'];

    generate(candles: OHLCPoint[]): StrategySignal {
        const none: StrategySignal = { direction: 'none', stopLoss: 0, takeProfit: 0 };

        const minNeeded = PARAMS.emaSlow + PARAMS.volPeriod + 2;
        if (candles.length < minNeeded) return none;

        logger.debug(`[${this.name}] Executando | emFast=${PARAMS.emFast} emaSlow=${PARAMS.emaSlow} volMult=${PARAMS.volMultiplier} rsiPeriod=${PARAMS.rsiPeriod}`);

        const closes  = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume ?? 0);

        const ema9  = calculateEMA(closes, PARAMS.emFast);
        const ema21 = calculateEMA(closes, PARAMS.emaSlow);
        const rsi   = calculateRSI(closes, PARAMS.rsiPeriod);

        const last = closes.length - 1;
        const prev = last - 1;

        // Volume médio dos últimos N períodos (excluindo a vela atual)
        const volSlice = volumes.slice(last - PARAMS.volPeriod, last);
        const avgVol   = volSlice.reduce((a, b) => a + b, 0) / PARAMS.volPeriod;
        const curVol   = volumes[last];
        const highVolume = curVol >= avgVol * PARAMS.volMultiplier;

        if (!highVolume) return none;

        const crossUp   = ema9[prev] <= ema21[prev] && ema9[last] > ema21[last];
        const crossDown = ema9[prev] >= ema21[prev] && ema9[last] < ema21[last];

        const price = closes[last];
        const crossCandle = candles[last];

        if (crossUp && rsi >= PARAMS.rsiLongMin && rsi <= PARAMS.rsiLongMax) {
            const sl = crossCandle.low * (1 - PARAMS.slPadding);
            const tp = price + (price - sl) * PARAMS.rrRatio;
            const confidence = Math.min(100, 60 + (rsi - 45) * 0.8 + (curVol / avgVol - 1) * 10);
            logger.debug(`[${this.name}] LONG @ ${price} | SL=${sl.toFixed(4)} TP=${tp.toFixed(4)} RSI=${rsi.toFixed(1)} VOL=${(curVol/avgVol).toFixed(2)}x`);
            return { direction: 'long', stopLoss: sl, takeProfit: tp, confidence, indicators: ['EMA9xEMA21 cross up', `RVOL ${(curVol/avgVol).toFixed(2)}x`, `RSI ${rsi.toFixed(1)}`] };
        }

        if (crossDown && rsi >= PARAMS.rsiShortMin && rsi <= PARAMS.rsiShortMax) {
            const sl = crossCandle.high * (1 + PARAMS.slPadding);
            const tp = price - (sl - price) * PARAMS.rrRatio;
            const confidence = Math.min(100, 60 + (55 - rsi) * 0.8 + (curVol / avgVol - 1) * 10);
            logger.debug(`[${this.name}] SHORT @ ${price} | SL=${sl.toFixed(4)} TP=${tp.toFixed(4)} RSI=${rsi.toFixed(1)} VOL=${(curVol/avgVol).toFixed(2)}x`);
            return { direction: 'short', stopLoss: sl, takeProfit: tp, confidence, indicators: ['EMA9xEMA21 cross down', `RVOL ${(curVol/avgVol).toFixed(2)}x`, `RSI ${rsi.toFixed(1)}`] };
        }

        return none;
    }
}
