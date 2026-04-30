// ═══════════════════════════════════════════════════════════
// Estratégia: ORDER_BLOCK_ICT
// Wrapper para a lógica de Order Block + FVG já existente no robô principal
// Detecta Order Blocks e entra quando o preço retorna neles com FVG confirmando
// Timeframe recomendado: 15m / 1h
// ═══════════════════════════════════════════════════════════

import { logger } from '../lib/logger.js';
import { OHLCPoint } from '../types/trading.js';
import { detectOrderBlock, detectFVG, detectLiquiditySweep, calculateATR } from '../engine/signalEngine.js';
import { IStrategy, StrategySignal } from './types.js';

const PARAMS = {
    rrRatio: 2.5,
    slPadding: 0.001, // 0.1% além da borda do Order Block
} as const;

export class OrderBlockIctStrategy implements IStrategy {
    readonly name = 'ORDER_BLOCK_ICT';
    readonly description = 'Smart Money: Entra em Order Blocks com confirmação de FVG ou Liquidity Sweep (ICT)';
    readonly recommendedTimeframes = ['15m', '1h'];

    generate(candles: OHLCPoint[]): StrategySignal {
        const none: StrategySignal = { direction: 'none', stopLoss: 0, takeProfit: 0 };
        if (candles.length < 30) return none;

        const lastCandle = candles[candles.length - 1];
        const currentPrice = lastCandle.close;
        const recentSlice = candles.slice(-50);
        const high24h = Math.max(...recentSlice.map(c => c.high));
        const low24h  = Math.min(...recentSlice.map(c => c.low));
        const atr     = calculateATR(candles, 14);

        const { bullishOB, bearishOB, priceInBullishOB, priceInBearishOB } = detectOrderBlock(candles, atr);
        const { isBullishFvg, isBearishFvg } = detectFVG(candles);
        const { isSweepLow, isSweepHigh } = detectLiquiditySweep(candles, high24h, low24h);

        logger.debug(`[${this.name}] OB Bullish=${priceInBullishOB} OB Bearish=${priceInBearishOB} FVG Bull=${isBullishFvg} FVG Bear=${isBearishFvg} Sweep Lo=${isSweepLow} Hi=${isSweepHigh}`);

        // ── Long: Preço no Order Block Bullish + FVG bullish ou Liquidity Sweep Low ──
        if (priceInBullishOB && bullishOB && (isBullishFvg || isSweepLow)) {
            const sl = bullishOB.low * (1 - PARAMS.slPadding);
            const tp = currentPrice + (currentPrice - sl) * PARAMS.rrRatio;
            const confidence = 75 + (isBullishFvg && isSweepLow ? 15 : isBullishFvg ? 10 : 5);
            const indicators = ['Order Block Bullish'];
            if (isBullishFvg) indicators.push('FVG Bullish');
            if (isSweepLow) indicators.push('Liquidity Sweep Low');
            logger.debug(`[${this.name}] LONG OB @ ${currentPrice.toFixed(4)} | SL=${sl.toFixed(4)} TP=${tp.toFixed(4)}`);
            return { direction: 'long', stopLoss: sl, takeProfit: tp, confidence, indicators };
        }

        // ── Short: Preço no Order Block Bearish + FVG bearish ou Liquidity Sweep High ──
        if (priceInBearishOB && bearishOB && (isBearishFvg || isSweepHigh)) {
            const sl = bearishOB.high * (1 + PARAMS.slPadding);
            const tp = currentPrice - (sl - currentPrice) * PARAMS.rrRatio;
            const confidence = 75 + (isBearishFvg && isSweepHigh ? 15 : isBearishFvg ? 10 : 5);
            const indicators = ['Order Block Bearish'];
            if (isBearishFvg) indicators.push('FVG Bearish');
            if (isSweepHigh) indicators.push('Liquidity Sweep High');
            logger.debug(`[${this.name}] SHORT OB @ ${currentPrice.toFixed(4)} | SL=${sl.toFixed(4)} TP=${tp.toFixed(4)}`);
            return { direction: 'short', stopLoss: sl, takeProfit: tp, confidence, indicators };
        }

        return none;
    }
}
