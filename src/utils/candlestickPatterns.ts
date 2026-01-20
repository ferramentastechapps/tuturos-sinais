import { OHLCPoint } from '@/services/coingeckoOHLC';

export type PatternType = 
  | 'doji'
  | 'hammer'
  | 'inverted_hammer'
  | 'bullish_engulfing'
  | 'bearish_engulfing'
  | 'morning_star'
  | 'evening_star'
  | 'shooting_star'
  | 'hanging_man'
  | 'three_white_soldiers'
  | 'three_black_crows'
  | 'bullish_harami'
  | 'bearish_harami'
  | 'piercing_line'
  | 'dark_cloud_cover'
  | 'tweezer_tops'
  | 'tweezer_bottoms';

export interface CandlestickPattern {
  type: PatternType;
  name: string;
  description: string;
  signal: 'bullish' | 'bearish' | 'neutral';
  index: number;
  timestamp: number;
}

// Helper functions
const bodySize = (candle: OHLCPoint) => Math.abs(candle.close - candle.open);
const upperWick = (candle: OHLCPoint) => candle.high - Math.max(candle.open, candle.close);
const lowerWick = (candle: OHLCPoint) => Math.min(candle.open, candle.close) - candle.low;
const totalRange = (candle: OHLCPoint) => candle.high - candle.low;
const isBullish = (candle: OHLCPoint) => candle.close > candle.open;
const isBearish = (candle: OHLCPoint) => candle.close < candle.open;

// Pattern detection functions
const isDoji = (candle: OHLCPoint): boolean => {
  const body = bodySize(candle);
  const range = totalRange(candle);
  return range > 0 && body / range < 0.1;
};

const isHammer = (candle: OHLCPoint): boolean => {
  const body = bodySize(candle);
  const lower = lowerWick(candle);
  const upper = upperWick(candle);
  const range = totalRange(candle);
  
  return (
    range > 0 &&
    lower >= body * 2 &&
    upper < body * 0.5 &&
    body / range >= 0.1
  );
};

const isInvertedHammer = (candle: OHLCPoint): boolean => {
  const body = bodySize(candle);
  const lower = lowerWick(candle);
  const upper = upperWick(candle);
  const range = totalRange(candle);
  
  return (
    range > 0 &&
    upper >= body * 2 &&
    lower < body * 0.5 &&
    body / range >= 0.1
  );
};

const isShootingStar = (candle: OHLCPoint): boolean => {
  return isInvertedHammer(candle) && isBearish(candle);
};

const isHangingMan = (candle: OHLCPoint): boolean => {
  return isHammer(candle) && isBearish(candle);
};

const isBullishEngulfing = (prev: OHLCPoint, curr: OHLCPoint): boolean => {
  return (
    isBearish(prev) &&
    isBullish(curr) &&
    curr.open < prev.close &&
    curr.close > prev.open &&
    bodySize(curr) > bodySize(prev)
  );
};

const isBearishEngulfing = (prev: OHLCPoint, curr: OHLCPoint): boolean => {
  return (
    isBullish(prev) &&
    isBearish(curr) &&
    curr.open > prev.close &&
    curr.close < prev.open &&
    bodySize(curr) > bodySize(prev)
  );
};

const isMorningStar = (first: OHLCPoint, second: OHLCPoint, third: OHLCPoint): boolean => {
  const firstBody = bodySize(first);
  const secondBody = bodySize(second);
  const thirdBody = bodySize(third);
  
  return (
    isBearish(first) &&
    firstBody > secondBody * 2 &&
    isBullish(third) &&
    thirdBody > secondBody * 2 &&
    third.close > (first.open + first.close) / 2
  );
};

const isEveningStar = (first: OHLCPoint, second: OHLCPoint, third: OHLCPoint): boolean => {
  const firstBody = bodySize(first);
  const secondBody = bodySize(second);
  const thirdBody = bodySize(third);
  
  return (
    isBullish(first) &&
    firstBody > secondBody * 2 &&
    isBearish(third) &&
    thirdBody > secondBody * 2 &&
    third.close < (first.open + first.close) / 2
  );
};

const isThreeWhiteSoldiers = (
  first: OHLCPoint,
  second: OHLCPoint,
  third: OHLCPoint
): boolean => {
  return (
    isBullish(first) &&
    isBullish(second) &&
    isBullish(third) &&
    second.open > first.open &&
    second.close > first.close &&
    third.open > second.open &&
    third.close > second.close &&
    upperWick(first) < bodySize(first) * 0.3 &&
    upperWick(second) < bodySize(second) * 0.3 &&
    upperWick(third) < bodySize(third) * 0.3
  );
};

