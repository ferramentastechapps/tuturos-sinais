// ═══════════════════════════════════════════════════════════
// Estratégia: SCALPING_BOT
// Wrapper (Adaptador) para rodar o robô de Scalping nativo no Backtest
// Timeframe OBRIGATÓRIO: 5m
// ═══════════════════════════════════════════════════════════

import { OHLCPoint } from '../types/trading.js';
import { IStrategy, StrategySignal } from './types.js';
import { generateScalpingSignal } from '../engine/scalpingEngine.js';

/**
 * Agrega velas de menor tempo para maior tempo (ex: 5m -> 15m)
 */
function aggregateOHLC(candles: OHLCPoint[], targetPeriodMs: number): OHLCPoint[] {
    const result: OHLCPoint[] = [];
    if (candles.length === 0) return result;

    let currentAgg: OHLCPoint | null = null;
    let currentBucket = Math.floor(candles[0].timestamp / targetPeriodMs) * targetPeriodMs;

    for (const c of candles) {
        const bucket = Math.floor(c.timestamp / targetPeriodMs) * targetPeriodMs;
        if (bucket !== currentBucket) {
            if (currentAgg) result.push({ ...currentAgg });
            currentBucket = bucket;
            currentAgg = null;
        }
        if (!currentAgg) {
            currentAgg = { ...c, timestamp: bucket };
        } else {
            currentAgg.high = Math.max(currentAgg.high, c.high);
            currentAgg.low = Math.min(currentAgg.low, c.low);
            currentAgg.close = c.close;
            currentAgg.volume = (currentAgg.volume || 0) + (c.volume || 0);
        }
    }
    if (currentAgg) result.push(currentAgg);
    return result;
}

export class ScalpingBotStrategy implements IStrategy {
    readonly name = 'SCALPING_BOT';
    readonly description = 'Adaptador do Robô Nativo de Scalping (Requer 5m)';
    readonly recommendedTimeframes = ['5m'];

    generate(candles: OHLCPoint[]): StrategySignal {
        const none: StrategySignal = { direction: 'none', stopLoss: 0, takeProfit: 0 };
        if (candles.length < 50) return none;

        // O robô de scalping opera apenas no 5m.
        // Simulamos o símbolo para enganar a engine genérica (o par real é passado por fora, mas a IStrategy não o recebe).
        // Felizmente, generateScalpingSignal usa o símbolo apenas para logging no backtest.
        const symbol = 'BACKTEST_PAIR'; 
        
        const currentPrice = candles[candles.length - 1].close;
        const recentSlice = candles.slice(-50); // Últimas ~4 horas no 5m
        
        const high24h = Math.max(...recentSlice.map(c => c.high));
        const low24h = Math.min(...recentSlice.map(c => c.low));
        const fundingRate = 0;

        // Gera as velas de 15m agregando as de 5m
        const ohlc15m = aggregateOHLC(candles, 15 * 60 * 1000);

        // Chama o motor nativo de scalping
        const signal = generateScalpingSignal(
            symbol,
            candles,
            ohlc15m,
            currentPrice,
            high24h,
            low24h,
            fundingRate,
            {} // mock de indicatorPerf
        );

        if (!signal) return none;

        return {
            direction: signal.type === 'long' ? 'long' : 'short',
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit1 || signal.takeProfit,
            confidence: signal.confidence,
            indicators: signal.indicators,
        };
    }
}
