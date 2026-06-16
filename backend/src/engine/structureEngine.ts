// ═══════════════════════════════════════════════════════════
// Structure Engine — ENGINE UNIVERSAL de Detecção de S/R
//
// PASSO 1: Lógica idêntica para TODAS as moedas.
// Os parâmetros (lookback, levelSpacing, minVolumeRatio, etc.)
// são injetados via SymbolConfig — calibrados por ativo.
//
// Fluxo:
//   1. findSupportResistanceLevels  — mapeia níveis históricos
//   2. findNearestLevel             — seleciona o nível mais próximo
//   3. detectLevelTest              — verifica se o preço testou o nível
//   4. confirmStructureVolume       — confirma com volume relativo
//   5. generateStructureSignal      — gera o sinal completo
// ═══════════════════════════════════════════════════════════

import { logger } from '../lib/logger.js';
import { calculateRVOL, calculateATR } from './signalEngine.js';
import { getDynamicSymbolConfig } from '../config/symbolConfig.js';
import type { OHLCPoint } from '../types/trading.js';

// ──── Tipos ────────────────────────────────────────────────

export interface StructureLevel {
    price: number;
    /** Quantas vezes o preço tocou neste nível (força do nível) */
    touches: number;
    /** Tipo do nível: resistência (acima do preço) ou suporte (abaixo) */
    kind: 'resistance' | 'support';
    /** Índice da primeira vela que formou o nível */
    firstTouch: number;
    /** Índice da última vela que tocou o nível */
    lastTouch: number;
}

export interface LevelTestResult {
    /** Nível que foi testado */
    level: StructureLevel | null;
    /** O preço testou o nível na última vela ou nas últimas confirmationCandles */
    tested: boolean;
    /** Teste de rejeição confirmado (preço tocou mas voltou) */
    confirmed: boolean;
    /** Distância % entre o preço atual e o nível */
    distancePct: number;
    /** Direção do sinal gerado pelo teste */
    direction: 'long' | 'short' | null;
    /** Descrição do teste para o log */
    reason: string;
}

export interface StructureSignalResult {
    /** Sinal gerado ou null se nenhuma condição foi satisfeita */
    direction: 'long' | 'short' | null;
    level: StructureLevel | null;
    levelTest: LevelTestResult;
    volumeConfirmed: boolean;
    rvol: number;
    allLevels: StructureLevel[];
    confluenceLabel: string;
}

// ──── PASSO 1A: Detectar Resistência/Suporte ───────────────

/**
 * findSupportResistanceLevels
 *
 * Identifica clusters de preço onde o mercado reverteu múltiplas vezes.
 * Usa os swings (topos e fundos) dos últimos `lookback` candles.
 *
 * @param ohlc           Array de candles OHLC
 * @param lookback       Quantas velas olhar para trás (calibrado por símbolo)
 * @param levelSpacing   % mínima para considerar dois níveis distintos
 * @param minLevelsDistance % mínima entre níveis válidos (elimina ruído)
 * @returns              Lista de níveis ordenada por força (touches desc)
 */
