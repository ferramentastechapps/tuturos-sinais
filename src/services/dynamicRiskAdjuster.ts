// Dynamic Risk Adjuster — Motor de ajuste dinâmico de parâmetros de risco
// Ajusta stop loss, alavancagem e outros parâmetros baseado em condições de mercado

import {
    AssetRiskConfig,
    AdjustedRiskConfig,
    RiskAdjustment,
    AdjustmentAction,
} from '@/types/riskProfiles';
import { riskLogger } from './riskLogger';

// ──────────── Tipos de Dados de Mercado ────────────

export interface MarketConditions {
    symbol: string;
    currentATR: number;          // ATR atual
    averageATR: number;          // ATR médio dos últimos 14 períodos
    intradayVolatility: number;  // Volatilidade intraday em %
    fundingRate: number;         // Funding rate em %
    oiChange24h: number;         // Variação do OI em 24h em %
    priceChange24h: number;      // Variação de preço em 24h em %
    fearGreedIndex: number;      // Índice Fear & Greed (0-100)
    adxValue: number;            // ADX (0-100)
    maxCandlePercent1h: number;  // Maior candle % na última hora
}

// ──────────── Ajuste Dinâmico ────────────

/**
 * Analisa as condições de mercado e ajusta os parâmetros de risco de um ativo.
 * Retorna uma AdjustedRiskConfig com os ajustes aplicados e registrados.
 */
