// ═══════════════════════════════════════════════════════════
// Estratégia: ADX_TREND_FOLLOW
// ADX > 25 confirma tendência forte, entra no pullback para EMA 20
// Timeframe recomendado: 1h / 4h
// ═══════════════════════════════════════════════════════════

import { logger } from '../lib/logger.js';
import { OHLCPoint } from '../types/trading.js';
import { calculateEMA, calculateADX, calculateATR } from '../engine/signalEngine.js';
import { IStrategy, StrategySignal } from './types.js';

const PARAMS = {
    adxStrong:    25,   // Tendência forte
    adxVeryStrong: 40,  // Tendência muito forte (+bônus confidence)
    emaTrend:     50,   // Direção de tendência
    emaPullback:  20,   // Pullback para essa EMA
    pullbackTol:  0.003, // Preço deve estar a até 0.3% da EMA de pullback
    rrRatio:      2.5,
} as const;

export class AdxTrendFollowStrategy implements IStrategy {
    readonly name = 'ADX_TREND_FOLLOW';
    readonly description = 'ADX > 25 = Tendência Forte. Entrada no pullback para EMA 20 a favor da EMA 50';
    readonly recommendedTimeframes = ['1h', '4h'];

    generate(candles: OHLCPoint[]): StrategySignal {
        const none: StrategySignal = { direction: 'none', stopLoss: 0, takeProfit: 0 };
        if (candles.length < PARAMS.emaTrend + 5) return none;

        const closes = candles.map(c => c.close);
        const last = candles[candles.length - 1];
        const currentPrice = last.close;

        const adx    = calculateADX(candles, 14);
        const atr    = calculateATR(candles, 14);
        const ema20  = calculateEMA(closes, PARAMS.emaPullback);
        const ema50  = calculateEMA(closes, PARAMS.emaTrend);
        const lastEma20 = ema20[ema20.length - 1];
        const lastEma50 = ema50[ema50.length - 1];

        // ADX não indica tendência forte o suficiente
        if (adx < PARAMS.adxStrong) return none;

        const distToEma20 = Math.abs(currentPrice - lastEma20) / currentPrice;
        const inPullback  = distToEma20 <= PARAMS.pullbackTol;

        if (!inPullback) return none;

        logger.debug(`[${this.name}] Pullback à EMA20 | ADX=${adx.toFixed(1)} EMA20=${lastEma20.toFixed(4)} EMA50=${lastEma50.toFixed(4)} Preço=${currentPrice.toFixed(4)}`);

        const confidence = Math.min(100, 70 + (adx - PARAMS.adxStrong) * 0.8 + (adx >= PARAMS.adxVeryStrong ? 10 : 0));

        // Long: EMA20 > EMA50 (uptrend) e preço pullback para EMA20
        if (lastEma20 > lastEma50 && currentPrice >= lastEma20) {
            const sl = last.low - atr * 0.5;
            const tp = currentPrice + (currentPrice - sl) * PARAMS.rrRatio;
            return { direction: 'long', stopLoss: sl, takeProfit: tp, confidence, indicators: [`ADX ${adx.toFixed(0)} Forte`, 'Pullback EMA 20', 'Tendência EMA 50 Alta'] };
        }

        // Short: EMA20 < EMA50 (downtrend) e preço pullback para EMA20
        if (lastEma20 < lastEma50 && currentPrice <= lastEma20) {
            const sl = last.high + atr * 0.5;
            const tp = currentPrice - (sl - currentPrice) * PARAMS.rrRatio;
            return { direction: 'short', stopLoss: sl, takeProfit: tp, confidence, indicators: [`ADX ${adx.toFixed(0)} Forte`, 'Pullback EMA 20', 'Tendência EMA 50 Baixa'] };
        }

        return none;
    }
}