export function findSupportResistanceLevels(
    ohlc: OHLCPoint[],
    lookback: number,
    levelSpacing: number,
    minLevelsDistance: number,
): StructureLevel[] {
    if (ohlc.length < 10) return [];

    const slice = ohlc.slice(-Math.min(lookback, ohlc.length));
    const currentPrice = slice[slice.length - 1].close;
    const windowSize = 2; // Pivot: N velas de cada lado
    const rawLevels: { price: number; index: number; kind: 'resistance' | 'support' }[] = [];

    // Identifica topos (resistências) e fundos (suportes) usando pivots
    for (let i = windowSize; i < slice.length - windowSize; i++) {
        const candle = slice[i];
        const leftHighs  = slice.slice(i - windowSize, i).map(c => c.high);
        const rightHighs = slice.slice(i + 1, i + 1 + windowSize).map(c => c.high);
        const leftLows   = slice.slice(i - windowSize, i).map(c => c.low);
        const rightLows  = slice.slice(i + 1, i + 1 + windowSize).map(c => c.low);

        // Topo: high maior que os vizinhos → resistência
        if (candle.high >= Math.max(...leftHighs) && candle.high >= Math.max(...rightHighs)) {
            rawLevels.push({ price: candle.high, index: i, kind: 'resistance' });
        }
        // Fundo: low menor que os vizinhos → suporte
        if (candle.low <= Math.min(...leftLows) && candle.low <= Math.min(...rightLows)) {
            rawLevels.push({ price: candle.low, index: i, kind: 'support' });
        }
    }

    if (rawLevels.length === 0) return [];

    // Agrupa níveis próximos em clusters (elimina ruído de pivots muito próximos)
    const spacingAbs = currentPrice * levelSpacing;
    const minDistAbs = currentPrice * (minLevelsDistance / 100);
    const clusters: StructureLevel[] = [];

    for (const raw of rawLevels) {
        const existing = clusters.find(
            c => Math.abs(c.price - raw.price) <= spacingAbs && c.kind === raw.kind
        );
        if (existing) {
            // Agrupa: atualiza preço como média ponderada e incrementa toques
            existing.price = (existing.price * existing.touches + raw.price) / (existing.touches + 1);
            existing.touches++;
            existing.lastTouch = raw.index;
        } else {
            clusters.push({
                price: raw.price,
                touches: 1,
                kind: raw.kind,
                firstTouch: raw.index,
                lastTouch: raw.index,
            });
        }
    }

    // Filtra níveis muito próximos entre si (evita duplas entradas no mesmo cluster)
    const filtered: StructureLevel[] = [];
    const sortedByStrength = clusters.sort((a, b) => b.touches - a.touches);

    for (const level of sortedByStrength) {
        const tooClose = filtered.some(f => Math.abs(f.price - level.price) < minDistAbs);
        if (!tooClose) filtered.push(level);
    }

    return filtered;
}

// ──── PASSO 1B: Encontrar Nível Mais Próximo ───────────────

/**
 * findNearestLevel
 *
 * Retorna o nível de S/R mais próximo do preço atual,
 * filtrando por tipo (resistência acima, suporte abaixo).
 *
 * @param currentPrice   Preço atual
 * @param levels         Lista de níveis detectados
 * @param proximityPct   % máxima de distância para considerar o nível "próximo" (default 3%)
 */
export function findNearestLevel(
    currentPrice: number,
    levels: StructureLevel[],
    kind: 'resistance' | 'support',
    proximityPct = 0.03,
): StructureLevel | null {
    const candidates = levels.filter(l => {
        if (l.kind !== kind) return false;
        const dist = Math.abs(l.price - currentPrice) / currentPrice;
        if (dist > proximityPct) return false;
        // Resistência deve estar ACIMA, suporte ABAIXO
        if (kind === 'resistance') return l.price >= currentPrice;
        return l.price <= currentPrice;
    });

    if (candidates.length === 0) return null;

    // Retorna o mais próximo
    return candidates.reduce((best, c) =>
        Math.abs(c.price - currentPrice) < Math.abs(best.price - currentPrice) ? c : best
    );
}

// ──── PASSO 1C: Verificar Teste e Falha do Nível ──────────

/**
 * detectLevelTest
 *
 * Detecta se o preço testou e rejeitou um nível de S/R nas últimas
 * `confirmationCandles` velas, gerando um sinal de continuação.
 *
 * Lógica:
 * - RESISTÊNCIA testada → preço tocou/penetrou levemente mas fechou abaixo → SHORT
 * - SUPORTE testado     → preço tocou/penetrou levemente mas fechou acima → LONG
 *
 * @param ohlc                  Array de candles
 * @param level                 Nível a verificar
 * @param confirmationCandles   Quantas velas de confirmação exigir (calibrado por símbolo)
 * @param atr                   ATR atual (para calcular a tolerância de "toque")
 */
