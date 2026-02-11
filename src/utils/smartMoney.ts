// Smart Money Concepts — Order Blocks, Fair Value Gaps, Zonas de Liquidez
// Identifica zonas institucionais de alta relevância para trading

import { OHLCPoint } from '@/services/coingeckoOHLC';

// ──────────── Tipos ────────────

export interface OrderBlock {
    type: 'bullish' | 'bearish';
    startIndex: number;
    endIndex: number;
    timestamp: number;
    top: number;       // Preço superior do OB
    bottom: number;    // Preço inferior do OB
    mitigated: boolean; // Se já foi tocado/preenchido
    strength: number;  // 0-100 baseado no volume e deslocamento
    description: string;
}

export interface FairValueGap {
    type: 'bullish' | 'bearish';
    index: number;
    timestamp: number;
    top: number;       // Limite superior do gap
    bottom: number;    // Limite inferior do gap
    size: number;      // Tamanho em % do preço
    filled: boolean;   // Se já foi preenchido
    fillPercent: number; // % do gap que foi preenchido (0-100)
    description: string;
}

export interface LiquidityZone {
    type: 'equal_highs' | 'equal_lows' | 'stop_hunt_high' | 'stop_hunt_low';
    direction: 'buy_side' | 'sell_side'; // Buy-side liquidity (acima) ou sell-side (abaixo)
    price: number;
    count: number;     // Quantas vezes o nível foi tocado
    indices: number[]; // Candles que formaram a zona
    timestamp: number;
    swept: boolean;    // Se a liquidez já foi varrida
    description: string;
}

export interface SmartMoneyResult {
    orderBlocks: OrderBlock[];
    fairValueGaps: FairValueGap[];
    liquidityZones: LiquidityZone[];
}

// ──────────── Order Blocks ────────────

/**
 * Detecta Order Blocks (OB).
 * 
 * Um **Bullish Order Block** é a última candle bearish antes de um movimento 
 * impulsivo de alta. Representa a zona onde instituições compraram.
 * 
 * Um **Bearish Order Block** é a última candle bullish antes de um movimento 
 * impulsivo de baixa. Representa a zona onde instituições venderam.
 * 
 * @param data Array de candles OHLC
 * @param minImpulsePercent Percentual mínimo de deslocamento para considerar impulso (default: 1%)
 */
export const detectOrderBlocks = (
    data: OHLCPoint[],
    minImpulsePercent: number = 1.0
): OrderBlock[] => {
    const orderBlocks: OrderBlock[] = [];

    if (data.length < 5) return orderBlocks;

    for (let i = 1; i < data.length - 3; i++) {
        const candle = data[i];
        const isBullishCandle = candle.close > candle.open;
        const isBearishCandle = candle.close < candle.open;

        // Verifica o deslocamento nos próximos 3 candles
        const futureHighest = Math.max(data[i + 1].high, data[i + 2].high, data[i + 3].high);
        const futureLowest = Math.min(data[i + 1].low, data[i + 2].low, data[i + 3].low);

        // Bullish OB: candle bearish seguido de impulso de alta
        if (isBearishCandle) {
            const impulseUp = ((futureHighest - candle.high) / candle.high) * 100;
            if (impulseUp >= minImpulsePercent) {
                // Verifica se o OB foi mitigado (preço retornou à zona)
                let mitigated = false;
                for (let j = i + 3; j < data.length; j++) {
                    if (data[j].low <= candle.close) {
                        mitigated = true;
                        break;
                    }
                }

                // Calcula força baseada no tamanho do impulso
                const strength = Math.min(Math.round(impulseUp * 20), 100);

                orderBlocks.push({
                    type: 'bullish',
                    startIndex: i,
                    endIndex: i,
                    timestamp: candle.timestamp,
                    top: candle.open,    // Open da candle bearish (parte superior do corpo)
                    bottom: candle.close, // Close da candle bearish (parte inferior do corpo)
                    mitigated,
                    strength,
                    description: `OB Bullish: $${candle.close.toFixed(2)} - $${candle.open.toFixed(2)} (impulso +${impulseUp.toFixed(1)}%)`,
                });
            }
        }

        // Bearish OB: candle bullish seguido de impulso de baixa
        if (isBullishCandle) {
            const impulseDown = ((candle.low - futureLowest) / candle.low) * 100;
            if (impulseDown >= minImpulsePercent) {
                let mitigated = false;
                for (let j = i + 3; j < data.length; j++) {
                    if (data[j].high >= candle.close) {
                        mitigated = true;
                        break;
                    }
                }

                const strength = Math.min(Math.round(impulseDown * 20), 100);

                orderBlocks.push({
                    type: 'bearish',
                    startIndex: i,
                    endIndex: i,
                    timestamp: candle.timestamp,
                    top: candle.close,   // Close da candle bullish (parte superior do corpo)
                    bottom: candle.open, // Open da candle bullish (parte inferior do corpo)
                    mitigated,
                    strength,
                    description: `OB Bearish: $${candle.open.toFixed(2)} - $${candle.close.toFixed(2)} (impulso -${impulseDown.toFixed(1)}%)`,
                });
            }
        }
    }

    // Filtra apenas os OBs mais recentes e mais fortes (máx 10)
    return orderBlocks
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 10)
        .sort((a, b) => a.startIndex - b.startIndex);
};

