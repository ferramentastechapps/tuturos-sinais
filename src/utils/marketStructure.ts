// Market Structure Analysis — HH, HL, LH, LL, BOS, CHOCH
// Detecta estrutura de mercado para identificar tendências e reversões

import { OHLCPoint } from '@/services/coingeckoOHLC';

// ──────────── Tipos ────────────

export type SwingType = 'high' | 'low';
export type StructureType = 'HH' | 'HL' | 'LH' | 'LL';
export type BreakType = 'BOS' | 'CHOCH';
export type TrendDirection = 'bullish' | 'bearish' | 'ranging';

export interface SwingPoint {
  index: number;
  timestamp: number;
  price: number;
  type: SwingType;
  structure?: StructureType;
}

export interface StructureBreak {
  type: BreakType;
  direction: 'bullish' | 'bearish';
  brokenLevel: number;
  breakPrice: number;
  breakIndex: number;
  breakTimestamp: number;
  description: string;
}

export interface MarketStructureResult {
  swingPoints: SwingPoint[];
  structureBreaks: StructureBreak[];
  currentTrend: TrendDirection;
  lastStructure: StructureType | null;
  trendStrength: number; // 0-100
}

// ──────────── Detecção de Swing Points ────────────

/**
 * Detecta pontos de swing (topos e fundos) usando pivôs com lookback configurável.
 * Um swing high requer que o high seja o maior em `lookback` candles de cada lado.
 * Um swing low requer que o low seja o menor em `lookback` candles de cada lado.
 */
export const detectSwingPoints = (
  data: OHLCPoint[],
  lookback: number = 3
): SwingPoint[] => {
  const swingPoints: SwingPoint[] = [];

  if (data.length < lookback * 2 + 1) return swingPoints;

  for (let i = lookback; i < data.length - lookback; i++) {
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= lookback; j++) {
      // Checa se é swing high
      if (data[i].high <= data[i - j].high || data[i].high <= data[i + j].high) {
        isSwingHigh = false;
      }
      // Checa se é swing low
      if (data[i].low >= data[i - j].low || data[i].low >= data[i + j].low) {
        isSwingLow = false;
      }
    }

    if (isSwingHigh) {
      swingPoints.push({
        index: i,
        timestamp: data[i].timestamp,
        price: data[i].high,
        type: 'high',
      });
    }

    if (isSwingLow) {
      swingPoints.push({
        index: i,
        timestamp: data[i].timestamp,
        price: data[i].low,
        type: 'low',
      });
    }
  }

  // Ordena por índice
  swingPoints.sort((a, b) => a.index - b.index);

  return swingPoints;
};

// ──────────── Classificação HH/HL/LH/LL ────────────

/**
 * Classifica cada swing point como HH (Higher High), HL (Higher Low),
 * LH (Lower High) ou LL (Lower Low) comparando com o swing anterior do mesmo tipo.
 */
export const classifySwingPoints = (swingPoints: SwingPoint[]): SwingPoint[] => {
  const classified = [...swingPoints];
  let lastHigh: SwingPoint | null = null;
  let lastLow: SwingPoint | null = null;

  for (const point of classified) {
    if (point.type === 'high') {
      if (lastHigh) {
        point.structure = point.price > lastHigh.price ? 'HH' : 'LH';
      }
      lastHigh = point;
    } else {
      if (lastLow) {
        point.structure = point.price > lastLow.price ? 'HL' : 'LL';
      }
      lastLow = point;
    }
  }

  return classified;
};

// ──────────── Detecção de BOS e CHOCH ────────────

/**
 * Detecta Break of Structure (BOS) e Change of Character (CHOCH).
 * 
 * - **BOS (Break of Structure)**: Rompimento que confirma continuidade da tendência.
 *   - Bullish BOS: preço rompe acima do último swing high em tendência de alta.
 *   - Bearish BOS: preço rompe abaixo do último swing low em tendência de baixa.
 * 
 * - **CHOCH (Change of Character)**: Rompimento que sinaliza reversão.
 *   - Bullish CHOCH: durante tendência de baixa, preço rompe acima do último LH.
 *   - Bearish CHOCH: durante tendência de alta, preço rompe abaixo do último HL.
 */