export function detectLevelTest(
    ohlc: OHLCPoint[],
    level: StructureLevel | null,
    confirmationCandles: number,
    atr: number,
): LevelTestResult {
    const nullResult: LevelTestResult = {
        level: null,
        tested: false,
        confirmed: false,
        distancePct: Infinity,
        direction: null,
        reason: 'Nível nulo',
    };

    if (!level || ohlc.length < confirmationCandles + 2) return nullResult;

    const currentCandle  = ohlc[ohlc.length - 1];
    const currentPrice   = currentCandle.close;
    const touchTolerance = atr > 0 ? atr * 0.5 : currentPrice * 0.002; // 0.5 ATR ou 0.2%
    const distancePct    = Math.abs(currentPrice - level.price) / currentPrice * 100;

    // Janela de confirmação: últimas N velas
    const window = ohlc.slice(-(confirmationCandles + 1));

    if (level.kind === 'resistance') {
        // Verificar se alguma vela da janela tocou ou violou a resistência (wick acima)
        const tested = window.some(c => c.high >= level.price - touchTolerance);

        if (!tested) {
            return { level, tested: false, confirmed: false, distancePct, direction: null, reason: 'Resistência não testada na janela' };
        }

        // Confirmação: vela atual fecha ABAIXO da resistência (rejeição = sinal SHORT)
        const rejectedBelow = currentCandle.close < level.price && currentCandle.open < level.price;

        // Bônus: vela de rejeição com pavio superior (shooting star ou engulfing bearish)
        const upperWick = currentCandle.high - Math.max(currentCandle.open, currentCandle.close);
        const body      = Math.abs(currentCandle.close - currentCandle.open);
        const hasRejectionWick = upperWick > body * 0.5;

        const confirmed = rejectedBelow && (distancePct < 1.5 || hasRejectionWick);

        return {
            level,
            tested: true,
            confirmed,
            distancePct,
            direction: confirmed ? 'short' : null,
            reason: confirmed
                ? `Resistência ${level.price.toFixed(4)} rejeitada (${distancePct.toFixed(2)}% dist, wick=${hasRejectionWick})`
                : `Resistência testada mas sem rejeição clara (close=${currentCandle.close.toFixed(4)} level=${level.price.toFixed(4)})`,
        };
    } else {
        // SUPORTE
        const tested = window.some(c => c.low <= level.price + touchTolerance);

        if (!tested) {
            return { level, tested: false, confirmed: false, distancePct, direction: null, reason: 'Suporte não testado na janela' };
        }

        // Confirmação: vela atual fecha ACIMA do suporte (rejeição = sinal LONG)
        const rejectedAbove = currentCandle.close > level.price && currentCandle.open > level.price;

        // Pavio inferior (martelo / pin bar bullish)
        const lowerWick = Math.min(currentCandle.open, currentCandle.close) - currentCandle.low;
        const body      = Math.abs(currentCandle.close - currentCandle.open);
        const hasRejectionWick = lowerWick > body * 0.5;

        const confirmed = rejectedAbove && (distancePct < 1.5 || hasRejectionWick);

        return {
            level,
            tested: true,
            confirmed,
            distancePct,
            direction: confirmed ? 'long' : null,
            reason: confirmed
                ? `Suporte ${level.price.toFixed(4)} rejeitado (${distancePct.toFixed(2)}% dist, wick=${hasRejectionWick})`
                : `Suporte testado mas sem rejeição clara (close=${currentCandle.close.toFixed(4)} level=${level.price.toFixed(4)})`,
        };
    }
}

// ──── PASSO 1D: Confirmar Volume ───────────────────────────

/**
 * confirmStructureVolume
 *
 * Verifica se o volume no momento do teste é relevante.
 * Volume fraco em nível de S/R = falso rompimento frequente.
 *
 * @param ohlc           Array de candles
 * @param minVolumeRatio RVOL mínimo exigido (calibrado por símbolo: BTC=1.2, DOGE=2.5)
 * @returns              { confirmed, rvol }
 */