// ──────────── Fair Value Gaps ────────────

/**
 * Detecta Fair Value Gaps (FVG).
 * 
 * Um **Bullish FVG** ocorre quando o low da candle 3 está acima do high da candle 1,
 * criando um gap que o preço pode voltar a preencher.
 * 
 * Um **Bearish FVG** ocorre quando o high da candle 3 está abaixo do low da candle 1.
 */
export const detectFairValueGaps = (
    data: OHLCPoint[],
    minGapPercent: number = 0.1 // Gap mínimo de 0.1% para filtrar ruído
): FairValueGap[] => {
    const fvgs: FairValueGap[] = [];

    if (data.length < 3) return fvgs;

    for (let i = 2; i < data.length; i++) {
        const candle1 = data[i - 2];
        const candle2 = data[i - 1];
        const candle3 = data[i];

        // Bullish FVG: gap entre high da candle 1 e low da candle 3
        if (candle3.low > candle1.high) {
            const gapSize = ((candle3.low - candle1.high) / candle2.close) * 100;

            if (gapSize >= minGapPercent) {
                // Verifica preenchimento
                let fillPercent = 0;
                let filled = false;
                const gapTop = candle3.low;
                const gapBottom = candle1.high;
                const gapRange = gapTop - gapBottom;

                for (let j = i + 1; j < data.length; j++) {
                    if (data[j].low <= gapBottom) {
                        fillPercent = 100;
                        filled = true;
                        break;
                    } else if (data[j].low < gapTop) {
                        const currentFill = ((gapTop - data[j].low) / gapRange) * 100;
                        fillPercent = Math.max(fillPercent, currentFill);
                    }
                }

                fvgs.push({
                    type: 'bullish',
                    index: i - 1, // Referência ao candle intermediário
                    timestamp: candle2.timestamp,
                    top: gapTop,
                    bottom: gapBottom,
                    size: gapSize,
                    filled,
                    fillPercent: Math.round(fillPercent),
                    description: `FVG Bullish: $${gapBottom.toFixed(2)} - $${gapTop.toFixed(2)} (${gapSize.toFixed(2)}%)${filled ? ' — FECHADO' : ''}`,
                });
            }
        }

        // Bearish FVG: gap entre low da candle 1 e high da candle 3
        if (candle3.high < candle1.low) {
            const gapSize = ((candle1.low - candle3.high) / candle2.close) * 100;

            if (gapSize >= minGapPercent) {
                let fillPercent = 0;
                let filled = false;
                const gapTop = candle1.low;
                const gapBottom = candle3.high;
                const gapRange = gapTop - gapBottom;

                for (let j = i + 1; j < data.length; j++) {
                    if (data[j].high >= gapTop) {
                        fillPercent = 100;
                        filled = true;
                        break;
                    } else if (data[j].high > gapBottom) {
                        const currentFill = ((data[j].high - gapBottom) / gapRange) * 100;
                        fillPercent = Math.max(fillPercent, currentFill);
                    }
                }

                fvgs.push({
                    type: 'bearish',
                    index: i - 1,
                    timestamp: candle2.timestamp,
                    top: gapTop,
                    bottom: gapBottom,
                    size: gapSize,
                    filled,
                    fillPercent: Math.round(fillPercent),
                    description: `FVG Bearish: $${gapBottom.toFixed(2)} - $${gapTop.toFixed(2)} (${gapSize.toFixed(2)}%)${filled ? ' — FECHADO' : ''}`,
                });
            }
        }
    }

    // Retorna os FVGs mais recentes (máx 15)
    return fvgs.slice(-15);
};

// ──────────── Zonas de Liquidez ────────────

/**
 * Detecta zonas de liquidez (Equal Highs/Lows e Stop Hunts).
 * 
 * - **Equal Highs**: Múltiplos topos no mesmo nível indicam acúmulo de stops de venda.
 * - **Equal Lows**: Múltiplos fundos no mesmo nível indicam acúmulo de stops de compra.
 * - **Stop Hunt High**: Preço rompe brevemente acima dos equal highs e retorna.
 * - **Stop Hunt Low**: Preço rompe brevemente abaixo dos equal lows e retorna.
 * 
 * @param tolerance Tolerância para considerar dois preços como "iguais" (default: 0.3%)
 */
