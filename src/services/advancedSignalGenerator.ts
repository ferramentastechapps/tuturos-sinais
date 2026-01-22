// Advanced Signal Generator with Multiple Confirmations

import { TechnicalIndicator } from '@/types/trading';
import { TradeSignal } from '@/types/trading';
import { detectPatterns, CandlestickPattern } from '@/utils/candlestickPatterns';
import { OHLCPoint } from '@/services/coingeckoOHLC';

export interface AdvancedSignalInput {
  symbol: string;
  currentPrice: number;
  indicators: TechnicalIndicator[];
  high24h: number;
  low24h: number;
  ohlcData?: OHLCPoint[]; // Candlestick data for pattern detection
  volume24h?: number;
}

export interface SignalQuality {
  score: number; // 0-100
  factors: string[];
  warnings: string[];
}

export interface AdvancedSignal {
  type: 'long' | 'short';
  entry: number;
  takeProfit: number;
  stopLoss: number;
  riskReward: number;
  confidence: number;
  indicators: string[];
  timeframe: string;
  quality: SignalQuality;
  patterns?: string[];
}

// Calculate support and resistance levels
const calculateSupportResistance = (ohlcData: OHLCPoint[]) => {
  if (!ohlcData || ohlcData.length < 20) return { support: [], resistance: [] };

  const highs = ohlcData.map(d => d.high);
  const lows = ohlcData.map(d => d.low);

  // Find local maxima and minima
  const resistance: number[] = [];
  const support: number[] = [];

  for (let i = 2; i < ohlcData.length - 2; i++) {
    // Resistance (local maxima)
    if (
      highs[i] > highs[i - 1] &&
      highs[i] > highs[i - 2] &&
      highs[i] > highs[i + 1] &&
      highs[i] > highs[i + 2]
    ) {
      resistance.push(highs[i]);
    }

    // Support (local minima)
    if (
      lows[i] < lows[i - 1] &&
      lows[i] < lows[i - 2] &&
      lows[i] < lows[i + 1] &&
      lows[i] < lows[i + 2]
    ) {
      support.push(lows[i]);
    }
  }

  // Keep only the 3 most relevant levels
  return {
    support: support.slice(-3).sort((a, b) => b - a),
    resistance: resistance.slice(-3).sort((a, b) => a - b),
  };
};

// Analyze volume trend
const analyzeVolume = (ohlcData: OHLCPoint[], currentVolume: number) => {
  if (!ohlcData || ohlcData.length < 10) return 'neutral';

  const recentVolumes = ohlcData.slice(-10).map(d => d.volume || 0);
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;

  if (currentVolume > avgVolume * 1.5) return 'high';
  if (currentVolume < avgVolume * 0.5) return 'low';
  return 'normal';
};

// Check if price is near support/resistance
const checkPriceLevel = (
  price: number,
  levels: number[],
  tolerance: number = 0.02
): { near: boolean; level?: number } => {
  for (const level of levels) {
    const diff = Math.abs(price - level) / level;
    if (diff < tolerance) {
      return { near: true, level };
    }
  }
  return { near: false };
};

// Calculate trend strength
const calculateTrendStrength = (indicators: TechnicalIndicator[]): number => {
  const ema20 = indicators.find(i => i.name === 'EMA 20');
  const ema50 = indicators.find(i => i.name === 'EMA 50');
  const ema200 = indicators.find(i => i.name === 'EMA 200');

  if (!ema20 || !ema50 || !ema200) return 0;

  let strength = 0;

  // Check EMA alignment
  if (ema20.value > ema50.value && ema50.value > ema200.value) {
    strength += 30; // Strong uptrend
  } else if (ema20.value < ema50.value && ema50.value < ema200.value) {
    strength -= 30; // Strong downtrend
  }

  // Check EMA spacing
  const spacing20_50 = Math.abs(ema20.value - ema50.value) / ema50.value;
  const spacing50_200 = Math.abs(ema50.value - ema200.value) / ema200.value;

  if (spacing20_50 > 0.02 && spacing50_200 > 0.05) {
    strength += 20; // Good spacing indicates strong trend
  }

  return strength;
};