export function confirmStructureVolume(
    ohlc: OHLCPoint[],
    minVolumeRatio: number,
): { confirmed: boolean; rvol: number } {
    const rvol = calculateRVOL(ohlc, 20);
    return { confirmed: rvol >= minVolumeRatio, rvol };
}

// ──── PASSO 1E: Gerar Sinal de Estrutura ───────────────────

/**
 * generateStructureSignal — ENGINE UNIVERSAL
 *
 * Orquestra os 4 passos e retorna o resultado consolidado.
 * A MESMA função é chamada para BTC (4H, 100 candles) e DOGE (5M, 20 candles).
 * O que muda são os parâmetros, não a lógica.
 *
 * @param symbol   Par de moedas
 * @param ohlc     Candles no timeframe calibrado para o símbolo
 * @returns        StructureSignalResult com direção e nível, ou null se sem sinal
 */
export function generateStructureSignal(
    symbol: string,
    ohlc: OHLCPoint[],
): StructureSignalResult | null {
    if (ohlc.length < 15) return null;

    const closes    = ohlc.map(c => c.close);
    const symConfig = getDynamicSymbolConfig(symbol, closes);
    const currentPrice = closes[closes.length - 1];
    const atr = calculateATR(ohlc, 14);

    // ── 1. Detecta todos os níveis de S/R ──────────────────
    const allLevels = findSupportResistanceLevels(
        ohlc,
        symConfig.lookback,
        symConfig.levelSpacing,
        symConfig.minLevelsDistance,
    );

    if (allLevels.length === 0) {
        logger.debug(`[STRUCTURE] ${symbol} sem níveis de S/R detectados (lookback=${symConfig.lookback})`);
        return null;
    }

    // ── 2. Encontra os níveis mais próximos (R e S) ────────
    const proximityPct = symConfig.levelSpacing * 3; // tolerância: 3x o spacing
    const nearestResistance = findNearestLevel(currentPrice, allLevels, 'resistance', proximityPct);
    const nearestSupport    = findNearestLevel(currentPrice, allLevels, 'support',    proximityPct);

    // ── 3. Verifica teste e falha em cada nível ────────────
    const resistanceTest = detectLevelTest(ohlc, nearestResistance, symConfig.confirmationCandles, atr);
    const supportTest    = detectLevelTest(ohlc, nearestSupport,    symConfig.confirmationCandles, atr);

    // ── 4. Confirma volume ─────────────────────────────────
    const { confirmed: volumeConfirmed, rvol } = confirmStructureVolume(ohlc, symConfig.minVolumeRatio);

    // ── 5. Determina o sinal final ─────────────────────────
    // Prioriza o nível com rejeição confirmada + volume
    let activeTest = resistanceTest.confirmed ? resistanceTest : supportTest;

    if (!activeTest.confirmed) {
        // Nenhum nível com rejeição confirmada
        logger.debug(
            `[STRUCTURE] ${symbol} sem rejeição confirmada | ` +
            `R: ${resistanceTest.reason} | S: ${supportTest.reason}`
        );
        return {
            direction: null,
            level: null,
            levelTest: activeTest,
            volumeConfirmed,
            rvol,
            allLevels,
            confluenceLabel: '',
        };
    }

    if (!volumeConfirmed) {
        logger.debug(
            `[STRUCTURE] ${symbol} rejeição em ${activeTest.level?.price.toFixed(4)} ` +
            `confirmada mas volume insuficiente (RVOL=${rvol.toFixed(2)} < ${symConfig.minVolumeRatio})`
        );
        return {
            direction: null,
            level: activeTest.level,
            levelTest: activeTest,
            volumeConfirmed: false,
            rvol,
            allLevels,
            confluenceLabel: '',
        };
    }

    // ✅ Sinal completo: rejeição confirmada + volume confirmado
    const kind  = activeTest.level!.kind;
    const label = kind === 'resistance'
        ? `Rejeição Resistência ${activeTest.level!.price.toFixed(4)} (${activeTest.level!.touches} toques) ✅`
        : `Rejeição Suporte ${activeTest.level!.price.toFixed(4)} (${activeTest.level!.touches} toques) ✅`;

    logger.debug(
        `[STRUCTURE] ${symbol} 🎯 ${activeTest.direction?.toUpperCase()} | ${label} | ` +
        `RVOL=${rvol.toFixed(2)} tf=${symConfig.timeframe}`
    );

    return {
        direction: activeTest.direction,
        level: activeTest.level,
        levelTest: activeTest,
        volumeConfirmed: true,
        rvol,
        allLevels,
        confluenceLabel: label,
    };
}

