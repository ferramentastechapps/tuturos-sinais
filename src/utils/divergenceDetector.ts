// Divergence Detector — RSI e MACD divergências automáticas
// Detecta divergências regulares e hidden entre preço e indicadores

import { OHLCPoint } from '@/services/coingeckoOHLC';
import { IndicatorPoint } from '@/utils/technicalIndicators';

// ──────────── Tipos ────────────

export type DivergenceKind = 'regular' | 'hidden';

export interface Divergence {
    type: 'bullish' | 'bearish';
    kind: DivergenceKind;
    indicator: 'RSI' | 'MACD';
    startIndex: number;
    endIndex: number;
    startTimestamp: number;
    endTimestamp: number;
    priceStart: number;
    priceEnd: number;
    indicatorStart: number;
    indicatorEnd: number;
    strength: number; // 0-100
    description: string;
}

// ──────────── Detecção de Pivôs ────────────

interface Pivot {
    index: number;
    value: number;
    timestamp: number;
}

/**
 * Encontra pivôs (máximos ou mínimos locais) em um array de valores.
 */
const findPivots = (
    values: Array<{ timestamp: number; value: number }>,
    type: 'high' | 'low',
    lookback: number = 3
): Pivot[] => {
    const pivots: Pivot[] = [];

    for (let i = lookback; i < values.length - lookback; i++) {
        let isPivot = true;

        for (let j = 1; j <= lookback; j++) {
            if (type === 'high') {
                if (values[i].value <= values[i - j].value || values[i].value <= values[i + j].value) {
                    isPivot = false;
                    break;
                }
            } else {
                if (values[i].value >= values[i - j].value || values[i].value >= values[i + j].value) {
                    isPivot = false;
                    break;
                }
            }
        }

        if (isPivot) {
            pivots.push({
                index: i,
                value: values[i].value,
                timestamp: values[i].timestamp,
            });
        }
    }

    return pivots;
};

// ──────────── Motor de Divergência ────────────

/**
 * Detecta divergências entre preço e um indicador.
 *
 * Divergência Regular Bullish:
 *   Preço faz Lower Low, Indicador faz Higher Low → possível reversão para cima
 *
 * Divergência Regular Bearish:
 *   Preço faz Higher High, Indicador faz Lower High → possível reversão para baixo
 *
 * Divergência Hidden Bullish:
 *   Preço faz Higher Low, Indicador faz Lower Low → continuação de alta
 *
 * Divergência Hidden Bearish:
 *   Preço faz Lower High, Indicador faz Higher High → continuação de baixa
 */
const detectDivergencesBetween = (
    pricePivots: Pivot[],
    indicatorPivots: Pivot[],
    pivotType: 'high' | 'low',
    indicatorName: 'RSI' | 'MACD',
    lookbackPairs: number = 5
): Divergence[] => {
    const divergences: Divergence[] = [];

    // Alinha pivôs de preço com indicador pelo índice mais próximo
    const alignedPairs: Array<{ price: Pivot; indicator: Pivot }> = [];

    for (const pricePivot of pricePivots) {
        // Encontra o pivô do indicador mais próximo (dentro de ±3 candles)
        let closestIndicator: Pivot | null = null;
        let minDistance = Infinity;

        for (const indPivot of indicatorPivots) {
            const distance = Math.abs(pricePivot.index - indPivot.index);
            if (distance < minDistance && distance <= 3) {
                minDistance = distance;
                closestIndicator = indPivot;
            }
        }

        if (closestIndicator) {
            alignedPairs.push({ price: pricePivot, indicator: closestIndicator });
        }
    }

    // Compara pares consecutivos para encontrar divergências
    const recentPairs = alignedPairs.slice(-lookbackPairs);

    for (let i = 0; i < recentPairs.length - 1; i++) {
        const prev = recentPairs[i];
        const curr = recentPairs[i + 1];

        if (pivotType === 'low') {
            // Regular Bullish: preço LL + indicador HL
            if (curr.price.value < prev.price.value && curr.indicator.value > prev.indicator.value) {
                const priceDiff = ((prev.price.value - curr.price.value) / prev.price.value) * 100;
                const strength = Math.min(Math.round(priceDiff * 25), 100);

                if (strength >= 15) {
                    divergences.push({
                        type: 'bullish',
                        kind: 'regular',
                        indicator: indicatorName,
                        startIndex: prev.price.index,
                        endIndex: curr.price.index,
                        startTimestamp: prev.price.timestamp,
                        endTimestamp: curr.price.timestamp,
                        priceStart: prev.price.value,
                        priceEnd: curr.price.value,
                        indicatorStart: prev.indicator.value,
                        indicatorEnd: curr.indicator.value,
                        strength,
                        description: `Divergência Bullish ${indicatorName}: Preço fez Lower Low mas ${indicatorName} fez Higher Low`,
                    });
                }
            }

            // Hidden Bullish: preço HL + indicador LL
            if (curr.price.value > prev.price.value && curr.indicator.value < prev.indicator.value) {
                const priceDiff = ((curr.price.value - prev.price.value) / prev.price.value) * 100;
                const strength = Math.min(Math.round(priceDiff * 20), 100);

                if (strength >= 15) {
                    divergences.push({
                        type: 'bullish',
                        kind: 'hidden',
                        indicator: indicatorName,
                        startIndex: prev.price.index,
                        endIndex: curr.price.index,
                        startTimestamp: prev.price.timestamp,
                        endTimestamp: curr.price.timestamp,
                        priceStart: prev.price.value,
                        priceEnd: curr.price.value,
                        indicatorStart: prev.indicator.value,
                        indicatorEnd: curr.indicator.value,
                        strength,
                        description: `Divergência Hidden Bullish ${indicatorName}: Continuação de alta provável`,
                    });
                }
            }
        }

        if (pivotType === 'high') {
            // Regular Bearish: preço HH + indicador LH
            if (curr.price.value > prev.price.value && curr.indicator.value < prev.indicator.value) {
                const priceDiff = ((curr.price.value - prev.price.value) / prev.price.value) * 100;
                const strength = Math.min(Math.round(priceDiff * 25), 100);

                if (strength >= 15) {
                    divergences.push({
                        type: 'bearish',
                        kind: 'regular',
                        indicator: indicatorName,
                        startIndex: prev.price.index,
                        endIndex: curr.price.index,
                        startTimestamp: prev.price.timestamp,
                        endTimestamp: curr.price.timestamp,
                        priceStart: prev.price.value,
                        priceEnd: curr.price.value,
                        indicatorStart: prev.indicator.value,
                        indicatorEnd: curr.indicator.value,
                        strength,
                        description: `Divergência Bearish ${indicatorName}: Preço fez Higher High mas ${indicatorName} fez Lower High`,
                    });
                }
            }

            // Hidden Bearish: preço LH + indicador HH
            if (curr.price.value < prev.price.value && curr.indicator.value > prev.indicator.value) {
                const priceDiff = ((prev.price.value - curr.price.value) / prev.price.value) * 100;
                const strength = Math.min(Math.round(priceDiff * 20), 100);

                if (strength >= 15) {
                    divergences.push({
                        type: 'bearish',
                        kind: 'hidden',
                        indicator: indicatorName,
                        startIndex: prev.price.index,
                        endIndex: curr.price.index,
                        startTimestamp: prev.price.timestamp,
                        endTimestamp: curr.price.timestamp,
                        priceStart: prev.price.value,
                        priceEnd: curr.price.value,
                        indicatorStart: prev.indicator.value,
                        indicatorEnd: curr.indicator.value,
                        strength,
                        description: `Divergência Hidden Bearish ${indicatorName}: Continuação de baixa provável`,
                    });
                }
            }
        }
    }

    return divergences;
};

