// CVD — Cumulative Volume Delta
// Análise de pressão compradora/vendedora e detecção de divergências

import { OHLCPoint } from '@/services/coingeckoOHLC';

// ──────────── Tipos ────────────

export interface CVDPoint {
    timestamp: number;
    delta: number;        // Volume delta deste candle (buy - sell)
    cumulative: number;   // Delta acumulado
    buyVolume: number;    // Volume estimado de compra
    sellVolume: number;   // Volume estimado de venda
}

export interface CVDDivergence {
    type: 'bullish' | 'bearish';
    startIndex: number;
    endIndex: number;
    startTimestamp: number;
    endTimestamp: number;
    priceDirection: 'up' | 'down';
    cvdDirection: 'up' | 'down';
    strength: number; // 0-100
    description: string;
}

export interface CVDResult {
    points: CVDPoint[];
    divergences: CVDDivergence[];
    currentTrend: 'accumulation' | 'distribution' | 'neutral';
    momentum: number; // -100 a 100 (positivo = buying pressure, negativo = selling pressure)
}

// ──────────── Estimativa de Volume Delta ────────────

/**
 * Estima o volume delta de cada candle usando o método close-to-range.
 * 
 * A lógica é: se o close está mais próximo do high, a maioria do volume foi de compra;
 * se o close está mais próximo do low, a maioria foi de venda.
 * 
 * Fórmula: buyRatio = (close - low) / (high - low)
 */
const estimateVolumeDelta = (candle: OHLCPoint): { buyVolume: number; sellVolume: number; delta: number } => {
    const range = candle.high - candle.low;
    const volume = candle.volume && candle.volume > 0 ? candle.volume : range * 1000;

    if (range === 0) {
        return { buyVolume: volume / 2, sellVolume: volume / 2, delta: 0 };
    }

    // Close position ratio dentro do range
    const buyRatio = (candle.close - candle.low) / range;
    const sellRatio = 1 - buyRatio;

    const buyVolume = volume * buyRatio;
    const sellVolume = volume * sellRatio;
    const delta = buyVolume - sellVolume;

    return { buyVolume, sellVolume, delta };
};

// ──────────── Cálculo do CVD ────────────

/**
 * Calcula o Cumulative Volume Delta (CVD) para um array de candles.
 */
export const calculateCVD = (data: OHLCPoint[]): CVDPoint[] => {
    const points: CVDPoint[] = [];
    let cumulative = 0;

    for (const candle of data) {
        const { buyVolume, sellVolume, delta } = estimateVolumeDelta(candle);
        cumulative += delta;

        points.push({
            timestamp: candle.timestamp,
            delta,
            cumulative,
            buyVolume,
            sellVolume,
        });
    }

    return points;
};

// ──────────── Detecção de Divergências ────────────

/**
 * Detecta divergências entre o CVD e o preço.
 * 
 * - **Divergência Bullish**: Preço faz novos lows, mas CVD faz higher lows
 *   → indica acumulação escondida, possível reversão para cima.
 * 
 * - **Divergência Bearish**: Preço faz novos highs, mas CVD faz lower highs
 *   → indica distribuição escondida, possível reversão para baixo.
 * 
 * @param lookbackPeriod Número de candles para buscar divergências (default: 20)
 */