export const adjustRiskForMarketConditions = (
    config: AssetRiskConfig,
    conditions: MarketConditions
): AdjustedRiskConfig => {
    const adjustments: RiskAdjustment[] = [];
    const blockReasons: string[] = [];

    // Clonar config para não mutar o original
    let adjustedLeverageMax = config.leverage.max;
    let adjustedLeverageSuggested = config.leverage.suggested;
    let adjustedStopMin = config.stopLoss.min;
    let adjustedStopMax = config.stopLoss.max;

    // ──── REGRAS DE AUMENTO DE STOP / REDUÇÃO DE ALAVANCAGEM ────

    // 1. ATR acima da média dos últimos 14 períodos
    if (conditions.currentATR > conditions.averageATR * 1.2) {
        const ratio = conditions.currentATR / conditions.averageATR;
        const multiplier = Math.min(ratio, 2.0); // Cap em 2x

        const oldStopMin = adjustedStopMin;
        const oldStopMax = adjustedStopMax;
        adjustedStopMin = +(adjustedStopMin * multiplier).toFixed(2);
        adjustedStopMax = +(adjustedStopMax * multiplier).toFixed(2);

        const oldLev = adjustedLeverageSuggested;
        adjustedLeverageSuggested = Math.max(1, Math.round(adjustedLeverageSuggested / multiplier));

        adjustments.push(createAdjustment(
            conditions.symbol, 'increase_stop', 'stopLoss.min',
            oldStopMin, adjustedStopMin,
            `ATR ${(ratio).toFixed(2)}x acima da média`,
            ['ATR elevado']
        ));

        if (oldLev !== adjustedLeverageSuggested) {
            adjustments.push(createAdjustment(
                conditions.symbol, 'reduce_leverage', 'leverage.suggested',
                oldLev, adjustedLeverageSuggested,
                `Redução por ATR elevado`,
                ['ATR elevado']
            ));
        }

        riskLogger.logAdjustment(conditions.symbol, 'stopLoss', oldStopMin, adjustedStopMin,
            `ATR ${ratio.toFixed(2)}x acima da média`);
    }

    // 2. Volatilidade intraday acima de 5%
    if (conditions.intradayVolatility > 5) {
        const volMultiplier = Math.min(conditions.intradayVolatility / 5, 1.8);
        const oldStopMin = adjustedStopMin;
        adjustedStopMin = +(adjustedStopMin * volMultiplier).toFixed(2);
        adjustedStopMax = +(adjustedStopMax * volMultiplier).toFixed(2);

        adjustments.push(createAdjustment(
            conditions.symbol, 'increase_stop', 'stopLoss.min',
            oldStopMin, adjustedStopMin,
            `Volatilidade intraday ${conditions.intradayVolatility.toFixed(1)}%`,
            ['Alta volatilidade']
        ));
    }

    // 3. Funding Rate extremo
    if (conditions.fundingRate > 0.1 || conditions.fundingRate < -0.1) {
        const oldStopMin = adjustedStopMin;
        adjustedStopMin = +(adjustedStopMin * 1.3).toFixed(2);
        adjustedStopMax = +(adjustedStopMax * 1.3).toFixed(2);

        const oldLev = adjustedLeverageSuggested;
        adjustedLeverageSuggested = Math.max(1, adjustedLeverageSuggested - 1);

        adjustments.push(createAdjustment(
            conditions.symbol, 'increase_stop', 'stopLoss.min',
            oldStopMin, adjustedStopMin,
            `Funding Rate extremo: ${conditions.fundingRate.toFixed(4)}%`,
            ['Funding extremo']
        ));

        if (oldLev !== adjustedLeverageSuggested) {
            adjustments.push(createAdjustment(
                conditions.symbol, 'reduce_leverage', 'leverage.suggested',
                oldLev, adjustedLeverageSuggested,
                `Funding Rate extremo`,
                ['Funding extremo']
            ));
        }
    }

    // 4. Divergência OI vs Preço (OI caindo enquanto preço sobe/cai)
    const hasOIDivergence =
        (conditions.oiChange24h < -3 && conditions.priceChange24h > 1) ||
        (conditions.oiChange24h < -3 && conditions.priceChange24h < -3);

    if (hasOIDivergence) {
        const oldStopMin = adjustedStopMin;
        adjustedStopMin = +(adjustedStopMin * 1.2).toFixed(2);
        adjustedStopMax = +(adjustedStopMax * 1.2).toFixed(2);

        adjustments.push(createAdjustment(
            conditions.symbol, 'increase_stop', 'stopLoss.min',
            oldStopMin, adjustedStopMin,
            `Divergência OI (${conditions.oiChange24h.toFixed(1)}%) vs Preço (${conditions.priceChange24h.toFixed(1)}%)`,
            ['Divergência OI']
        ));
    }

    // 5. Fear & Greed extremo
    if (conditions.fearGreedIndex < 20 || conditions.fearGreedIndex > 80) {
        const oldStopMin = adjustedStopMin;
        adjustedStopMin = +(adjustedStopMin * 1.25).toFixed(2);
        adjustedStopMax = +(adjustedStopMax * 1.25).toFixed(2);

        const oldLev = adjustedLeverageSuggested;
        adjustedLeverageSuggested = Math.max(1, adjustedLeverageSuggested - 1);

        const fgLabel = conditions.fearGreedIndex < 20 ? 'Medo Extremo' : 'Ganância Extrema';
        adjustments.push(createAdjustment(
            conditions.symbol, 'increase_stop', 'stopLoss.min',
            oldStopMin, adjustedStopMin,
            `${fgLabel} (F&G: ${conditions.fearGreedIndex})`,
            ['Sentimento extremo']
        ));

        if (oldLev !== adjustedLeverageSuggested) {
            adjustments.push(createAdjustment(
                conditions.symbol, 'reduce_leverage', 'leverage.suggested',
                oldLev, adjustedLeverageSuggested,
                `${fgLabel}`,
                ['Sentimento extremo']
            ));
        }
    }

    // ──── REGRAS DE REDUÇÃO DE STOP / MANTER ALAVANCAGEM ────

    // Se ATR abaixo da média E volatilidade baixa E funding neutro E tendência clara
    const isCalm = conditions.currentATR < conditions.averageATR * 0.8;
    const isLowVol = conditions.intradayVolatility < 2;
    const isNeutralFunding = conditions.fundingRate >= -0.05 && conditions.fundingRate <= 0.05;
    const isTrending = conditions.adxValue > 25;

    if (isCalm && isLowVol && isNeutralFunding) {
        // Em mercado calmo, podemos reduzir o stop (usar o mínimo do perfil)
        // Não fazer ajustes adicionais, apenas manter defaults ou ligeira redução
        if (adjustments.length === 0) {
            // Nenhum ajuste anterior, pode usar stops mínimos
            adjustedStopMin = config.stopLoss.min;
            adjustedStopMax = config.stopLoss.max;

            if (isTrending) {
                // Tendência clara + mercado calmo = pode manter alavancagem original
                adjustedLeverageSuggested = config.leverage.suggested;
            }
        }
    }

    // ──── BLOQUEIOS ────

    // Candle > 10% em 1h = volatilidade extrema
    if (conditions.maxCandlePercent1h > 10) {
        blockReasons.push(`Volatilidade extrema: candle de ${conditions.maxCandlePercent1h.toFixed(1)}% em 1h`);
        riskLogger.logBlock(conditions.symbol, `Candle extremo: ${conditions.maxCandlePercent1h.toFixed(1)}% em 1h`);
    }

    // Cap leverage no máximo do perfil
    adjustedLeverageMax = Math.min(adjustedLeverageMax, config.leverage.max);
    adjustedLeverageSuggested = Math.min(adjustedLeverageSuggested, adjustedLeverageMax);
    adjustedLeverageSuggested = Math.max(1, adjustedLeverageSuggested);

    // Construir config ajustada
    const adjusted: AdjustedRiskConfig = {
        ...config,
        leverage: {
            ...config.leverage,
            max: adjustedLeverageMax,
            suggested: adjustedLeverageSuggested,
        },
        stopLoss: {
            ...config.stopLoss,
            min: adjustedStopMin,
            max: adjustedStopMax,
        },
        adjustments,
        isBlocked: blockReasons.length > 0,
        blockReasons,
    };

    return adjusted;
};

// ──────────── Helpers ────────────

const createAdjustment = (
    symbol: string,
    action: AdjustmentAction,
    field: string,
    oldValue: number,
    newValue: number,
    reason: string,
    conditions: string[]
): RiskAdjustment => ({
    symbol,
    timestamp: Date.now(),
    action,
    field,
    oldValue,
    newValue,
    reason,
    conditions,
});

/**
 * Calcula a volatilidade intraday a partir de high/low do dia.
 */
export const calculateIntradayVolatility = (high24h: number, low24h: number): number => {
    if (low24h <= 0) return 0;
    return ((high24h - low24h) / low24h) * 100;
};

/**
 * Calcula o maior candle em % das últimas N velas.
 */
export const calculateMaxCandlePercent = (
    ohlcData: Array<{ open: number; close: number; high: number; low: number }>
): number => {
    if (ohlcData.length === 0) return 0;
    return Math.max(
        ...ohlcData.map(c => {
            const range = Math.abs(c.high - c.low);
            const base = Math.min(c.open, c.close);
            return base > 0 ? (range / base) * 100 : 0;
        })
    );
};
