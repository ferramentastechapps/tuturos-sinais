// ═══════════════════════════════════════════════════════════
// Estratégia: MACD_CROSS
// Cruzamento do MACD (Linha MACD cruzando a Linha de Sinal)
// Confirmado pela tendência da EMA 200
// Timeframe recomendado: 1h / 4h
// ═══════════════════════════════════════════════════════════

import { logger } from '../lib/logger.js';
import { OHLCPoint } from '../types/trading.js';
import { calculateMACD, calculateEMA } from '../engine/signalEngine.js';
import { IStrategy, StrategySignal } from './types.js';

const PARAMS = {
    emaTrend: 200,
    slPadding: 0.002, // 0.2%
    rrRatio: 2.0,
} as const;

export class MacdCrossStrategy implements IStrategy {
    readonly name = 'MACD_CROSS';
    readonly description = 'Cruzamento do MACD com Linha de Sinal a favor da tendência (EMA 200)';
    readonly recommendedTimeframes = ['1h', '4h'];

    generate(candles: OHLCPoint[]): StrategySignal {
        const none: StrategySignal = { direction: 'none', stopLoss: 0, takeProfit: 0 };
        if (candles.length < PARAMS.emaTrend + 2) return none;

        const closes = candles.map(c => c.close);
        const lastCandle = candles[candles.length - 1];
        const currentPrice = lastCandle.close;

        // Calcula EMA 200 para tendência
        const ema200Arr = calculateEMA(closes, PARAMS.emaTrend);
        const ema200 = ema200Arr[ema200Arr.length - 1];

        // Calcula MACD completo do array
        // Como o signalEngine retorna apenas o estado atual no calculateMACD (isBullishCross),
        // chamamos calculateMACD passando arrays defasados para checar o cruzamento.
        const currentMacd = calculateMACD(closes);
        const prevMacd = calculateMACD(closes.slice(0, -1));

        // Detecta cruzamento exato no momento atual
        const crossUp = prevMacd.macd <= prevMacd.signal && currentMacd.macd > currentMacd.signal;
        const crossDown = prevMacd.macd >= prevMacd.signal && currentMacd.macd < currentMacd.signal;

        // Opcionalmente também usa as flags nativas do MACD se a engine suportar
        const isBullishCross = crossUp || currentMacd.isBullishCross;
        const isBearishCross = crossDown || currentMacd.isBearishCross;

        if (!isBullishCross && !isBearishCross) return none;

        logger.debug(`[${this.name}] Executando | preço=${currentPrice.toFixed(2)} EMA200=${ema200.toFixed(2)} MACD=${currentMacd.macd.toFixed(4)} Sig=${currentMacd.signal.toFixed(4)}`);

        // Long: Preço > EMA200 e MACD cruza pra cima (preferencialmente abaixo de 0)
        if (isBullishCross && currentPrice > ema200) {
            const sl = lastCandle.low * (1 - PARAMS.slPadding);
            const tp = currentPrice + (currentPrice - sl) * PARAMS.rrRatio;
            const confidence = 75 + (currentMacd.macd < 0 ? 10 : 0); // Bônus se cruzou vindo de sobrevenda
            return { direction: 'long', stopLoss: sl, takeProfit: tp, confidence, indicators: ['MACD Bullish Cross', 'Trend > EMA 200'] };
        }

        // Short: Preço < EMA200 e MACD cruza pra baixo (preferencialmente acima de 0)
        if (isBearishCross && currentPrice < ema200) {
            const sl = lastCandle.high * (1 + PARAMS.slPadding);
            const tp = currentPrice - (sl - currentPrice) * PARAMS.rrRatio;
            const confidence = 75 + (currentMacd.macd > 0 ? 10 : 0); // Bônus se cruzou vindo de sobrecompra
            return { direction: 'short', stopLoss: sl, takeProfit: tp, confidence, indicators: ['MACD Bearish Cross', 'Trend < EMA 200'] };
        }

        return none;
    }
}