// Analyze candlestick patterns
const analyzeCandlestickPatterns = (
  ohlcData: OHLCPoint[],
  signalType: 'long' | 'short'
): { patterns: CandlestickPattern[]; score: number } => {
  if (!ohlcData || ohlcData.length < 3) {
    return { patterns: [], score: 0 };
  }

  const allPatterns = detectPatterns(ohlcData);
  
  // Get recent patterns (last 5 candles)
  const recentPatterns = allPatterns.filter(
    p => p.index >= ohlcData.length - 5
  );

  // Filter patterns matching signal type
  const matchingPatterns = recentPatterns.filter(
    p => p.signal === (signalType === 'long' ? 'bullish' : 'bearish')
  );

  // Calculate score based on pattern strength
  let score = 0;
  const strongPatterns = [
    'bullish_engulfing',
    'bearish_engulfing',
    'morning_star',
    'evening_star',
    'three_white_soldiers',
    'three_black_crows',
  ];

  for (const pattern of matchingPatterns) {
    if (strongPatterns.includes(pattern.type)) {
      score += 15;
    } else {
      score += 8;
    }
  }

  return { patterns: matchingPatterns, score: Math.min(score, 30) };
};

// Main advanced signal generator
export const generateAdvancedSignal = (
  input: AdvancedSignalInput
): AdvancedSignal | null => {
  const { currentPrice, indicators, high24h, low24h, ohlcData, volume24h } = input;

  // Count bullish and bearish signals
  const bullishCount = indicators.filter(i => i.signal === 'bullish').length;
  const bearishCount = indicators.filter(i => i.signal === 'bearish').length;
  const totalSignals = indicators.length;

  const bullishPercent = (bullishCount / totalSignals) * 100;
  const bearishPercent = (bearishCount / totalSignals) * 100;

  // Get specific indicators
  const rsi = indicators.find(i => i.name.includes('RSI'));
  const macd = indicators.find(i => i.name === 'MACD');
  const ema20 = indicators.find(i => i.name === 'EMA 20');
  const ema50 = indicators.find(i => i.name === 'EMA 50');
  const ema200 = indicators.find(i => i.name === 'EMA 200');
  const vwap = indicators.find(i => i.name === 'VWAP');

  // Calculate support/resistance
  const levels = ohlcData ? calculateSupportResistance(ohlcData) : { support: [], resistance: [] };

  // Analyze volume
  const volumeAnalysis = ohlcData && volume24h ? analyzeVolume(ohlcData, volume24h) : 'normal';

  // Calculate trend strength
  const trendStrength = calculateTrendStrength(indicators);

  // LONG Signal Logic
  if (bullishPercent >= 55) {
    const reasons: string[] = [];
    const qualityFactors: string[] = [];
    const warnings: string[] = [];
    let confidence = bullishPercent;
    let qualityScore = 50;

    // RSI Analysis
    if (rsi) {
      if (rsi.value < 30) {
        reasons.push('RSI Oversold (<30)');
        qualityFactors.push('RSI extremamente oversold');
        confidence += 10;
        qualityScore += 15;
      } else if (rsi.value < 40) {
        reasons.push('RSI Oversold');
        qualityFactors.push('RSI oversold');
        confidence += 5;
        qualityScore += 8;
      } else if (rsi.value > 70) {
        warnings.push('RSI overbought - possível correção');
        qualityScore -= 10;
      }
    }

    // MACD Analysis
    if (macd && macd.signal === 'bullish') {
      reasons.push('MACD Bullish Cross');
      qualityFactors.push('MACD cruzou para cima');
      confidence += 8;
      qualityScore += 12;
    }

    // EMA Analysis
    if (ema20 && ema50 && ema200) {
      if (currentPrice > ema20.value && currentPrice > ema50.value && currentPrice > ema200.value) {
        reasons.push('Preço acima de todas EMAs');
        qualityFactors.push('Tendência de alta confirmada');
        confidence += 10;
        qualityScore += 15;
      } else if (currentPrice > ema20.value) {
        reasons.push('Preço acima EMA 20');
        qualityScore += 5;
      }

      // Check for golden cross
      if (ema50.value > ema200.value && ema20.value > ema50.value) {
        qualityFactors.push('Golden Cross presente');
        qualityScore += 10;
      }
    }

    // VWAP Analysis
    if (vwap && currentPrice > vwap.value) {
      reasons.push('Preço acima VWAP');
      qualityScore += 5;
    }

    // Support/Resistance Analysis
    const nearSupport = checkPriceLevel(currentPrice, levels.support);
    const nearResistance = checkPriceLevel(currentPrice, levels.resistance);

    if (nearSupport.near) {
      qualityFactors.push(`Próximo ao suporte em $${nearSupport.level?.toFixed(2)}`);
      qualityScore += 12;
    }

    if (nearResistance.near) {
      warnings.push(`Próximo à resistência em $${nearResistance.level?.toFixed(2)}`);
      qualityScore -= 8;
    }

    // Volume Analysis
    if (volumeAnalysis === 'high') {
      qualityFactors.push('Volume acima da média (+50%)');
      qualityScore += 10;
    } else if (volumeAnalysis === 'low') {
      warnings.push('Volume baixo - sinal fraco');
      qualityScore -= 10;
    }

    // Trend Strength
    if (trendStrength > 30) {
      qualityFactors.push('Tendência de alta forte');
      qualityScore += 10;
    } else if (trendStrength < 0) {
      warnings.push('Tendência de baixa presente');
      qualityScore -= 15;
    }

    // Candlestick Patterns
    const patternAnalysis = ohlcData ? analyzeCandlestickPatterns(ohlcData, 'long') : { patterns: [], score: 0 };
    if (patternAnalysis.score > 0) {
      const patternNames = patternAnalysis.patterns.map(p => p.name);
      reasons.push(...patternNames);
      qualityFactors.push(`Padrões bullish: ${patternNames.join(', ')}`);
      qualityScore += patternAnalysis.score;
    }

    // Minimum quality threshold
    if (qualityScore < 40) {
      warnings.push('Qualidade do sinal abaixo do ideal');
    }

    // Calculate entry, TP, and SL
    const entry = currentPrice;
    const atr = (high24h - low24h) * 0.5;
    
    // Use nearest support for SL if available
    const stopLoss = nearSupport.near && nearSupport.level 
      ? nearSupport.level * 0.995 
      : entry - (atr * 1.5);
    
    // Use nearest resistance for TP if available
    const takeProfit = nearResistance.near && nearResistance.level
      ? nearResistance.level * 0.995
      : entry + (atr * 3);
    
    const riskReward = (takeProfit - entry) / (entry - stopLoss);

    // Adjust confidence based on quality
    confidence = Math.min(confidence + (qualityScore - 50) / 5, 95);

    return {
      type: 'long',
      entry: parseFloat(entry.toFixed(2)),
      takeProfit: parseFloat(takeProfit.toFixed(2)),
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      riskReward: parseFloat(riskReward.toFixed(2)),
      confidence: Math.max(Math.min(Math.round(confidence), 95), 60),
      indicators: reasons,
      timeframe: '4H',
      quality: {
        score: Math.max(Math.min(Math.round(qualityScore), 100), 0),
        factors: qualityFactors,
        warnings,
      },
      patterns: patternAnalysis.patterns.map(p => p.name),
    };
  }

  // SHORT Signal Logic
  if (bearishPercent >= 55) {
    const reasons: string[] = [];
    const qualityFactors: string[] = [];
    const warnings: string[] = [];
    let confidence = bearishPercent;
    let qualityScore = 50;

    // RSI Analysis
    if (rsi) {
      if (rsi.value > 70) {
        reasons.push('RSI Overbought (>70)');
        qualityFactors.push('RSI extremamente overbought');
        confidence += 10;
        qualityScore += 15;
      } else if (rsi.value > 60) {
        reasons.push('RSI Overbought');
        qualityFactors.push('RSI overbought');
        confidence += 5;
        qualityScore += 8;
      } else if (rsi.value < 30) {
        warnings.push('RSI oversold - possível recuperação');
        qualityScore -= 10;
      }
    }

    // MACD Analysis
    if (macd && macd.signal === 'bearish') {
      reasons.push('MACD Bearish Cross');
      qualityFactors.push('MACD cruzou para baixo');
      confidence += 8;
      qualityScore += 12;
    }

    // EMA Analysis
    if (ema20 && ema50 && ema200) {
      if (currentPrice < ema20.value && currentPrice < ema50.value && currentPrice < ema200.value) {
        reasons.push('Preço abaixo de todas EMAs');
        qualityFactors.push('Tendência de baixa confirmada');
        confidence += 10;
        qualityScore += 15;
      } else if (currentPrice < ema20.value) {
        reasons.push('Preço abaixo EMA 20');
        qualityScore += 5;
      }

      // Check for death cross
      if (ema50.value < ema200.value && ema20.value < ema50.value) {
        qualityFactors.push('Death Cross presente');
        qualityScore += 10;
      }
    }

    // VWAP Analysis
    if (vwap && currentPrice < vwap.value) {
      reasons.push('Preço abaixo VWAP');
      qualityScore += 5;
    }

    // Support/Resistance Analysis
    const nearSupport = checkPriceLevel(currentPrice, levels.support);
    const nearResistance = checkPriceLevel(currentPrice, levels.resistance);

    if (nearResistance.near) {
      qualityFactors.push(`Próximo à resistência em $${nearResistance.level?.toFixed(2)}`);
      qualityScore += 12;
    }

    if (nearSupport.near) {
      warnings.push(`Próximo ao suporte em $${nearSupport.level?.toFixed(2)}`);
      qualityScore -= 8;
    }

    // Volume Analysis
    if (volumeAnalysis === 'high') {
      qualityFactors.push('Volume acima da média (+50%)');
      qualityScore += 10;
    } else if (volumeAnalysis === 'low') {
      warnings.push('Volume baixo - sinal fraco');
      qualityScore -= 10;
    }

    // Trend Strength
    if (trendStrength < -30) {
      qualityFactors.push('Tendência de baixa forte');
      qualityScore += 10;
    } else if (trendStrength > 0) {
      warnings.push('Tendência de alta presente');
      qualityScore -= 15;
    }

    // Candlestick Patterns
    const patternAnalysis = ohlcData ? analyzeCandlestickPatterns(ohlcData, 'short') : { patterns: [], score: 0 };
    if (patternAnalysis.score > 0) {
      const patternNames = patternAnalysis.patterns.map(p => p.name);
      reasons.push(...patternNames);
      qualityFactors.push(`Padrões bearish: ${patternNames.join(', ')}`);
      qualityScore += patternAnalysis.score;
    }

    // Minimum quality threshold
    if (qualityScore < 40) {
      warnings.push('Qualidade do sinal abaixo do ideal');
    }

    // Calculate entry, TP, and SL
    const entry = currentPrice;
    const atr = (high24h - low24h) * 0.5;
    
    // Use nearest resistance for SL if available
    const stopLoss = nearResistance.near && nearResistance.level
      ? nearResistance.level * 1.005
      : entry + (atr * 1.5);
    
    // Use nearest support for TP if available
    const takeProfit = nearSupport.near && nearSupport.level
      ? nearSupport.level * 1.005
      : entry - (atr * 3);
    
    const riskReward = (entry - takeProfit) / (stopLoss - entry);

    // Adjust confidence based on quality
    confidence = Math.min(confidence + (qualityScore - 50) / 5, 95);

    return {
      type: 'short',
      entry: parseFloat(entry.toFixed(2)),
      takeProfit: parseFloat(takeProfit.toFixed(2)),
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      riskReward: parseFloat(riskReward.toFixed(2)),
      confidence: Math.max(Math.min(Math.round(confidence), 95), 60),
      indicators: reasons,
      timeframe: '4H',
      quality: {
        score: Math.max(Math.min(Math.round(qualityScore), 100), 0),
        factors: qualityFactors,
        warnings,
      },
      patterns: patternAnalysis.patterns.map(p => p.name),
    };
  }

  return null;
};