// ──── Export de utilitários para uso nos engines ───────────

/**
 * getStructureConfluences
 *
 * Retorna as confluências de estrutura formatadas para adicionar
 * ao array `indicators` dos sinais do signalEngine / scalpingEngine.
 */
export function getStructureConfluences(result: StructureSignalResult): string[] {
    const labels: string[] = [];
    if (!result.level) return labels;

    const level = result.level;

    if (result.levelTest.confirmed) {
        labels.push(result.confluenceLabel);
    }
    if (result.volumeConfirmed) {
        labels.push(`Volume Estrutura RVOL=${result.rvol.toFixed(2)} +1`);
    }
    if (level.touches >= 3) {
        labels.push(`Nível Forte (${level.touches} toques) +1`);
    }

    return labels;
}

/**
 * getStructureScore
 *
 * Converte o resultado de estrutura em pontos (0-3)
 * para somar ao score do engine principal.
 */
export function getStructureScore(result: StructureSignalResult | null): number {
    if (!result || !result.direction) return 0;
    let score = 0;
    if (result.levelTest.confirmed) score += 1;
    if (result.volumeConfirmed)     score += 1;
    if (result.level && result.level.touches >= 3) score += 1;
    return Math.min(score, 3);
}

// ──── Price Action Patterns ────────────────────────────────

export interface SwingPoint {
    price: number;
    index: number;
    kind: 'high' | 'low';
}

/**
 * findSwingPoints
 * Identifica pivôs (topos e fundos) nos dados de candles.
 */
export function findSwingPoints(ohlc: OHLCPoint[], windowSize = 3): SwingPoint[] {
    const swings: SwingPoint[] = [];
    if (ohlc.length < windowSize * 2 + 1) return swings;

    for (let i = windowSize; i < ohlc.length - windowSize; i++) {
        const candle = ohlc[i];
        const leftHighs  = ohlc.slice(i - windowSize, i).map(c => c.high);
        const rightHighs = ohlc.slice(i + 1, i + 1 + windowSize).map(c => c.high);
        const leftLows   = ohlc.slice(i - windowSize, i).map(c => c.low);
        const rightLows  = ohlc.slice(i + 1, i + 1 + windowSize).map(c => c.low);

        if (candle.high > Math.max(...leftHighs) && candle.high > Math.max(...rightHighs)) {
            swings.push({ price: candle.high, index: i, kind: 'high' });
        }
        if (candle.low < Math.min(...leftLows) && candle.low < Math.min(...rightLows)) {
            swings.push({ price: candle.low, index: i, kind: 'low' });
        }
    }
    return swings;
}

/**
 * detectBrokenZonePullback
 * Detecta se o preço rompeu recentemente uma zona de S/R e depois realizou um pullback
 * confirmando o teste e rejeitando a zona.
 */