// ──────────── API Pública ────────────

/**
 * Detecta divergências RSI com preço.
 */
export const detectRSIDivergences = (
    ohlcData: OHLCPoint[],
    rsiValues: IndicatorPoint[],
    lookback: number = 2
): Divergence[] => {
    if (rsiValues.length < 10 || ohlcData.length < 10) return [];

    // Cria arrays com preço (close) e RSI alinhados
    const priceValues = ohlcData.map((d, i) => ({ timestamp: d.timestamp, value: d.close }));
    const rsiMapped = rsiValues.map(r => ({ timestamp: r.timestamp, value: r.value }));

    // Encontra pivôs
    const priceLows = findPivots(priceValues, 'low', lookback);
    const priceHighs = findPivots(priceValues, 'high', lookback);
    const rsiLows = findPivots(rsiMapped, 'low', lookback);
    const rsiHighs = findPivots(rsiMapped, 'high', lookback);

    // Detecta divergências
    const bullish = detectDivergencesBetween(priceLows, rsiLows, 'low', 'RSI');
    const bearish = detectDivergencesBetween(priceHighs, rsiHighs, 'high', 'RSI');

    return [...bullish, ...bearish].sort((a, b) => a.endIndex - b.endIndex);
};

/**
 * Detecta divergências MACD com preço.
 * Usa o histograma MACD (MACD line - Signal line) como valor do indicador.
 */
export const detectMACDDivergences = (
    ohlcData: OHLCPoint[],
    macdHistogram: IndicatorPoint[],
    lookback: number = 2
): Divergence[] => {
    if (macdHistogram.length < 10 || ohlcData.length < 10) return [];

    const priceValues = ohlcData.map(d => ({ timestamp: d.timestamp, value: d.close }));
    const macdMapped = macdHistogram.map(m => ({ timestamp: m.timestamp, value: m.value }));

    const priceLows = findPivots(priceValues, 'low', lookback);
    const priceHighs = findPivots(priceValues, 'high', lookback);
    const macdLows = findPivots(macdMapped, 'low', lookback);
    const macdHighs = findPivots(macdMapped, 'high', lookback);

    const bullish = detectDivergencesBetween(priceLows, macdLows, 'low', 'MACD');
    const bearish = detectDivergencesBetween(priceHighs, macdHighs, 'high', 'MACD');

    return [...bullish, ...bearish].sort((a, b) => a.endIndex - b.endIndex);
};

/**
 * Detecta todas as divergências (RSI + MACD) de uma vez.
 */
export const detectAllDivergences = (
    ohlcData: OHLCPoint[],
    rsiValues: IndicatorPoint[],
    macdHistogram: IndicatorPoint[]
): Divergence[] => {
    const rsiDivs = detectRSIDivergences(ohlcData, rsiValues);
    const macdDivs = detectMACDDivergences(ohlcData, macdHistogram);

    return [...rsiDivs, ...macdDivs].sort((a, b) => a.endIndex - b.endIndex);
};
