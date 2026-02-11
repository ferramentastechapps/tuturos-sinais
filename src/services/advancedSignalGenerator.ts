// Advanced Signal Generator with Multiple Confirmations

import { TechnicalIndicator } from '@/types/trading';
import { TradeSignal } from '@/types/trading';
import { detectPatterns, CandlestickPattern } from '@/utils/candlestickPatterns';
import { OHLCPoint } from '@/services/coingeckoOHLC';
import { analyzeMarketStructure, type MarketStructureResult } from '@/utils/marketStructure';
import { analyzeSmartMoney, type SmartMoneyResult } from '@/utils/smartMoney';
import { calculateVolumeProfile, getPricePositionInProfile, type VolumeProfileResult } from '@/utils/volumeProfile';
import { analyzeCVD, type CVDResult } from '@/utils/cvd';
import { type FuturesOverview } from '@/services/binanceFutures';
import { detectAllDivergences, type Divergence } from '@/utils/divergenceDetector';
import { analyzeBollingerBands, type BollingerAnalysisResult } from '@/utils/bollingerAnalysis';
import { calculateRSI, calculateMACD, calculateEMA, calculateStochasticRSI, detectEMACrossovers, type IndicatorPoint, type PricePoint, calculateATRFromOHLC, calculateADXFromOHLC } from '@/utils/technicalIndicators';

// Risk Integration
import { riskConfigManager } from '@/services/riskConfigManager';
import { adjustRiskForMarketConditions, MarketConditions, calculateIntradayVolatility, calculateMaxCandlePercent } from '@/services/dynamicRiskAdjuster';
import { AdjustedRiskConfig } from '@/types/riskProfiles';

export interface AdvancedSignalInput {
  symbol: string;
  currentPrice: number;
  indicators: TechnicalIndicator[];
  high24h: number;
  low24h: number;
  ohlcData?: OHLCPoint[];
  volume24h?: number;
  futuresData?: FuturesOverview; // Dados de futuros (Binance)
  change24h?: number; // Needed for risk calculation
}

export interface SmartMoneyContext {
  marketStructure?: MarketStructureResult;
  smartMoney?: SmartMoneyResult;
  volumeProfile?: VolumeProfileResult;
  cvd?: CVDResult;
  divergences?: Divergence[];
  bollingerAnalysis?: BollingerAnalysisResult;
}

export interface SignalQuality {
  score: number; // 0-100
  factors: string[];
  warnings: string[];
}

import { predictSignal } from './ml/mlPredictionService';
import { extractFeatures } from './ml/featureExtractor';

// ... imports ...

export interface SignalRiskData {
  score: number;             // Score de risco (0-100, onde 100 é seguro)
  leverage: number;          // Alavancagem ajustada
  positionSizePercent: number; // Tamanho sugerido da posição
  riskPerTradePercent: number; // Risco máximo por trade
  stopLossPercent: number;   // Distância do stop em %
  adjustments: string[];     // Lista de ajustes feitos (ex: "Reduzido por alta vol")
  isBlocked: boolean;        // Se o trade deve ser bloqueado
  blockReason?: string;
}