export const detectStructureBreaks = (
  data: OHLCPoint[],
  swingPoints: SwingPoint[]
): StructureBreak[] => {
  const breaks: StructureBreak[] = [];

  if (swingPoints.length < 4) return breaks;

  // Determina a tendência inicial pela sequência de swings
  let currentTrend: TrendDirection = 'ranging';

  for (let i = 2; i < swingPoints.length; i++) {
    const current = swingPoints[i];
    const prev = swingPoints[i - 1];
    const prevPrev = swingPoints[i - 2];

    // Atualiza tendência baseado na estrutura
    if (current.structure === 'HH' || current.structure === 'HL') {
      if (prevPrev.structure === 'HH' || prevPrev.structure === 'HL') {
        currentTrend = 'bullish';
      }
    } else if (current.structure === 'LH' || current.structure === 'LL') {
      if (prevPrev.structure === 'LH' || prevPrev.structure === 'LL') {
        currentTrend = 'bearish';
      }
    }

    // Procura por rompimentos nos candles após o swing point
    const searchStart = current.index + 1;
    const searchEnd = i + 1 < swingPoints.length ? swingPoints[i + 1].index : data.length;

    for (let j = searchStart; j < searchEnd && j < data.length; j++) {
      const candle = data[j];

      // Checa rompimento de swing high
      if (current.type === 'high') {
        if (candle.close > current.price) {
          if (currentTrend === 'bullish' && current.structure === 'HH') {
            // BOS bullish — continuação
            breaks.push({
              type: 'BOS',
              direction: 'bullish',
              brokenLevel: current.price,
              breakPrice: candle.close,
              breakIndex: j,
              breakTimestamp: candle.timestamp,
              description: `BOS Bullish: Rompeu HH em $${current.price.toFixed(2)}`,
            });
          } else if (currentTrend === 'bearish' && (current.structure === 'LH' || current.structure === 'HH')) {
            // CHOCH bullish — possível reversão
            breaks.push({
              type: 'CHOCH',
              direction: 'bullish',
              brokenLevel: current.price,
              breakPrice: candle.close,
              breakIndex: j,
              breakTimestamp: candle.timestamp,
              description: `CHOCH Bullish: Rompeu ${current.structure} em $${current.price.toFixed(2)} — possível reversão`,
            });
          }
          break; // Só registra o primeiro rompimento
        }
      }

      // Checa rompimento de swing low
      if (current.type === 'low') {
        if (candle.close < current.price) {
          if (currentTrend === 'bearish' && current.structure === 'LL') {
            // BOS bearish — continuação
            breaks.push({
              type: 'BOS',
              direction: 'bearish',
              brokenLevel: current.price,
              breakPrice: candle.close,
              breakIndex: j,
              breakTimestamp: candle.timestamp,
              description: `BOS Bearish: Rompeu LL em $${current.price.toFixed(2)}`,
            });
          } else if (currentTrend === 'bullish' && (current.structure === 'HL' || current.structure === 'LL')) {
            // CHOCH bearish — possível reversão
            breaks.push({
              type: 'CHOCH',
              direction: 'bearish',
              brokenLevel: current.price,
              breakPrice: candle.close,
              breakIndex: j,
              breakTimestamp: candle.timestamp,
              description: `CHOCH Bearish: Rompeu ${current.structure} em $${current.price.toFixed(2)} — possível reversão`,
            });
          }
          break;
        }
      }
    }
  }

  return breaks;
};

// ──────────── Análise Completa ────────────

/**
 * Calcula a força da tendência baseado na consistência dos swing points recentes.
 * Retorna de 0 (sem tendência) a 100 (tendência muito forte).
 */
const calculateTrendStrength = (swingPoints: SwingPoint[]): number => {
  if (swingPoints.length < 6) return 0;

  const recent = swingPoints.slice(-8);
  let bullishCount = 0;
  let bearishCount = 0;

  for (const point of recent) {
    if (point.structure === 'HH' || point.structure === 'HL') bullishCount++;
    if (point.structure === 'LH' || point.structure === 'LL') bearishCount++;
  }

  const total = bullishCount + bearishCount;
  if (total === 0) return 0;

  const dominant = Math.max(bullishCount, bearishCount);
  return Math.round((dominant / total) * 100);
};

/**
 * Determina a tendência atual baseada nos últimos swing points classificados.
 */
const determineTrend = (swingPoints: SwingPoint[]): TrendDirection => {
  const recent = swingPoints.filter(p => p.structure).slice(-4);
  if (recent.length < 2) return 'ranging';

  const lastTwo = recent.slice(-2);
  const hasHH = lastTwo.some(p => p.structure === 'HH');
  const hasHL = lastTwo.some(p => p.structure === 'HL');
  const hasLH = lastTwo.some(p => p.structure === 'LH');
  const hasLL = lastTwo.some(p => p.structure === 'LL');

  if ((hasHH && hasHL) || (hasHH && !hasLL)) return 'bullish';
  if ((hasLH && hasLL) || (hasLL && !hasHH)) return 'bearish';
  return 'ranging';
};

/**
 * Executa a análise completa de estrutura de mercado.
 * @param data - Array de candles OHLC
 * @param lookback - Número de candles de cada lado para detectar pivôs (default: 3)
 */
export const analyzeMarketStructure = (
  data: OHLCPoint[],
  lookback: number = 3
): MarketStructureResult => {
  // 1. Detectar swing points
  const rawSwings = detectSwingPoints(data, lookback);

  // 2. Classificar como HH/HL/LH/LL
  const classifiedSwings = classifySwingPoints(rawSwings);

  // 3. Detectar BOS e CHOCH
  const structureBreaks = detectStructureBreaks(data, classifiedSwings);

  // 4. Determinar tendência atual
  const currentTrend = determineTrend(classifiedSwings);

  // 5. Calcular força da tendência
  const trendStrength = calculateTrendStrength(classifiedSwings);

  // 6. Última estrutura registrada
  const lastClassified = classifiedSwings.filter(p => p.structure);
  const lastStructure = lastClassified.length > 0
    ? lastClassified[lastClassified.length - 1].structure!
    : null;

  return {
    swingPoints: classifiedSwings,
    structureBreaks,
    currentTrend,
    lastStructure,
    trendStrength,
  };
};
