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
  | 'three_black_crows';

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
  };
  return emojiMap[type] || '📊';
};