export const detectLiquidityZones = (
    data: OHLCPoint[],
    tolerance: number = 0.003
): LiquidityZone[] => {
    const zones: LiquidityZone[] = [];

    if (data.length < 10) return zones;

    // 1. Coleta e Ordena Highs (O(N log N))
    const highs = data.map((d, i) => ({ price: d.high, index: i }))
        .sort((a, b) => b.price - a.price); // Descendente para facilitar

    // 2. Clusterização Linear de Highs (O(N))
    let i = 0;
    while (i < highs.length) {
        const cluster = [highs[i]];
        let j = i + 1;

        while (j < highs.length) {
            const diff = Math.abs(highs[i].price - highs[j].price) / highs[i].price;
            if (diff <= tolerance) {
                cluster.push(highs[j]);
                j++;
            } else {
                break;
            }
        }

        // Processar cluster se tiver relevância (>= 2 toques)
        if (cluster.length >= 2) {
            const avgPrice = cluster.reduce((sum, c) => sum + c.price, 0) / cluster.length;
            const indices = cluster.map(c => c.index).sort((a, b) => a - b);
            const lastIndex = indices[indices.length - 1];

            // Verifica se houve sweep (stop hunt) APÓS a formação da zona
            let swept = false;
            // Otimização: Só checar sweep se a zona não for muito antiga ou se estivermos perto do preço atual
            // Para garantir precisão, checamos até o fim, mas limitamos o scan se necessário.
            // Aqui mantemos scan linear pois clusters são poucos.
            for (let k = lastIndex + 1; k < data.length; k++) {
                if (data[k].high > avgPrice * (1 + tolerance) && data[k].close < avgPrice) {
                    swept = true;
                    zones.push({
                        type: 'stop_hunt_high',
                        direction: 'buy_side',
                        price: avgPrice,
                        count: cluster.length,
                        indices,
                        timestamp: data[lastIndex].timestamp,
                        swept: true,
                        description: `Stop Hunt High: $${avgPrice.toFixed(2)} — liquidez varrida (${cluster.length}x)`,
                    });
                    break;
                }
            }

            if (!swept) {
                zones.push({
                    type: 'equal_highs',
                    direction: 'buy_side',
                    price: avgPrice,
                    count: cluster.length,
                    indices,
                    timestamp: data[lastIndex].timestamp,
                    swept: false,
                    description: `Equal Highs: $${avgPrice.toFixed(2)} — ${cluster.length} toques (liquidez acumulada)`,
                });
            }
        }

        // Avança o índice principal
        i = j;
    }

    // 3. Coleta e Ordena Lows (O(N log N))
    const lows = data.map((d, i) => ({ price: d.low, index: i }))
        .sort((a, b) => a.price - b.price); // Ascendente

    // 4. Clusterização Linear de Lows (O(N))
    i = 0;
    while (i < lows.length) {
        const cluster = [lows[i]];
        let j = i + 1;

        while (j < lows.length) {
            const diff = Math.abs(lows[i].price - lows[j].price) / lows[i].price;
            if (diff <= tolerance) {
                cluster.push(lows[j]);
                j++;
            } else {
                break;
            }
        }

        if (cluster.length >= 2) {
            const avgPrice = cluster.reduce((sum, c) => sum + c.price, 0) / cluster.length;
            const indices = cluster.map(c => c.index).sort((a, b) => a - b);
            const lastIndex = indices[indices.length - 1];

            let swept = false;
            for (let k = lastIndex + 1; k < data.length; k++) {
                if (data[k].low < avgPrice * (1 - tolerance) && data[k].close > avgPrice) {
                    swept = true;
                    zones.push({
                        type: 'stop_hunt_low',
                        direction: 'sell_side',
                        price: avgPrice,
                        count: cluster.length,
                        indices,
                        timestamp: data[lastIndex].timestamp,
                        swept: true,
                        description: `Stop Hunt Low: $${avgPrice.toFixed(2)} — liquidez varrida (${cluster.length}x)`,
                    });
                    break;
                }
            }

            if (!swept) {
                zones.push({
                    type: 'equal_lows',
                    direction: 'sell_side',
                    price: avgPrice,
                    count: cluster.length,
                    indices,
                    timestamp: data[lastIndex].timestamp,
                    swept: false,
                    description: `Equal Lows: $${avgPrice.toFixed(2)} — ${cluster.length} toques (liquidez acumulada)`,
                });
            }
        }

        i = j;
    }

    // Ordena por relevância (mais toques = mais importante) e proximidade
    return zones
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);
};

// ──────────── Análise Completa ────────────

/**
 * Executa a análise completa de Smart Money Concepts.
 */
export const analyzeSmartMoney = (
    data: OHLCPoint[],
    options?: {
        minImpulsePercent?: number;
        minGapPercent?: number;
        liquidityTolerance?: number;
    }
): SmartMoneyResult => {
    const { minImpulsePercent = 1.0, minGapPercent = 0.1, liquidityTolerance = 0.003 } = options || {};

    return {
        orderBlocks: detectOrderBlocks(data, minImpulsePercent),
        fairValueGaps: detectFairValueGaps(data, minGapPercent),
        liquidityZones: detectLiquidityZones(data, liquidityTolerance),
    };
};