const isThreeBlackCrows = (
  first: OHLCPoint,
  second: OHLCPoint,
  third: OHLCPoint
): boolean => {
  return (
    isBearish(first) &&
    isBearish(second) &&
    isBearish(third) &&
    second.open < first.open &&
    second.close < first.close &&
    third.open < second.open &&
    third.close < second.close &&
    lowerWick(first) < bodySize(first) * 0.3 &&
    lowerWick(second) < bodySize(second) * 0.3 &&
    lowerWick(third) < bodySize(third) * 0.3
  );
};

// Bullish Harami - small bullish candle contained within previous bearish candle
const isBullishHarami = (prev: OHLCPoint, curr: OHLCPoint): boolean => {
  return (
    isBearish(prev) &&
    isBullish(curr) &&
    curr.open > prev.close &&
    curr.close < prev.open &&
    bodySize(curr) < bodySize(prev) * 0.6
  );
};

// Bearish Harami - small bearish candle contained within previous bullish candle
const isBearishHarami = (prev: OHLCPoint, curr: OHLCPoint): boolean => {
  return (
    isBullish(prev) &&
    isBearish(curr) &&
    curr.open < prev.close &&
    curr.close > prev.open &&
    bodySize(curr) < bodySize(prev) * 0.6
  );
};

// Piercing Line - bullish reversal, opens below prev low, closes above prev midpoint
const isPiercingLine = (prev: OHLCPoint, curr: OHLCPoint): boolean => {
  const prevMidpoint = (prev.open + prev.close) / 2;
  return (
    isBearish(prev) &&
    isBullish(curr) &&
    curr.open < prev.low &&
    curr.close > prevMidpoint &&
    curr.close < prev.open
  );
};

// Dark Cloud Cover - bearish reversal, opens above prev high, closes below prev midpoint
const isDarkCloudCover = (prev: OHLCPoint, curr: OHLCPoint): boolean => {
  const prevMidpoint = (prev.open + prev.close) / 2;
  return (
    isBullish(prev) &&
    isBearish(curr) &&
    curr.open > prev.high &&
    curr.close < prevMidpoint &&
    curr.close > prev.open
  );
};

// Tweezer Tops - two candles with same high, first bullish, second bearish
const isTweezerTops = (prev: OHLCPoint, curr: OHLCPoint): boolean => {
  const tolerance = totalRange(prev) * 0.05;
  return (
    isBullish(prev) &&
    isBearish(curr) &&
    Math.abs(curr.high - prev.high) < tolerance &&
    bodySize(prev) > totalRange(prev) * 0.3 &&
    bodySize(curr) > totalRange(curr) * 0.3
  );
};

// Tweezer Bottoms - two candles with same low, first bearish, second bullish
const isTweezerBottoms = (prev: OHLCPoint, curr: OHLCPoint): boolean => {
  const tolerance = totalRange(prev) * 0.05;
  return (
    isBearish(prev) &&
    isBullish(curr) &&
    Math.abs(curr.low - prev.low) < tolerance &&
    bodySize(prev) > totalRange(prev) * 0.3 &&
    bodySize(curr) > totalRange(curr) * 0.3
  );
};

