// Volume Profile — POC, VAH, VAL
// Distribui volume por níveis de preço para identificar zonas de valor

import { OHLCPoint } from '@/services/coingeckoOHLC';

// ──────────── Tipos ────────────

export interface VolumeProfileLevel {
    price: number;        // Centro do nível de preço
    priceHigh: number;    // Limite superior
    priceLow: number;     // Limite inferior
    volume: number;       // Volume total neste nível
    buyVolume: number;    // Volume de compra estimado
    sellVolume: number;   // Volume de venda estimado
    percentage: number;   // % do volume total
}

export interface VolumeProfileResult {
    levels: VolumeProfileLevel[];
    poc: number;          // Point of Control — preço com maior volume
    vah: number;          // Value Area High — limite superior da área de valor
    val: number;          // Value Area Low — limite inferior da área de valor
    totalVolume: number;
    highVolumeLevels: VolumeProfileLevel[];  // Níveis com volume significativo (> 1.5x média)
    lowVolumeLevels: VolumeProfileLevel[];   // Low Volume Nodes (possíveis gaps)
    description: string;
}

// ──────────── Cálculo do Volume Profile ────────────

/**
 * Calcula o Volume Profile distribuindo o volume dos candles em níveis de preço.
 * 
 * Se o candle não possui dados de volume, estima o volume usando o range (high - low)
 * como proxy de atividade, o que funciona razoavelmente bem para crypto.
 * 
 * @param data Array de candles OHLC
 * @param numLevels Número de níveis de preço a dividir (default: 24)
 * @param valueAreaPercent Percentual do volume total que define a Value Area (default: 70%)
 */