export const detectCVDDivergences = (
    data: OHLCPoint[],
    cvdPoints: CVDPoint[],
    lookbackPeriod: number = 20
): CVDDivergence[] => {
    const divergences: CVDDivergence[] = [];

    if (data.length < lookbackPeriod || cvdPoints.length < lookbackPeriod) return divergences;

    // Analisa segmentos sobrepostos para encontrar divergências
    const segmentSize = Math.floor(lookbackPeriod / 2);

    for (let i = segmentSize; i < data.length - segmentSize; i += Math.floor(segmentSize / 2)) {
        const segment1End = i;
        const segment1Start = Math.max(0, i - segmentSize);
        const segment2End = Math.min(data.length - 1, i + segmentSize);
        const segment2Start = i;

        // Encontra extremos de preço em cada segmento
        let seg1LowPrice = Infinity;
        let seg1HighPrice = -Infinity;
        let seg1LowCVD = Infinity;
        let seg1HighCVD = -Infinity;

        for (let j = segment1Start; j <= segment1End; j++) {
            if (data[j].low < seg1LowPrice) seg1LowPrice = data[j].low;
            if (data[j].high > seg1HighPrice) seg1HighPrice = data[j].high;
            if (cvdPoints[j].cumulative < seg1LowCVD) seg1LowCVD = cvdPoints[j].cumulative;
            if (cvdPoints[j].cumulative > seg1HighCVD) seg1HighCVD = cvdPoints[j].cumulative;
        }

        let seg2LowPrice = Infinity;
        let seg2HighPrice = -Infinity;
        let seg2LowCVD = Infinity;
        let seg2HighCVD = -Infinity;

        for (let j = segment2Start; j <= segment2End; j++) {
            if (data[j].low < seg2LowPrice) seg2LowPrice = data[j].low;
            if (data[j].high > seg2HighPrice) seg2HighPrice = data[j].high;
            if (cvdPoints[j].cumulative < seg2LowCVD) seg2LowCVD = cvdPoints[j].cumulative;
            if (cvdPoints[j].cumulative > seg2HighCVD) seg2HighCVD = cvdPoints[j].cumulative;
        }

        // Divergência Bullish: preço faz lower low, CVD faz higher low
        if (seg2LowPrice < seg1LowPrice && seg2LowCVD > seg1LowCVD) {
            const priceChange = ((seg1LowPrice - seg2LowPrice) / seg1LowPrice) * 100;
            const strength = Math.min(Math.round(priceChange * 30), 100);

            if (strength >= 20) { // Filtro de força mínima
                divergences.push({
                    type: 'bullish',
                    startIndex: segment1Start,
                    endIndex: segment2End,
                    startTimestamp: data[segment1Start].timestamp,
                    endTimestamp: data[segment2End].timestamp,
                    priceDirection: 'down',
                    cvdDirection: 'up',
                    strength,
                    description: `Divergência Bullish CVD: Preço caiu ${priceChange.toFixed(1)}% mas CVD subiu — acumulação detectada`,
                });
            }
        }

        // Divergência Bearish: preço faz higher high, CVD faz lower high
        if (seg2HighPrice > seg1HighPrice && seg2HighCVD < seg1HighCVD) {
            const priceChange = ((seg2HighPrice - seg1HighPrice) / seg1HighPrice) * 100;
            const strength = Math.min(Math.round(priceChange * 30), 100);

            if (strength >= 20) {
                divergences.push({
                    type: 'bearish',
                    startIndex: segment1Start,
                    endIndex: segment2End,
                    startTimestamp: data[segment1Start].timestamp,
                    endTimestamp: data[segment2End].timestamp,
                    priceDirection: 'up',
                    cvdDirection: 'down',
                    strength,
                    description: `Divergência Bearish CVD: Preço subiu ${priceChange.toFixed(1)}% mas CVD caiu — distribuição detectada`,
                });
            }
        }
    }

    return divergences;
};

// ──────────── Análise Completa ────────────

/**
 * Executa a análise completa de CVD.
 */
export const analyzeCVD = (
    data: OHLCPoint[],
    lookbackPeriod: number = 20
): CVDResult => {
    const points = calculateCVD(data);

    if (points.length === 0) {
        return {
            points: [],
            divergences: [],
            currentTrend: 'neutral',
            momentum: 0,
        };
    }

    const divergences = detectCVDDivergences(data, points, lookbackPeriod);

    // Determina tendência atual do CVD
    const recentPoints = points.slice(-10);
    const firstCVD = recentPoints[0].cumulative;
    const lastCVD = recentPoints[recentPoints.length - 1].cumulative;
    const cvdChange = lastCVD - firstCVD;

    let currentTrend: 'accumulation' | 'distribution' | 'neutral' = 'neutral';
    const avgVolume = recentPoints.reduce((sum, p) => sum + Math.abs(p.delta), 0) / recentPoints.length;
    const cvdThreshold = avgVolume * 3;

    if (cvdChange > cvdThreshold) {
        currentTrend = 'accumulation';
    } else if (cvdChange < -cvdThreshold) {
        currentTrend = 'distribution';
    }

    // Calcula momentum (-100 a 100)
    const recentDeltas = recentPoints.map(p => p.delta);
    const totalDelta = recentDeltas.reduce((sum, d) => sum + d, 0);
    const totalAbsDelta = recentDeltas.reduce((sum, d) => sum + Math.abs(d), 0);
    const momentum = totalAbsDelta > 0
        ? Math.round((totalDelta / totalAbsDelta) * 100)
        : 0;

    return {
        points,
        divergences,
        currentTrend,
        momentum,
    };
};