// Main detection function
export const detectPatterns = (data: OHLCPoint[]): CandlestickPattern[] => {
  const patterns: CandlestickPattern[] = [];
  
  if (data.length < 3) return patterns;
  
  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const prev = i > 0 ? data[i - 1] : null;
    const prevPrev = i > 1 ? data[i - 2] : null;
    
    // Single candle patterns
    if (isDoji(candle)) {
      patterns.push({
        type: 'doji',
        name: 'Doji',
        description: 'Indica indecisão no mercado. Pode sinalizar reversão.',
        signal: 'neutral',
        index: i,
        timestamp: candle.timestamp,
      });
    } else if (isShootingStar(candle)) {
      patterns.push({
        type: 'shooting_star',
        name: 'Estrela Cadente',
        description: 'Padrão de reversão baixista após tendência de alta.',
        signal: 'bearish',
        index: i,
        timestamp: candle.timestamp,
      });
    } else if (isHangingMan(candle)) {
      patterns.push({
        type: 'hanging_man',
        name: 'Enforcado',
        description: 'Padrão de reversão baixista após tendência de alta.',
        signal: 'bearish',
        index: i,
        timestamp: candle.timestamp,
      });
    } else if (isHammer(candle) && isBullish(candle)) {
      patterns.push({
        type: 'hammer',
        name: 'Martelo',
        description: 'Padrão de reversão altista após tendência de baixa.',
        signal: 'bullish',
        index: i,
        timestamp: candle.timestamp,
      });
    } else if (isInvertedHammer(candle) && isBullish(candle)) {
      patterns.push({
        type: 'inverted_hammer',
        name: 'Martelo Invertido',
        description: 'Padrão potencial de reversão altista.',
        signal: 'bullish',
        index: i,
        timestamp: candle.timestamp,
      });
    }
    
    // Two candle patterns
    if (prev) {
      if (isBullishEngulfing(prev, candle)) {
        patterns.push({
          type: 'bullish_engulfing',
          name: 'Engolfo de Alta',
          description: 'Forte padrão de reversão altista.',
          signal: 'bullish',
          index: i,
          timestamp: candle.timestamp,
        });
      } else if (isBearishEngulfing(prev, candle)) {
        patterns.push({
          type: 'bearish_engulfing',
          name: 'Engolfo de Baixa',
          description: 'Forte padrão de reversão baixista.',
          signal: 'bearish',
          index: i,
          timestamp: candle.timestamp,
        });
      } else if (isBullishHarami(prev, candle)) {
        patterns.push({
          type: 'bullish_harami',
          name: 'Harami de Alta',
          description: 'Padrão de reversão altista. Corpo menor contido no anterior.',
          signal: 'bullish',
          index: i,
          timestamp: candle.timestamp,
        });
      } else if (isBearishHarami(prev, candle)) {
        patterns.push({
          type: 'bearish_harami',
          name: 'Harami de Baixa',
          description: 'Padrão de reversão baixista. Corpo menor contido no anterior.',
          signal: 'bearish',
          index: i,
          timestamp: candle.timestamp,
        });
      } else if (isPiercingLine(prev, candle)) {
        patterns.push({
          type: 'piercing_line',
          name: 'Linha Perfurante',
          description: 'Padrão de reversão altista. Abre abaixo e fecha acima do meio.',
          signal: 'bullish',
          index: i,
          timestamp: candle.timestamp,
        });
      } else if (isDarkCloudCover(prev, candle)) {
        patterns.push({
          type: 'dark_cloud_cover',
          name: 'Nuvem Negra',
          description: 'Padrão de reversão baixista. Abre acima e fecha abaixo do meio.',
          signal: 'bearish',
          index: i,
          timestamp: candle.timestamp,
        });
      } else if (isTweezerTops(prev, candle)) {
        patterns.push({
          type: 'tweezer_tops',
          name: 'Pinça de Topo',
          description: 'Padrão de reversão baixista. Duas velas com máximas iguais.',
          signal: 'bearish',
          index: i,
          timestamp: candle.timestamp,
        });
      } else if (isTweezerBottoms(prev, candle)) {
        patterns.push({
          type: 'tweezer_bottoms',
          name: 'Pinça de Fundo',
          description: 'Padrão de reversão altista. Duas velas com mínimas iguais.',
          signal: 'bullish',
          index: i,
          timestamp: candle.timestamp,
        });
      }
    }
    
    // Three candle patterns
    if (prev && prevPrev) {
      if (isMorningStar(prevPrev, prev, candle)) {
        patterns.push({
          type: 'morning_star',
          name: 'Estrela da Manhã',
          description: 'Forte padrão de reversão altista após tendência de baixa.',
          signal: 'bullish',
          index: i,
          timestamp: candle.timestamp,
        });
      } else if (isEveningStar(prevPrev, prev, candle)) {
        patterns.push({
          type: 'evening_star',
          name: 'Estrela da Noite',
          description: 'Forte padrão de reversão baixista após tendência de alta.',
          signal: 'bearish',
          index: i,
          timestamp: candle.timestamp,
        });
      } else if (isThreeWhiteSoldiers(prevPrev, prev, candle)) {
        patterns.push({
          type: 'three_white_soldiers',
          name: 'Três Soldados Brancos',
          description: 'Forte continuação altista.',
          signal: 'bullish',
          index: i,
          timestamp: candle.timestamp,
        });
      } else if (isThreeBlackCrows(prevPrev, prev, candle)) {
        patterns.push({
          type: 'three_black_crows',
          name: 'Três Corvos Negros',
          description: 'Forte continuação baixista.',
          signal: 'bearish',
          index: i,
          timestamp: candle.timestamp,
        });
      }
    }
  }
  
  return patterns;
};

// Get pattern icon/emoji for display
export const getPatternEmoji = (type: PatternType): string => {
  const emojiMap: Record<PatternType, string> = {
    doji: '➕',
    hammer: '🔨',
    inverted_hammer: '🔨',
    bullish_engulfing: '📈',
    bearish_engulfing: '📉',
    morning_star: '🌅',
    evening_star: '🌆',
    shooting_star: '💫',
    hanging_man: '👤',
    three_white_soldiers: '⬆️⬆️⬆️',
    three_black_crows: '⬇️⬇️⬇️',
    bullish_harami: '🤰📈',
    bearish_harami: '🤰📉',
    piercing_line: '⚡📈',
    dark_cloud_cover: '☁️📉',
    tweezer_tops: '🔺🔺',
    tweezer_bottoms: '🔻🔻',
  };
  return emojiMap[type] || '📊';
};