export function detectBrokenZonePullback(
    ohlc: OHLCPoint[],
    levels: StructureLevel[],
    atr: number,
    lookback = 12,
): { isConfirmedPullback: boolean; direction: 'long' | 'short' | null; levelPrice: number | null } {
    if (ohlc.length < lookback + 2) return { isConfirmedPullback: false, direction: null, levelPrice: null };

    const tolerance = atr > 0 ? atr * 0.5 : ohlc[ohlc.length - 1].close * 0.002;

    for (const level of levels) {
        let breakoutIndex = -1;
        
        // Procura por um rompimento nos últimos 'lookback' candles (excluindo a vela atual)
        for (let i = ohlc.length - lookback; i < ohlc.length - 1; i++) {
            const candle = ohlc[i];
            const prevCandle = ohlc[i - 1];
            if (!prevCandle) continue;

            if (level.kind === 'resistance' && prevCandle.close <= level.price && candle.close > level.price) {
                breakoutIndex = i;
                break;
            }
            if (level.kind === 'support' && prevCandle.close >= level.price && candle.close < level.price) {
                breakoutIndex = i;
                break;
            }
        }

        if (breakoutIndex !== -1) {
            let testConfirmed = false;
            let rejectionConfirmed = false;

            // Verifica as velas após o rompimento até o candle atual
            for (let j = breakoutIndex + 1; j < ohlc.length; j++) {
                const candle = ohlc[j];
                if (level.kind === 'resistance') {
                    // Teste de pullback na antiga resistência (que agora atua como suporte)
                    if (candle.low <= level.price + tolerance && candle.low >= level.price - tolerance * 2) {
                        testConfirmed = true;
                        if (candle.close > level.price) {
                            rejectionConfirmed = true;
                        }
                    }
                } else {
                    // Teste de pullback no antigo suporte (que agora atua como resistência)
                    if (candle.high >= level.price - tolerance && candle.high <= level.price + tolerance * 2) {
                        testConfirmed = true;
                        if (candle.close < level.price) {
                            rejectionConfirmed = true;
                        }
                    }
                }
            }

            if (testConfirmed && rejectionConfirmed) {
                return {
                    isConfirmedPullback: true,
                    direction: level.kind === 'resistance' ? 'long' : 'short',
                    levelPrice: level.price,
                };
            }
        }
    }

    return { isConfirmedPullback: false, direction: null, levelPrice: null };
}

/**
 * detectDoublePattern
 * Detecta topos e fundos duplos comparando a proximidade dos dois últimos pivôs de alta/baixa.
 */
export function detectDoublePattern(
    ohlc: OHLCPoint[],
    atr: number,
): { doubleTop: boolean; doubleBottom: boolean; doubleTopPrice: number | null; doubleBottomPrice: number | null } {
    const swings = findSwingPoints(ohlc, 2);
    const highs = swings.filter(s => s.kind === 'high');
    const lows = swings.filter(s => s.kind === 'low');

    let doubleTop = false;
    let doubleBottom = false;
    let doubleTopPrice: number | null = null;
    let doubleBottomPrice: number | null = null;

    const currentPrice = ohlc[ohlc.length - 1].close;
    const tolerance = atr > 0 ? atr * 0.8 : currentPrice * 0.005;

    if (lows.length >= 2) {
        const lastLow = lows[lows.length - 1];
        const prevLow = lows[lows.length - 2];
        const indexDiff = lastLow.index - prevLow.index;
        
        if (indexDiff >= 5 && indexDiff <= 40 && Math.abs(lastLow.price - prevLow.price) <= tolerance) {
            if (currentPrice > lastLow.price && (currentPrice - lastLow.price) / lastLow.price < 0.03) {
                doubleBottom = true;
                doubleBottomPrice = (lastLow.price + prevLow.price) / 2;
            }
        }
    }

    if (highs.length >= 2) {
        const lastHigh = highs[highs.length - 1];
        const prevHigh = highs[highs.length - 2];
        const indexDiff = lastHigh.index - prevHigh.index;

        if (indexDiff >= 5 && indexDiff <= 40 && Math.abs(lastHigh.price - prevHigh.price) <= tolerance) {
            if (currentPrice < lastHigh.price && (lastHigh.price - currentPrice) / lastHigh.price < 0.03) {
                doubleTop = true;
                doubleTopPrice = (lastHigh.price + prevHigh.price) / 2;
            }
        }
    }

    return { doubleTop, doubleBottom, doubleTopPrice, doubleBottomPrice };
}

/**
 * detectInsideBar
 * Identifica se a última vela está contida inteiramente na variação da vela anterior.
 */
