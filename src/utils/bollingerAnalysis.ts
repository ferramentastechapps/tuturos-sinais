// Bollinger Bands Advanced Analysis — Squeeze e Expansão
// Detecta volatilidade extrema usando Bandwidth e %B

import { IndicatorPoint, PricePoint } from '@/utils/technicalIndicators';

// ──────────── Tipos ────────────

export interface BollingerState {
    timestamp: number;
    bandwidth: number;      // Largura das bandas (volatilidade)
    percentB: number;       // Posição do preço nas bandas (0-1, negativo/acima possível)
    squeeze: boolean;       // Bandas contraídas (baixa volatilidade)
    expansion: boolean;     // Bandas expandidas (alta volatilidade)
    signal: 'bullish' | 'bearish' | 'neutral';
    description: string;
}

export interface BollingerAnalysisResult {
    states: BollingerState[];
    currentState: BollingerState | null;
    squeezeDuration: number;      // Há quantos períodos está em squeeze
    volatilityTrend: 'contracting' | 'expanding' | 'stable';
    breakoutProbability: number;  // 0-100 (maior = mais provável breakout iminente)
}

// ──────────── Cálculos ────────────

/**
 * Calcula Bandwidth — medida de largura relativa das bandas.
 * Bandwidth = (Upper - Lower) / Middle
 * Quanto menor, mais período de squeeze.
 */
const calculateBandwidth = (upper: number, lower: number, middle: number): number => {
    if (middle === 0) return 0;
    return (upper - lower) / middle;
};

/**
 * Calcula %B — posição do preço relativa às bandas.
 * %B = (Preço - Lower) / (Upper - Lower)
 * %B > 1 = acima da banda superior
 * %B < 0 = abaixo da banda inferior
 * %B = 0.5 = no meio (SMA)
 */
const calculatePercentB = (price: number, upper: number, lower: number): number => {
    const range = upper - lower;
    if (range === 0) return 0.5;
    return (price - lower) / range;
};

// ──────────── Análise ────────────

/**
 * Analisa Bollinger Bands para detectar Squeeze (consolidação) e Expansão (breakout).
 *
 * @param prices Array de preços
 * @param upperBand Banda superior (BB)
 * @param middleBand Banda do meio (SMA 20)
 * @param lowerBand Banda inferior (BB)
 * @param squeezePeriod Período para calcular média de bandwidth (default: 20)
 * @param squeezeThreshold Limiar abaixo do qual é considerado squeeze (default: percentil 25%)
 */
export const analyzeBollingerBands = (
    prices: PricePoint[],
    upperBand: IndicatorPoint[],
    middleBand: IndicatorPoint[],
    lowerBand: IndicatorPoint[],
    squeezePeriod: number = 20
): BollingerAnalysisResult => {
    const states: BollingerState[] = [];

    if (upperBand.length < squeezePeriod || middleBand.length < squeezePeriod || lowerBand.length < squeezePeriod) {
        return {
            states: [],
            currentState: null,
            squeezeDuration: 0,
            volatilityTrend: 'stable',
            breakoutProbability: 0,
        };
    }

    // Calcula bandwidths
    const bandwidths: number[] = [];

    const minLen = Math.min(upperBand.length, middleBand.length, lowerBand.length, prices.length);

    for (let i = 0; i < minLen; i++) {
        const upper = upperBand[i].value;
        const middle = middleBand[i].value;
        const lower = lowerBand[i].value;
        const price = prices[i].price;

        const bandwidth = calculateBandwidth(upper, lower, middle);
        const percentB = calculatePercentB(price, upper, lower);
        bandwidths.push(bandwidth);

        // Determina squeeze/expansão comparando com média histórica
        let squeeze = false;
        let expansion = false;

        if (bandwidths.length >= squeezePeriod) {
            const recentBW = bandwidths.slice(-squeezePeriod);
            const avgBW = recentBW.reduce((a, b) => a + b, 0) / recentBW.length;
            const sortedBW = [...recentBW].sort((a, b) => a - b);
            const p25 = sortedBW[Math.floor(recentBW.length * 0.25)];
            const p75 = sortedBW[Math.floor(recentBW.length * 0.75)];

            squeeze = bandwidth <= p25;
            expansion = bandwidth >= p75;
        }

        // Determina sinal
        let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        let description = '';

        if (squeeze) {
            description = `Squeeze: Bandwidth ${(bandwidth * 100).toFixed(2)}% — breakout iminente`;
            signal = 'neutral'; // Direção incerta durante squeeze
        } else if (expansion) {
            if (percentB > 0.8) {
                signal = 'bullish';
                description = `Expansão Bullish: Preço na banda superior (%B: ${(percentB * 100).toFixed(0)}%)`;
            } else if (percentB < 0.2) {
                signal = 'bearish';
                description = `Expansão Bearish: Preço na banda inferior (%B: ${(percentB * 100).toFixed(0)}%)`;
            } else {
                description = `Expansão: Volatilidade alta (BW: ${(bandwidth * 100).toFixed(2)}%)`;
            }
        } else {
            if (percentB > 1.0) {
                signal = 'bullish';
                description = `Preço ACIMA da banda superior (%B: ${(percentB * 100).toFixed(0)}%)`;
            } else if (percentB < 0.0) {
                signal = 'bearish';
                description = `Preço ABAIXO da banda inferior (%B: ${(percentB * 100).toFixed(0)}%)`;
            } else if (percentB > 0.8) {
                signal = 'bullish';
                description = `Preço tocando banda superior (%B: ${(percentB * 100).toFixed(0)}%)`;
            } else if (percentB < 0.2) {
                signal = 'bearish';
                description = `Preço tocando banda inferior (%B: ${(percentB * 100).toFixed(0)}%)`;
            } else {
                description = `Preço dentro das bandas (%B: ${(percentB * 100).toFixed(0)}%)`;
            }
        }

        states.push({
            timestamp: prices[i].timestamp,
            bandwidth,
            percentB,
            squeeze,
            expansion,
            signal,
            description,
        });
    }

    // Calcula métricas do resultado
    const currentState = states.length > 0 ? states[states.length - 1] : null;

    // Conta duração do squeeze atual
    let squeezeDuration = 0;
    for (let i = states.length - 1; i >= 0; i--) {
        if (states[i].squeeze) {
            squeezeDuration++;
        } else {
            break;
        }
    }

    // Tendência de volatilidade
    let volatilityTrend: 'contracting' | 'expanding' | 'stable' = 'stable';
    if (bandwidths.length >= 10) {
        const recent5 = bandwidths.slice(-5);
        const prev5 = bandwidths.slice(-10, -5);
        const avgRecent = recent5.reduce((a, b) => a + b, 0) / 5;
        const avgPrev = prev5.reduce((a, b) => a + b, 0) / 5;

        if (avgRecent < avgPrev * 0.85) volatilityTrend = 'contracting';
        else if (avgRecent > avgPrev * 1.15) volatilityTrend = 'expanding';
    }

    // Probabilidade de breakout (maior quanto mais tempo em squeeze)
    let breakoutProbability = 0;
    if (squeezeDuration > 0) {
        breakoutProbability = Math.min(squeezeDuration * 12, 95);
    }

    return {
        states,
        currentState,
        squeezeDuration,
        volatilityTrend,
        breakoutProbability,
    };
};