export const calculateVolumeProfile = (
    data: OHLCPoint[],
    numLevels: number = 24,
    valueAreaPercent: number = 70
): VolumeProfileResult => {
    if (data.length < 5) {
        return {
            levels: [],
            poc: 0,
            vah: 0,
            val: 0,
            totalVolume: 0,
            highVolumeLevels: [],
            lowVolumeLevels: [],
            description: 'Dados insuficientes para Volume Profile',
        };
    }

    // 1. Encontra range total de preço
    let overallHigh = -Infinity;
    let overallLow = Infinity;

    for (const candle of data) {
        if (candle.high > overallHigh) overallHigh = candle.high;
        if (candle.low < overallLow) overallLow = candle.low;
    }

    const totalRange = overallHigh - overallLow;
    if (totalRange === 0) {
        return {
            levels: [],
            poc: data[0].close,
            vah: data[0].close,
            val: data[0].close,
            totalVolume: 0,
            highVolumeLevels: [],
            lowVolumeLevels: [],
            description: 'Range de preço zero',
        };
    }

    const levelSize = totalRange / numLevels;

    // 2. Inicializa os níveis
    const levels: VolumeProfileLevel[] = [];
    for (let i = 0; i < numLevels; i++) {
        const priceLow = overallLow + i * levelSize;
        const priceHigh = priceLow + levelSize;
        levels.push({
            price: (priceLow + priceHigh) / 2,
            priceHigh,
            priceLow,
            volume: 0,
            buyVolume: 0,
            sellVolume: 0,
            percentage: 0,
        });
    }

    // 3. Distribui o volume de cada candle nos níveis que ele abrange
    let totalVolume = 0;

    for (const candle of data) {
        // Volume do candle (usa volume real se disponível, senão estima)
        const candleVolume = candle.volume && candle.volume > 0
            ? candle.volume
            : (candle.high - candle.low) * 1000; // Proxy baseado no range

        const isBullish = candle.close >= candle.open;
        const candleRange = candle.high - candle.low;

        if (candleRange === 0) continue;

        // Distribui proporcionalmente nos níveis que o candle cobre
        for (const level of levels) {
            // Calcula a sobreposição entre o candle e o nível
            const overlapLow = Math.max(candle.low, level.priceLow);
            const overlapHigh = Math.min(candle.high, level.priceHigh);

            if (overlapHigh > overlapLow) {
                const overlapRatio = (overlapHigh - overlapLow) / candleRange;
                const distributedVolume = candleVolume * overlapRatio;

                level.volume += distributedVolume;
                totalVolume += distributedVolume;

                // Estima buy vs sell volume
                if (isBullish) {
                    level.buyVolume += distributedVolume * 0.6; // 60% compra em candle bullish
                    level.sellVolume += distributedVolume * 0.4;
                } else {
                    level.buyVolume += distributedVolume * 0.4;
                    level.sellVolume += distributedVolume * 0.6;
                }
            }
        }
    }

    // 4. Calcula percentuais
    for (const level of levels) {
        level.percentage = totalVolume > 0
            ? Math.round((level.volume / totalVolume) * 10000) / 100
            : 0;
    }

    // 5. Encontra o POC (Point of Control) — nível com maior volume
    let pocLevel = levels[0];
    for (const level of levels) {
        if (level.volume > pocLevel.volume) {
            pocLevel = level;
        }
    }
    const poc = pocLevel.price;

    // 6. Calcula Value Area (VAH e VAL)
    // A Value Area engloba ~70% do volume total, expandindo a partir do POC
    const valueAreaTarget = (totalVolume * valueAreaPercent) / 100;
    let valueAreaVolume = pocLevel.volume;

    const pocIndex = levels.indexOf(pocLevel);
    let vaHighIndex = pocIndex;
    let vaLowIndex = pocIndex;

    while (valueAreaVolume < valueAreaTarget && (vaHighIndex < levels.length - 1 || vaLowIndex > 0)) {
        const aboveVolume = vaHighIndex < levels.length - 1 ? levels[vaHighIndex + 1].volume : 0;
        const belowVolume = vaLowIndex > 0 ? levels[vaLowIndex - 1].volume : 0;

        if (aboveVolume >= belowVolume && vaHighIndex < levels.length - 1) {
            vaHighIndex++;
            valueAreaVolume += levels[vaHighIndex].volume;
        } else if (vaLowIndex > 0) {
            vaLowIndex--;
            valueAreaVolume += levels[vaLowIndex].volume;
        } else if (vaHighIndex < levels.length - 1) {
            vaHighIndex++;
            valueAreaVolume += levels[vaHighIndex].volume;
        }
    }

    const vah = levels[vaHighIndex].priceHigh;
    const val = levels[vaLowIndex].priceLow;

    // 7. Identifica High Volume Nodes e Low Volume Nodes
    const avgVolume = totalVolume / numLevels;
    const highVolumeLevels = levels.filter(l => l.volume > avgVolume * 1.5);
    const lowVolumeLevels = levels.filter(l => l.volume > 0 && l.volume < avgVolume * 0.5);

    return {
        levels,
        poc,
        vah,
        val,
        totalVolume,
        highVolumeLevels,
        lowVolumeLevels,
        description: `POC: $${poc.toFixed(2)} | VAH: $${vah.toFixed(2)} | VAL: $${val.toFixed(2)}`,
    };
};

/**
 * Retorna a posição relativa do preço em relação ao Volume Profile.
 */
export const getPricePositionInProfile = (
    price: number,
    profile: VolumeProfileResult
): {
    position: 'above_vah' | 'in_value_area' | 'below_val' | 'at_poc';
    signal: 'bullish' | 'bearish' | 'neutral';
    description: string;
} => {
    const pocTolerance = Math.abs(profile.vah - profile.val) * 0.05; // 5% do range VA

    if (Math.abs(price - profile.poc) <= pocTolerance) {
        return {
            position: 'at_poc',
            signal: 'neutral',
            description: `Preço no POC ($${profile.poc.toFixed(2)}) — zona de alto volume/equilíbrio`,
        };
    }

    if (price > profile.vah) {
        return {
            position: 'above_vah',
            signal: 'bullish',
            description: `Preço acima do VAH ($${profile.vah.toFixed(2)}) — região de breakout bullish`,
        };
    }

    if (price < profile.val) {
        return {
            position: 'below_val',
            signal: 'bearish',
            description: `Preço abaixo do VAL ($${profile.val.toFixed(2)}) — região de breakdown bearish`,
        };
    }

    return {
        position: 'in_value_area',
        signal: 'neutral',
        description: `Preço na Value Area ($${profile.val.toFixed(2)} - $${profile.vah.toFixed(2)})`,
    };
};