export function detectInsideBar(ohlc: OHLCPoint[]): { isInside: boolean; motherHigh: number; motherLow: number } {
    if (ohlc.length < 2) return { isInside: false, motherHigh: 0, motherLow: 0 };
    const current = ohlc[ohlc.length - 1];
    const mother = ohlc[ohlc.length - 2];

    const isInside = current.high <= mother.high && current.low >= mother.low;
    return { isInside, motherHigh: mother.high, motherLow: mother.low };
}

/**
 * detectTrendlineTouch
 * Conecta os dois últimos pivôs para traçar LTA/LTB e verifica se a vela atual tocou e rejeitou a reta.
 */
export function detectTrendlineTouch(
    ohlc: OHLCPoint[],
    atr: number,
): { touched: 'lta' | 'ltb' | null; reason: string } {
    if (ohlc.length < 30) return { touched: null, reason: 'Dados insuficientes' };

    const swings = findSwingPoints(ohlc, 3);
    const highs = swings.filter(s => s.kind === 'high');
    const lows = swings.filter(s => s.kind === 'low');
    const currentPrice = ohlc[ohlc.length - 1].close;
    const currentIdx = ohlc.length - 1;
    const tolerance = atr > 0 ? atr * 0.4 : currentPrice * 0.002;

    // LTA (Linha de Tendência Ascendente)
    if (lows.length >= 2) {
        const p2 = lows[lows.length - 1];
        const p1 = lows[lows.length - 2];

        if (p2.price > p1.price && p2.index - p1.index >= 8) {
            const m = (p2.price - p1.price) / (p2.index - p1.index);
            const c = p1.price - m * p1.index;
            const expectedPrice = m * currentIdx + c;

            let validLine = true;
            for (let i = p1.index + 1; i < currentIdx; i++) {
                const priceOnLine = m * i + c;
                if (ohlc[i].close < priceOnLine - tolerance * 1.5) {
                    validLine = false;
                    break;
                }
            }

            if (validLine && expectedPrice > 0) {
                const currentLow = ohlc[currentIdx].low;
                const currentClose = ohlc[currentIdx].close;
                const touchedLine = currentLow <= expectedPrice + tolerance && currentLow >= expectedPrice - tolerance * 2;
                const closedAbove = currentClose > expectedPrice;

                if (touchedLine && closedAbove) {
                    return {
                        touched: 'lta',
                        reason: `Toque na LTA (reta p1=${p1.price.toFixed(4)} @ ${p1.index} -> p2=${p2.price.toFixed(4)} @ ${p2.index}, esperado=${expectedPrice.toFixed(4)})`,
                    };
                }
            }
        }
    }

    // LTB (Linha de Tendência Descendente)
    if (highs.length >= 2) {
        const p2 = highs[highs.length - 1];
        const p1 = highs[highs.length - 2];

        if (p2.price < p1.price && p2.index - p1.index >= 8) {
            const m = (p2.price - p1.price) / (p2.index - p1.index);
            const c = p1.price - m * p1.index;
            const expectedPrice = m * currentIdx + c;

            let validLine = true;
            for (let i = p1.index + 1; i < currentIdx; i++) {
                const priceOnLine = m * i + c;
                if (ohlc[i].close > priceOnLine + tolerance * 1.5) {
                    validLine = false;
                    break;
                }
            }

            if (validLine && expectedPrice > 0) {
                const currentHigh = ohlc[currentIdx].high;
                const currentClose = ohlc[currentIdx].close;
                const touchedLine = currentHigh >= expectedPrice - tolerance && currentHigh <= expectedPrice + tolerance * 2;
                const closedBelow = currentClose < expectedPrice;

                if (touchedLine && closedBelow) {
                    return {
                        touched: 'ltb',
                        reason: `Toque na LTB (reta p1=${p1.price.toFixed(4)} @ ${p1.index} -> p2=${p2.price.toFixed(4)} @ ${p2.index}, esperado=${expectedPrice.toFixed(4)})`,
                    };
                }
            }
        }
    }

    return { touched: null, reason: 'Sem toque em linha de tendência' };
}