export interface AdvancedSignal {
  type: 'long' | 'short';
  entry: number;
  takeProfit: number;
  takeProfit1?: number;
  takeProfit2?: number;
  takeProfit3?: number;
  stopLoss: number;
  riskReward: number;
  confidence: number;
  indicators: string[];
  timeframe: string;
  quality: SignalQuality;
  patterns?: string[];
  smartMoney?: SmartMoneyContext;
  riskData?: SignalRiskData; // Dados detalhados de risco
  mlData?: {
    probability: number;
    predictedClass: 0 | 1;
    confidence: number;
    isFiltered: boolean;
  };
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

// Helper: Extract or Calculate Market Conditions
const extractMarketConditions = (input: AdvancedSignalInput): MarketConditions => {
  const { symbol, indicators, ohlcData, high24h, low24h, futuresData, change24h } = input as any;

  // ATR
  let currentATR = 0;
  let averageATR = 0;
  const atrIndicator = indicators.find(i => i.name === 'ATR');
  if (atrIndicator) {
    currentATR = atrIndicator.value;
    averageATR = atrIndicator.value; // Fallback se não tiver histórico
  } else if (ohlcData && ohlcData.length > 14) {
    const atrResults = calculateATRFromOHLC(ohlcData, 14);
    if (atrResults.length > 0) {
      currentATR = atrResults[atrResults.length - 1].atr;
      // Média dos últimos 14 ATRs
      const sum = atrResults.slice(-14).reduce((a, b) => a + b.atr, 0);
      averageATR = sum / Math.min(atrResults.length, 14);
    }
  }

  // ADX
  let adxValue = 0;
  const adxIndicator = indicators.find(i => i.name === 'ADX');
  if (adxIndicator) {
    adxValue = adxIndicator.value;
  } else if (ohlcData && ohlcData.length > 14) {
    const adxResults = calculateADXFromOHLC(ohlcData, 14);
    if (adxResults.length > 0) {
      adxValue = adxResults[adxResults.length - 1].adx;
    }
  }

  // F&G
  const fearGreedIndex = 50; // Fallback

  // Volatility
  const intradayVolatility = calculateIntradayVolatility(high24h, low24h);
  const maxCandlePercent1h = ohlcData ? calculateMaxCandlePercent(ohlcData.slice(-12)) : 0;

  return {
    symbol,
    currentATR,
    averageATR,
    intradayVolatility,
    fundingRate: futuresData?.fundingRate?.rate || 0,
    oiChange24h: 0,
    priceChange24h: change24h || 0,
    fearGreedIndex,
    adxValue,
    maxCandlePercent1h,
  };
};

// Main advanced signal generator
export const generateAdvancedSignal = (
  input: AdvancedSignalInput
): AdvancedSignal | null => {
  const { currentPrice, indicators, high24h, low24h, ohlcData, volume24h, futuresData } = input;

  // 1. Get Base Risk Config & Market Conditions & Adjusted Risk
  const baseConfig = riskConfigManager.getConfig(input.symbol);
  const marketConditions = extractMarketConditions(input);
  const adjustedRisk = adjustRiskForMarketConditions(baseConfig, marketConditions);

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

  // ──── Tier 1: Market Structure & Smart Money ────
  let smartMoneyCtx: SmartMoneyContext = {};

  if (ohlcData && ohlcData.length >= 20) {
    smartMoneyCtx.marketStructure = analyzeMarketStructure(ohlcData, 3);
    smartMoneyCtx.smartMoney = analyzeSmartMoney(ohlcData);
    smartMoneyCtx.volumeProfile = calculateVolumeProfile(ohlcData, 24, 70);
    smartMoneyCtx.cvd = analyzeCVD(ohlcData);

    // ──── Tier 2: Divergências, Bollinger, Stochastic RSI, EMA Crosses ────
    const pricePoints: PricePoint[] = ohlcData.map(d => ({ timestamp: d.timestamp, price: d.close }));
    const rsiValues = calculateRSI(pricePoints, 14);
    const macdResult = calculateMACD(pricePoints);
    const macdHistogram: IndicatorPoint[] = macdResult.map(m => ({ timestamp: m.timestamp, value: m.histogram }));
    smartMoneyCtx.divergences = detectAllDivergences(ohlcData, rsiValues, macdHistogram);

    const bbPeriod = 20;
    const bbUpper: IndicatorPoint[] = [];
    const bbMiddle: IndicatorPoint[] = [];
    const bbLower: IndicatorPoint[] = [];
    for (let i = bbPeriod - 1; i < pricePoints.length; i++) {
      const slice = pricePoints.slice(i - bbPeriod + 1, i + 1);
      const mean = slice.reduce((s, p) => s + p.price, 0) / bbPeriod;
      const variance = slice.reduce((s, p) => s + Math.pow(p.price - mean, 2), 0) / bbPeriod;
      const stdDev = Math.sqrt(variance);
      bbUpper.push({ timestamp: pricePoints[i].timestamp, value: mean + 2 * stdDev });
      bbMiddle.push({ timestamp: pricePoints[i].timestamp, value: mean });
      bbLower.push({ timestamp: pricePoints[i].timestamp, value: mean - 2 * stdDev });
    }
    const bbPrices = pricePoints.slice(bbPeriod - 1);
    smartMoneyCtx.bollingerAnalysis = analyzeBollingerBands(bbPrices, bbUpper, bbMiddle, bbLower);
  }

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
        reasons.push('Preço abaixo de todas EMAs');
        qualityFactors.push('Tendência de alta confirmada');
        confidence += 10;
        qualityScore += 15;
      } else if (currentPrice > ema20.value) {
        reasons.push('Preço abaixo EMA 20');
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

    // ──── Tier 1: Market Structure ────
    if (smartMoneyCtx.marketStructure) {
      const ms = smartMoneyCtx.marketStructure;
      if (ms.currentTrend === 'bullish') {
        qualityFactors.push(`Estrutura de mercado bullish (${ms.lastStructure || 'N/A'})`);
        qualityScore += 12;
      } else if (ms.currentTrend === 'bearish') {
        warnings.push('Estrutura de mercado bearish');
        qualityScore -= 10;
      }

      // BOS/CHOCH recentes
      const recentBreaks = ms.structureBreaks.slice(-3);
      for (const brk of recentBreaks) {
        if (brk.type === 'BOS' && brk.direction === 'bullish') {
          qualityFactors.push(brk.description);
          qualityScore += 15;
        } else if (brk.type === 'CHOCH' && brk.direction === 'bullish') {
          qualityFactors.push(brk.description);
          qualityScore += 18;
          confidence += 5;
        } else if (brk.direction === 'bearish') {
          warnings.push(brk.description);
          qualityScore -= 8;
        }
      }
    }

    // ──── Tier 1: Smart Money (OB, FVG, Liquidity) ────
    if (smartMoneyCtx.smartMoney) {
      const sm = smartMoneyCtx.smartMoney;

      // Order Blocks bullish não mitigados perto do preço
      const nearbyBullishOBs = sm.orderBlocks.filter(
        ob => ob.type === 'bullish' && !ob.mitigated &&
          currentPrice >= ob.bottom * 0.98 && currentPrice <= ob.top * 1.02
      );
      if (nearbyBullishOBs.length > 0) {
        qualityFactors.push(`Preço em Order Block Bullish ($${nearbyBullishOBs[0].bottom.toFixed(2)})`);
        qualityScore += 12;
      }

      // FVGs bullish não preenchidos abaixo do preço (suporte)
      const openBullishFVGs = sm.fairValueGaps.filter(
        fvg => fvg.type === 'bullish' && !fvg.filled && currentPrice > fvg.top
      );
      if (openBullishFVGs.length > 0) {
        qualityFactors.push(`${openBullishFVGs.length} FVG(s) bullish abaixo (suporte)`);
        qualityScore += 8;
      }

      // Zonas de liquidez
      const sellSideLiq = sm.liquidityZones.filter(
        lz => lz.direction === 'sell_side' && !lz.swept && lz.price < currentPrice
      );
      if (sellSideLiq.length > 0) {
        warnings.push(`${sellSideLiq.length} zona(s) de liquidez sell-side abaixo`);
        qualityScore -= 5;
      }

      const sweptBuySide = sm.liquidityZones.filter(
        lz => lz.type === 'stop_hunt_low' && lz.swept
      );
      if (sweptBuySide.length > 0) {
        qualityFactors.push('Stop hunt de lows detectado — possível reversão bullish');
        qualityScore += 10;
      }
    }

    // ──── Tier 1: Volume Profile ────
    if (smartMoneyCtx.volumeProfile && smartMoneyCtx.volumeProfile.poc > 0) {
      const vpPos = getPricePositionInProfile(currentPrice, smartMoneyCtx.volumeProfile);
      if (vpPos.signal === 'bullish') {
        qualityFactors.push(vpPos.description);
        qualityScore += 8;
      } else if (vpPos.position === 'below_val') {
        qualityFactors.push(`Preço abaixo do VAL — possível retorno ao valor`);
        qualityScore += 5; // Pode ser suporte para long
      }
    }

    // ──── Tier 1: CVD ────
    if (smartMoneyCtx.cvd) {
      const cvd = smartMoneyCtx.cvd;
      if (cvd.currentTrend === 'accumulation') {
        qualityFactors.push(`CVD: Acumulação detectada (momentum: +${cvd.momentum})`);
        qualityScore += 10;
      } else if (cvd.currentTrend === 'distribution') {
        warnings.push(`CVD: Distribuição detectada (momentum: ${cvd.momentum})`);
        qualityScore -= 10;
      }

      // Divergências CVD
      const recentBullishDiv = cvd.divergences.filter(d => d.type === 'bullish').slice(-1);
      if (recentBullishDiv.length > 0) {
        qualityFactors.push(recentBullishDiv[0].description);
        qualityScore += 12;
        confidence += 3;
      }
    }

    // ──── Tier 1: Dados de Futuros ────
    if (futuresData) {
      // Funding Rate
      if (futuresData.fundingRate.direction === 'bullish') {
        qualityFactors.push(futuresData.fundingRate.description);
        qualityScore += 10;
      } else if (futuresData.fundingRate.isExtreme && futuresData.fundingRate.direction === 'bearish') {
        warnings.push(futuresData.fundingRate.description);
        qualityScore -= 5;
      }

      // OI Divergência
      if (futuresData.oiDivergence) {
        if (futuresData.oiDivergence.type === 'bullish') {
          qualityFactors.push(futuresData.oiDivergence.description);
          qualityScore += 10;
        } else {
          warnings.push(futuresData.oiDivergence.description);
          qualityScore -= 8;
        }
      }

      // Liquidações
      if (futuresData.liquidations.dominantSide === 'longs') {
        warnings.push('Liquidações dominadas por longs — cuidado');
        qualityScore -= 5;
      }
    }

    // ──── Tier 2: Divergências, Bollinger, StochRSI ────
    if (smartMoneyCtx.divergences) {
      const bullishDivs = smartMoneyCtx.divergences.filter(d => d.type === 'bullish');
      if (bullishDivs.length > 0) {
        const div = bullishDivs[bullishDivs.length - 1]; // Mais recente
        qualityFactors.push(div.description);
        qualityScore += div.kind === 'regular' ? 15 : 8;
        confidence += 5;
      }

      const bearishDivs = smartMoneyCtx.divergences.filter(d => d.type === 'bearish');
      if (bearishDivs.length > 0) {
        warnings.push('Divergência Bearish detectada - cuidado');
        qualityScore -= 10;
      }
    }

    if (smartMoneyCtx.bollingerAnalysis && smartMoneyCtx.bollingerAnalysis.currentState) {
      const bbState = smartMoneyCtx.bollingerAnalysis.currentState;
      if (bbState.squeeze) {
        qualityFactors.push('Bollinger Squeeze - Alta volatilidade iminente');
        qualityScore += 5; // Contexto de breakout
      } else if (bbState.expansion && bbState.percentB > 0.8) {
        qualityFactors.push('Bollinger Expansão Bullish');
        qualityScore += 10;
      }
    }

    // Minimum quality threshold
    if (qualityScore < 40) {
      warnings.push('Qualidade do sinal abaixo do ideal');
    }

    // ──── INTEGRATED RISK CALCULATION ────
    const entry = currentPrice;

    // Determine basic stop loss distance (ATR driven)
    const slDistPercent = adjustedRisk.stopLoss.min; // Already adjusted by volatility
    const slDist = entry * (slDistPercent / 100);

    // If near support and support is within allowable range, prefer support
    let stopLoss = entry - slDist;

    if (nearSupport.near && nearSupport.level) {
      const supportSl = nearSupport.level * 0.995;
      const supportDist = entry - supportSl;
      const supportDistPercent = (supportDist / entry) * 100;

      // Check if support SL is within allowed range (min/max)
      if (supportDistPercent >= adjustedRisk.stopLoss.min && supportDistPercent <= adjustedRisk.stopLoss.max) {
        stopLoss = supportSl;
        qualityFactors.push(`Stop Loss ajustado por suporte: $${stopLoss.toFixed(2)}`);
      } else if (supportDistPercent < adjustedRisk.stopLoss.min) {
        // Support too close, use min distance
        stopLoss = entry * (1 - (adjustedRisk.stopLoss.min / 100));
        warnings.push(`Suporte muito próximo, usando SL mínimo de ${adjustedRisk.stopLoss.min}%`);
      } else {
        // Support too far
        if (supportDistPercent > adjustedRisk.stopLoss.max) {
          stopLoss = entry * (1 - (adjustedRisk.stopLoss.max / 100));
          warnings.push(`Suporte muito longe, limitado pelo SL máximo de ${adjustedRisk.stopLoss.max}%`);
        } else {
          stopLoss = supportSl;
        }
      }
    }

    const risk = Math.abs(entry - stopLoss);

    // Calculate Targets based on Config
    const tp1Config = adjustedRisk.takeProfit.tp1.percent;
    const tp2Config = adjustedRisk.takeProfit.tp2.percent;
    const tp3Config = adjustedRisk.takeProfit.tp3.percent;

    // Use percentage from entry
    const tp1 = entry * (1 + (tp1Config / 100));
    const tp2 = entry * (1 + (tp2Config / 100));
    const tp3 = entry * (1 + (tp3Config / 100));

    // Filter weak signals by R:R using TP2 as main target
    const riskReward = (tp2 - entry) / (entry - stopLoss);

    if (riskReward < adjustedRisk.position.minRiskReward) {
      warnings.push(`Risco/Retorno ${riskReward.toFixed(2)} abaixo do mínimo (${adjustedRisk.position.minRiskReward})`);
      qualityScore -= 10;
    }

    // Adjust confidence based on quality
    confidence = Math.min(confidence + (qualityScore - 50) / 5, 95);

    // Build Risk Data Object
    const riskData: SignalRiskData = {
      score: 100 - (adjustedRisk.adjustments.length * 10), // Base score
      leverage: adjustedRisk.leverage.suggested,
      positionSizePercent: adjustedRisk.position.maxPositionPercent,
      riskPerTradePercent: adjustedRisk.position.maxRiskPercent,
      stopLossPercent: ((entry - stopLoss) / entry) * 100,
      adjustments: adjustedRisk.adjustments.map(a => a.reason),
      isBlocked: adjustedRisk.isBlocked,
      blockReason: adjustedRisk.blockReasons.join(', '),
    };

    if (adjustedRisk.isBlocked) {
      warnings.push(`Sinal bloqueado pelo gerenciador de risco: ${adjustedRisk.blockReasons.join(', ')}`);
      qualityScore = 0; // Invalidate signal quality if blocked
      confidence = 0;
    }

    return {
      type: 'long',
      entry: parseFloat(entry.toFixed(2)),
      takeProfit: parseFloat(tp2.toFixed(2)), // Main target
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
      smartMoney: smartMoneyCtx,
      riskData,
      takeProfit1: parseFloat(tp1.toFixed(2)),
      takeProfit2: parseFloat(tp2.toFixed(2)),
      takeProfit3: parseFloat(tp3.toFixed(2)),
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

    // ──── Tier 1: Market Structure ────
    if (smartMoneyCtx.marketStructure) {
      const ms = smartMoneyCtx.marketStructure;
      if (ms.currentTrend === 'bearish') {
        qualityFactors.push(`Estrutura de mercado bearish (${ms.lastStructure || 'N/A'})`);
        qualityScore += 12;
      } else if (ms.currentTrend === 'bullish') {
        warnings.push('Estrutura de mercado bullish');
        qualityScore -= 10;
      }

      // BOS/CHOCH recentes
      const recentBreaks = ms.structureBreaks.slice(-3);
      for (const brk of recentBreaks) {
        if (brk.type === 'BOS' && brk.direction === 'bearish') {
          qualityFactors.push(brk.description);
          qualityScore += 15;
        } else if (brk.type === 'CHOCH' && brk.direction === 'bearish') {
          qualityFactors.push(brk.description);
          qualityScore += 18;
          confidence += 5;
        } else if (brk.direction === 'bullish') {
          warnings.push(brk.description);
          qualityScore -= 8;
        }
      }
    }

    // ──── Tier 1: Smart Money (OB, FVG, Liquidity) ────
    if (smartMoneyCtx.smartMoney) {
      const sm = smartMoneyCtx.smartMoney;

      const nearbyBearishOBs = sm.orderBlocks.filter(
        ob => ob.type === 'bearish' && !ob.mitigated &&
          currentPrice >= ob.bottom * 0.98 && currentPrice <= ob.top * 1.02
      );
      if (nearbyBearishOBs.length > 0) {
        qualityFactors.push(`Preço em Order Block Bearish ($${nearbyBearishOBs[0].top.toFixed(2)})`);
        qualityScore += 12;
      }

      const openBearishFVGs = sm.fairValueGaps.filter(
        fvg => fvg.type === 'bearish' && !fvg.filled && currentPrice < fvg.bottom
      );
      if (openBearishFVGs.length > 0) {
        qualityFactors.push(`${openBearishFVGs.length} FVG(s) bearish acima (resistência)`);
        qualityScore += 8;
      }

      const buySideLiq = sm.liquidityZones.filter(
        lz => lz.direction === 'buy_side' && !lz.swept && lz.price > currentPrice
      );
      if (buySideLiq.length > 0) {
        warnings.push(`${buySideLiq.length} zona(s) de liquidez buy-side acima`);
        qualityScore -= 5;
      }

      const sweptSellSide = sm.liquidityZones.filter(
        lz => lz.type === 'stop_hunt_high' && lz.swept
      );
      if (sweptSellSide.length > 0) {
        qualityFactors.push('Stop hunt de highs detectado — possível reversão bearish');
        qualityScore += 10;
      }
    }

    // ──── Tier 1: Volume Profile ────
    if (smartMoneyCtx.volumeProfile && smartMoneyCtx.volumeProfile.poc > 0) {
      const vpPos = getPricePositionInProfile(currentPrice, smartMoneyCtx.volumeProfile);
      if (vpPos.signal === 'bearish') {
        qualityFactors.push(vpPos.description);
        qualityScore += 8;
      } else if (vpPos.position === 'above_vah') {
        qualityFactors.push(`Preço acima do VAH — possível retorno ao valor`);
        qualityScore += 5;
      }
    }

    // ──── Tier 1: CVD ────
    if (smartMoneyCtx.cvd) {
      const cvd = smartMoneyCtx.cvd;
      if (cvd.currentTrend === 'distribution') {
        qualityFactors.push(`CVD: Distribuição detectada (momentum: ${cvd.momentum})`);
        qualityScore += 10;
      } else if (cvd.currentTrend === 'accumulation') {
        warnings.push(`CVD: Acumulação detectada (momentum: +${cvd.momentum})`);
        qualityScore -= 10;
      }

      const recentBearishDiv = cvd.divergences.filter(d => d.type === 'bearish').slice(-1);
      if (recentBearishDiv.length > 0) {
        qualityFactors.push(recentBearishDiv[0].description);
        qualityScore += 12;
        confidence += 3;
      }
    }

    // ──── Tier 1: Dados de Futuros ────
    if (futuresData) {
      if (futuresData.fundingRate.direction === 'bearish') {
        qualityFactors.push(futuresData.fundingRate.description);
        qualityScore += 10;
      } else if (futuresData.fundingRate.isExtreme && futuresData.fundingRate.direction === 'bullish') {
        warnings.push(futuresData.fundingRate.description);
        qualityScore -= 5;
      }

      if (futuresData.oiDivergence) {
        if (futuresData.oiDivergence.type === 'bearish') {
          qualityFactors.push(futuresData.oiDivergence.description);
          qualityScore += 10;
        } else {
          warnings.push(futuresData.oiDivergence.description);
          qualityScore -= 8;
        }
      }

      // Liquidações
      if (futuresData.liquidations.dominantSide === 'shorts') {
        warnings.push('Liquidações dominadas por shorts — cuidado');
        qualityScore -= 5;
      }
    }

    // ──── Tier 2: Divergências, Bollinger, StochRSI ────
    if (smartMoneyCtx.divergences) {
      const bearishDivs = smartMoneyCtx.divergences.filter(d => d.type === 'bearish');
      if (bearishDivs.length > 0) {
        const div = bearishDivs[bearishDivs.length - 1]; // Mais recente
        qualityFactors.push(div.description);
        qualityScore += div.kind === 'regular' ? 15 : 8;
        confidence += 5;
      }

      const bullishDivs = smartMoneyCtx.divergences.filter(d => d.type === 'bullish');
      if (bullishDivs.length > 0) {
        warnings.push('Divergência Bullish detectada - cuidado');
        qualityScore -= 10;
      }
    }

    if (smartMoneyCtx.bollingerAnalysis && smartMoneyCtx.bollingerAnalysis.currentState) {
      const bbState = smartMoneyCtx.bollingerAnalysis.currentState;
      if (bbState.squeeze) {
        qualityFactors.push('Bollinger Squeeze - Alta volatilidade iminente');
        qualityScore += 5;
      } else if (bbState.expansion && bbState.percentB < 0.2) {
        qualityFactors.push('Bollinger Expansão Bearish');
        qualityScore += 10;
      }
    }

    // Minimum quality threshold
    if (qualityScore < 40) {
      warnings.push('Qualidade do sinal abaixo do ideal');
    }

    // ──── INTEGRATED RISK CALCULATION (SHORT) ────
    const entry = currentPrice;

    // Determine basic stop loss distance (ATR driven)
    const slDistPercent = adjustedRisk.stopLoss.min;
    const slDist = entry * (slDistPercent / 100);

    // If near resistance and resistance is within allowable range, prefer resistance
    let stopLoss = entry + slDist;

    if (nearResistance.near && nearResistance.level) {
      const resistanceSl = nearResistance.level * 1.005;
      const resistanceDist = resistanceSl - entry;
      const resistanceDistPercent = (resistanceDist / entry) * 100;

      if (resistanceDistPercent >= adjustedRisk.stopLoss.min && resistanceDistPercent <= adjustedRisk.stopLoss.max) {
        stopLoss = resistanceSl;
        qualityFactors.push(`Stop Loss ajustado por resistência: $${stopLoss.toFixed(2)}`);
      } else if (resistanceDistPercent < adjustedRisk.stopLoss.min) {
        // Too close
        stopLoss = entry * (1 + (adjustedRisk.stopLoss.min / 100));
        warnings.push(`Resistência muito próxima, usando SL mínimo de ${adjustedRisk.stopLoss.min}%`);
      } else {
        // Too far
        if (resistanceDistPercent > adjustedRisk.stopLoss.max) {
          stopLoss = entry * (1 + (adjustedRisk.stopLoss.max / 100));
          warnings.push(`Resistência muito longe, limitado pelo SL máximo de ${adjustedRisk.stopLoss.max}%`);
        } else {
          stopLoss = resistanceSl;
        }
      }
    }

    const risk = Math.abs(stopLoss - entry);

    // Calculate Targets based on Config
    const tp1Config = adjustedRisk.takeProfit.tp1.percent;
    const tp2Config = adjustedRisk.takeProfit.tp2.percent;
    const tp3Config = adjustedRisk.takeProfit.tp3.percent;

    // Use percentage from entry (Short = Price Down)
    const tp1 = entry * (1 - (tp1Config / 100));
    const tp2 = entry * (1 - (tp2Config / 100));
    const tp3 = entry * (1 - (tp3Config / 100));

    // Filter weak signals by R:R
    const riskReward = (entry - tp2) / (stopLoss - entry);

    if (riskReward < adjustedRisk.position.minRiskReward) {
      warnings.push(`Risco/Retorno ${riskReward.toFixed(2)} abaixo do mínimo (${adjustedRisk.position.minRiskReward})`);
      qualityScore -= 10;
    }

    // Adjust confidence based on quality
    confidence = Math.min(confidence + (qualityScore - 50) / 5, 95);

    // Build Risk Data Object
    const riskData: SignalRiskData = {
      score: 100 - (adjustedRisk.adjustments.length * 10),
      leverage: adjustedRisk.leverage.suggested,
      positionSizePercent: adjustedRisk.position.maxPositionPercent,
      riskPerTradePercent: adjustedRisk.position.maxRiskPercent,
      stopLossPercent: ((stopLoss - entry) / entry) * 100,
      adjustments: adjustedRisk.adjustments.map(a => a.reason),
      isBlocked: adjustedRisk.isBlocked,
      blockReason: adjustedRisk.blockReasons.join(', '),
    };

    if (adjustedRisk.isBlocked) {
      warnings.push(`Sinal bloqueado pelo gerenciador de risco: ${adjustedRisk.blockReasons.join(', ')}`);
      qualityScore = 0;
      confidence = 0;
    }

    return {
      type: 'short',
      entry: parseFloat(entry.toFixed(2)),
      takeProfit: parseFloat(tp2.toFixed(2)), // Main target
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
      smartMoney: smartMoneyCtx,
      riskData,
      takeProfit1: parseFloat(tp1.toFixed(2)),
      takeProfit2: parseFloat(tp2.toFixed(2)),
      takeProfit3: parseFloat(tp3.toFixed(2)),
    };
  }

  return null;
};

// ──── ML Integration ────

export const enrichSignalWithML = async (
  signal: AdvancedSignal,
  input: AdvancedSignalInput
): Promise<AdvancedSignal> => {
  try {
    const features = extractFeatures(signal, input);
    const prediction = await predictSignal(features);

    if (prediction) {
      const isFiltered = prediction.predictedClass === 0 || prediction.probability < 0.6; // Threshold 0.6

      signal.mlData = {
        probability: prediction.probability,
        predictedClass: prediction.predictedClass,
        confidence: prediction.confidence,
        isFiltered,
      };

      // Apply filter to risk data
      if (isFiltered && signal.riskData) {
        signal.riskData.isBlocked = true;
        signal.riskData.blockReason = signal.riskData.blockReason
          ? `${signal.riskData.blockReason}, ML Score Low (${(prediction.probability * 100).toFixed(0)}%)`
          : `ML Score Low (${(prediction.probability * 100).toFixed(0)}%)`;
      }
    }
  } catch (e) {
    console.error('Failed to enrich signal with ML:', e);
  }

  return signal;
};
