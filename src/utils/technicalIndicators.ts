// Technical Indicators Calculation Utilities

import { OHLCPoint } from '@/services/coingeckoOHLC';

export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface IndicatorPoint {
  timestamp: number;
  value: number;
}

export interface BollingerBands {
  timestamp: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface MACDResult {
  timestamp: number;
  macd: number;
  signal: number;
  histogram: number;
}

// Simple Moving Average (SMA)
export const calculateSMA = (prices: PricePoint[], period: number): IndicatorPoint[] => {
  const result: IndicatorPoint[] = [];

  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((acc, p) => acc + p.price, 0);
    result.push({
      timestamp: prices[i].timestamp,
      value: sum / period,
    });
  }

  return result;
};

// Exponential Moving Average (EMA)
export const calculateEMA = (prices: PricePoint[], period: number): IndicatorPoint[] => {
  const result: IndicatorPoint[] = [];
  const multiplier = 2 / (period + 1);

  // Start with SMA for the first value
  let ema = prices.slice(0, period).reduce((acc, p) => acc + p.price, 0) / period;

  for (let i = period - 1; i < prices.length; i++) {
    if (i === period - 1) {
      result.push({ timestamp: prices[i].timestamp, value: ema });
    } else {
      ema = (prices[i].price - ema) * multiplier + ema;
      result.push({ timestamp: prices[i].timestamp, value: ema });
    }
  }

  return result;
};

// Relative Strength Index (RSI)
export const calculateRSI = (prices: PricePoint[], period: number = 14): IndicatorPoint[] => {
  const result: IndicatorPoint[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i].price - prices[i - 1].price;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // Calculate initial average gain and loss
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < prices.length; i++) {
    if (i > period) {
      avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    result.push({
      timestamp: prices[i].timestamp,
      value: rsi,
    });
  }

  return result;
};

// MACD (Moving Average Convergence Divergence)
export const calculateMACD = (
  prices: PricePoint[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult[] => {
  const result: MACDResult[] = [];

  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  // Align the EMAs by timestamp
  const macdLine: IndicatorPoint[] = [];

  for (const slow of slowEMA) {
    const fast = fastEMA.find(f => f.timestamp === slow.timestamp);
    if (fast) {
      macdLine.push({
        timestamp: slow.timestamp,
        value: fast.value - slow.value,
      });
    }
  }

  // Calculate Signal Line (EMA of MACD line)
  if (macdLine.length >= signalPeriod) {
    const signalMultiplier = 2 / (signalPeriod + 1);
    let signalEMA = macdLine.slice(0, signalPeriod).reduce((acc, p) => acc + p.value, 0) / signalPeriod;

    for (let i = signalPeriod - 1; i < macdLine.length; i++) {
      if (i > signalPeriod - 1) {
        signalEMA = (macdLine[i].value - signalEMA) * signalMultiplier + signalEMA;
      }

      const macdValue = macdLine[i].value;
      result.push({
        timestamp: macdLine[i].timestamp,
        macd: macdValue,
        signal: signalEMA,
        histogram: macdValue - signalEMA,
      });
    }
  }

  return result;
};

// Bollinger Bands
export const calculateBollingerBands = (
  prices: PricePoint[],
  period: number = 20,
  stdDev: number = 2
): BollingerBands[] => {
  const result: BollingerBands[] = [];
  const sma = calculateSMA(prices, period);

  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const mean = slice.reduce((acc, p) => acc + p.price, 0) / period;
    const squaredDiffs = slice.map(p => Math.pow(p.price - mean, 2));
    const variance = squaredDiffs.reduce((acc, v) => acc + v, 0) / period;
    const standardDeviation = Math.sqrt(variance);

    const middle = sma.find(s => s.timestamp === prices[i].timestamp)?.value || mean;

    result.push({
      timestamp: prices[i].timestamp,
      upper: middle + standardDeviation * stdDev,
      middle,
      lower: middle - standardDeviation * stdDev,
    });
  }

  return result;
};

// VWAP (Volume Weighted Average Price)
export const calculateVWAP = (prices: PricePoint[], volumes?: PricePoint[]): IndicatorPoint[] => {
  const result: IndicatorPoint[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < prices.length; i++) {
    const price = prices[i].price;
    // Use real volume if available and aligned, otherwise simulate
    let volume = 0;

    if (volumes && volumes[i] && volumes[i].timestamp === prices[i].timestamp) {
      volume = volumes[i].price; // PricePoint.price holds volume here
    } else {
      // Fallback simulation
      const priceChange = i > 0 ? Math.abs(prices[i].price - prices[i - 1].price) : 0;
      volume = 1000 + priceChange * 100;
    }

    cumulativeTPV += price * volume;
    cumulativeVolume += volume;

    result.push({
      timestamp: prices[i].timestamp,
      value: cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : price,
    });
  }

  return result;
};

// VWAP from OHLC data — usa volume REAL e preço típico (H+L+C)/3
export interface VWAPWithBands {
  timestamp: number;
  vwap: number;
  upperBand1: number; // +1σ
  lowerBand1: number; // -1σ
  upperBand2: number; // +2σ
  lowerBand2: number; // -2σ
  upperBand3: number; // +3σ
  lowerBand3: number; // -3σ
}

export const calculateVWAPFromOHLC = (data: OHLCPoint[]): VWAPWithBands[] => {
  const result: VWAPWithBands[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  let cumulativeTPV2 = 0; // Para cálculo de desvio padrão

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const volume = candle.volume && candle.volume > 0 ? candle.volume : (candle.high - candle.low) * 1000;

    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;
    cumulativeTPV2 += typicalPrice * typicalPrice * volume;

    const vwap = cumulativeTPV / cumulativeVolume;

    // Desvio padrão ponderado pelo volume
    const variance = (cumulativeTPV2 / cumulativeVolume) - (vwap * vwap);
    const stdDev = Math.sqrt(Math.max(0, variance));

    result.push({
      timestamp: candle.timestamp,
      vwap,
      upperBand1: vwap + stdDev,
      lowerBand1: vwap - stdDev,
      upperBand2: vwap + stdDev * 2,
      lowerBand2: vwap - stdDev * 2,
      upperBand3: vwap + stdDev * 3,
      lowerBand3: vwap - stdDev * 3,
    });
  }

  return result;
};

// Stochastic Oscillator
export interface StochasticResult {
  timestamp: number;
  k: number; // Fast %K
  d: number; // Slow %D (SMA of %K)
}

export const calculateStochastic = (
  prices: PricePoint[],
  kPeriod: number = 14,
  dPeriod: number = 3
): StochasticResult[] => {
  const result: StochasticResult[] = [];
  const kValues: number[] = [];

  for (let i = kPeriod - 1; i < prices.length; i++) {
    const slice = prices.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...slice.map(p => p.price));
    const lowest = Math.min(...slice.map(p => p.price));
    const current = prices[i].price;

    const k = highest === lowest ? 50 : ((current - lowest) / (highest - lowest)) * 100;
    kValues.push(k);

    if (kValues.length >= dPeriod) {
      const d = kValues.slice(-dPeriod).reduce((a, b) => a + b, 0) / dPeriod;
      result.push({
        timestamp: prices[i].timestamp,
        k,
        d,
      });
    }
  }

  return result;
};

// Ichimoku Cloud
export interface IchimokuResult {
  timestamp: number;
  tenkanSen: number;    // Conversion Line (9-period)
  kijunSen: number;     // Base Line (26-period)
  senkouSpanA: number;  // Leading Span A
  senkouSpanB: number;  // Leading Span B (52-period)
  chikouSpan: number;   // Lagging Span
}

const getHighLow = (prices: PricePoint[], start: number, period: number) => {
  const slice = prices.slice(Math.max(0, start - period + 1), start + 1);
  const high = Math.max(...slice.map(p => p.price));
  const low = Math.min(...slice.map(p => p.price));
  return { high, low };
};

export const calculateIchimoku = (
  prices: PricePoint[],
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouBPeriod: number = 52
): IchimokuResult[] => {
  const result: IchimokuResult[] = [];

  for (let i = senkouBPeriod - 1; i < prices.length; i++) {
    const tenkan = getHighLow(prices, i, tenkanPeriod);
    const kijun = getHighLow(prices, i, kijunPeriod);
    const senkouB = getHighLow(prices, i, senkouBPeriod);

    const tenkanSen = (tenkan.high + tenkan.low) / 2;
    const kijunSen = (kijun.high + kijun.low) / 2;
    const senkouSpanA = (tenkanSen + kijunSen) / 2;
    const senkouSpanB = (senkouB.high + senkouB.low) / 2;

    result.push({
      timestamp: prices[i].timestamp,
      tenkanSen,
      kijunSen,
      senkouSpanA,
      senkouSpanB,
      chikouSpan: prices[i].price,
    });
  }

  return result;
};

// Average True Range (ATR)
export interface ATRResult {
  timestamp: number;
  atr: number;
  trueRange: number;
}

export const calculateATR = (prices: PricePoint[], period: number = 14): ATRResult[] => {
  const result: ATRResult[] = [];
  const trueRanges: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const high = prices[i].price * 1.005;
    const low = prices[i].price * 0.995;
    const prevClose = prices[i - 1].price;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);

    if (trueRanges.length >= period) {
      if (result.length === 0) {
        const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
        result.push({ timestamp: prices[i].timestamp, atr, trueRange: tr });
      } else {
        const prevATR = result[result.length - 1].atr;
        const atr = ((prevATR * (period - 1)) + tr) / period;
        result.push({ timestamp: prices[i].timestamp, atr, trueRange: tr });
      }
    }
  }

  return result;
};

// ATR from OHLC — usa high/low REAIS em vez de simulados
export const calculateATRFromOHLC = (data: OHLCPoint[], period: number = 14): ATRResult[] => {
  const result: ATRResult[] = [];
  const trueRanges: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const { high, low } = data[i];
    const prevClose = data[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);

    if (trueRanges.length >= period) {
      if (result.length === 0) {
        const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
        result.push({ timestamp: data[i].timestamp, atr, trueRange: tr });
      } else {
        const prevATR = result[result.length - 1].atr;
        const atr = ((prevATR * (period - 1)) + tr) / period;
        result.push({ timestamp: data[i].timestamp, atr, trueRange: tr });
      }
    }
  }

  return result;
};

// Average Directional Index (ADX)
export interface ADXResult {
  timestamp: number;
  adx: number;
  plusDI: number;  // +DI
  minusDI: number; // -DI
}

export const calculateADX = (prices: PricePoint[], period: number = 14): ADXResult[] => {
  const result: ADXResult[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];
  const trueRanges: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const high = prices[i].price * 1.005;
    const low = prices[i].price * 0.995;
    const prevHigh = prices[i - 1].price * 1.005;
    const prevLow = prices[i - 1].price * 0.995;
    const prevClose = prices[i - 1].price;

    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    let plusDM = 0;
    let minusDM = 0;
    if (upMove > downMove && upMove > 0) plusDM = upMove;
    if (downMove > upMove && downMove > 0) minusDM = downMove;

    plusDMs.push(plusDM);
    minusDMs.push(minusDM);

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);

    if (trueRanges.length >= period) {
      const smoothedPlusDM = plusDMs.slice(-period).reduce((a, b) => a + b, 0);
      const smoothedMinusDM = minusDMs.slice(-period).reduce((a, b) => a + b, 0);
      const smoothedTR = trueRanges.slice(-period).reduce((a, b) => a + b, 0);

      const plusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
      const minusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;

      const diSum = plusDI + minusDI;
      const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;

      if (result.length === 0) {
        result.push({ timestamp: prices[i].timestamp, adx: dx, plusDI, minusDI });
      } else if (result.length < period) {
        const avgDX = (result.reduce((sum, r) => sum + r.adx, 0) + dx) / (result.length + 1);
        result.push({ timestamp: prices[i].timestamp, adx: avgDX, plusDI, minusDI });
      } else {
        const prevADX = result[result.length - 1].adx;
        const adx = ((prevADX * (period - 1)) + dx) / period;
        result.push({ timestamp: prices[i].timestamp, adx, plusDI, minusDI });
      }
    }
  }

  return result;
};

// ADX from OHLC — usa high/low REAIS
export const calculateADXFromOHLC = (data: OHLCPoint[], period: number = 14): ADXResult[] => {
  const result: ADXResult[] = [];
  let smoothedPlusDM = 0;
  let smoothedMinusDM = 0;
  let smoothedTR = 0;
  const dxValues: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const { high, low } = data[i];
    const prevHigh = data[i - 1].high;
    const prevLow = data[i - 1].low;
    const prevClose = data[i - 1].close;

    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    let plusDM = 0;
    let minusDM = 0;
    if (upMove > downMove && upMove > 0) plusDM = upMove;
    if (downMove > upMove && downMove > 0) minusDM = downMove;

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));

    if (i <= period) {
      // Período de acumulação
      smoothedPlusDM += plusDM;
      smoothedMinusDM += minusDM;
      smoothedTR += tr;

      if (i === period) {
        const plusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
        const minusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;
        const diSum = plusDI + minusDI;
        const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
        dxValues.push(dx);
        result.push({ timestamp: data[i].timestamp, adx: dx, plusDI, minusDI });
      }
    } else {
      // Suavização de Wilder correta
      smoothedPlusDM = smoothedPlusDM - (smoothedPlusDM / period) + plusDM;
      smoothedMinusDM = smoothedMinusDM - (smoothedMinusDM / period) + minusDM;
      smoothedTR = smoothedTR - (smoothedTR / period) + tr;

      const plusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
      const minusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;
      const diSum = plusDI + minusDI;
      const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
      dxValues.push(dx);

      if (dxValues.length <= period) {
        const avgDX = dxValues.reduce((s, v) => s + v, 0) / dxValues.length;
        result.push({ timestamp: data[i].timestamp, adx: avgDX, plusDI, minusDI });
      } else {
        const prevADX = result[result.length - 1].adx;
        const adx = ((prevADX * (period - 1)) + dx) / period;
        result.push({ timestamp: data[i].timestamp, adx, plusDI, minusDI });
      }
    }
  }

  return result;
};

// Williams %R
export interface WilliamsRResult {
  timestamp: number;
  value: number; // Range: -100 to 0
}

export const calculateWilliamsR = (
  prices: PricePoint[],
  period: number = 14
): WilliamsRResult[] => {
  const result: WilliamsRResult[] = [];

  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    const highest = Math.max(...slice.map(p => p.price));
    const lowest = Math.min(...slice.map(p => p.price));
    const current = prices[i].price;

    const wr = highest === lowest ? -50 : ((highest - current) / (highest - lowest)) * -100;
    result.push({ timestamp: prices[i].timestamp, value: wr });
  }

  return result;
};

<<<<<<< HEAD
// Stochastic RSI — aplica Stochastic sobre o RSI para sinais mais rápidos
export interface StochRSIResult {
  timestamp: number;
  k: number;  // %K do Stochastic RSI (0-100)
  d: number;  // %D (SMA do %K)
}

export const calculateStochasticRSI = (
  rsiValues: IndicatorPoint[],
  period: number = 14,
  kSmoothing: number = 3,
  dSmoothing: number = 3
): StochRSIResult[] => {
  const result: StochRSIResult[] = [];
  const rawK: number[] = [];

  for (let i = period - 1; i < rsiValues.length; i++) {
    const slice = rsiValues.slice(i - period + 1, i + 1);
    const values = slice.map(r => r.value);
    const highest = Math.max(...values);
    const lowest = Math.min(...values);

    const stochRSI = highest === lowest ? 50 : ((rsiValues[i].value - lowest) / (highest - lowest)) * 100;
    rawK.push(stochRSI);
  }

  // Suaviza %K
  const smoothedK: number[] = [];
  for (let i = kSmoothing - 1; i < rawK.length; i++) {
    const avg = rawK.slice(i - kSmoothing + 1, i + 1).reduce((a, b) => a + b, 0) / kSmoothing;
    smoothedK.push(avg);
  }

  // Calcula %D (SMA do %K suavizado)
  for (let i = dSmoothing - 1; i < smoothedK.length; i++) {
    const d = smoothedK.slice(i - dSmoothing + 1, i + 1).reduce((a, b) => a + b, 0) / dSmoothing;
    const sourceIndex = (period - 1) + (kSmoothing - 1) + i;

    if (sourceIndex < rsiValues.length) {
      result.push({
        timestamp: rsiValues[sourceIndex].timestamp,
        k: smoothedK[i],
        d,
      });
    }
=======
// On-Balance Volume (OBV)
export interface OBVResult {
  timestamp: number;
  obv: number;
}

export const calculateOBV = (prices: PricePoint[]): OBVResult[] => {
  const result: OBVResult[] = [];
  let obv = 0;

  for (let i = 0; i < prices.length; i++) {
    if (i === 0) {
      result.push({ timestamp: prices[i].timestamp, obv: 0 });
      continue;
    }
    // Simulate volume based on price movement magnitude
    const simulatedVolume = 1000 + Math.abs(prices[i].price - prices[i - 1].price) * 100;

    if (prices[i].price > prices[i - 1].price) {
      obv += simulatedVolume;
    } else if (prices[i].price < prices[i - 1].price) {
      obv -= simulatedVolume;
    }
    result.push({ timestamp: prices[i].timestamp, obv });
>>>>>>> 6c662583cebf889e47843b1d017a067516fafa64
  }

  return result;
};

<<<<<<< HEAD
// EMA Crossovers — Golden Cross, Death Cross, cruzamentos rápidos
export interface EMACrossover {
  type: 'golden_cross' | 'death_cross' | 'fast_bullish' | 'fast_bearish';
  timestamp: number;
  index: number;
  fastValue: number;
  slowValue: number;
  description: string;
}

export const detectEMACrossovers = (
  ema9: IndicatorPoint[],
  ema21: IndicatorPoint[],
  ema50: IndicatorPoint[],
  ema200: IndicatorPoint[]
): EMACrossover[] => {
  const crossovers: EMACrossover[] = [];

  // Helper para detectar cruzamento entre dois arrays
  const findCrossovers = (
    fast: IndicatorPoint[],
    slow: IndicatorPoint[],
    bullishType: EMACrossover['type'],
    bearishType: EMACrossover['type'],
    label: string
  ) => {
    const minLen = Math.min(fast.length, slow.length);
    for (let i = 1; i < minLen; i++) {
      const prevFast = fast[i - 1].value;
      const prevSlow = slow[i - 1].value;
      const currFast = fast[i].value;
      const currSlow = slow[i].value;

      // Bullish crossover (fast cruza acima de slow)
      if (prevFast <= prevSlow && currFast > currSlow) {
        crossovers.push({
          type: bullishType,
          timestamp: fast[i].timestamp,
          index: i,
          fastValue: currFast,
          slowValue: currSlow,
          description: `${label} Bullish: EMA rápida cruzou acima da lenta`,
        });
      }

      // Bearish crossover (fast cruza abaixo de slow)
      if (prevFast >= prevSlow && currFast < currSlow) {
        crossovers.push({
          type: bearishType,
          timestamp: fast[i].timestamp,
          index: i,
          fastValue: currFast,
          slowValue: currSlow,
          description: `${label} Bearish: EMA rápida cruzou abaixo da lenta`,
        });
      }
    }
  };

  // Golden Cross / Death Cross (EMA 50 vs EMA 200)
  if (ema50.length > 1 && ema200.length > 1) {
    findCrossovers(ema50, ema200, 'golden_cross', 'death_cross', 'Golden/Death Cross');
  }

  // Fast Cross (EMA 9 vs EMA 21)
  if (ema9.length > 1 && ema21.length > 1) {
    findCrossovers(ema9, ema21, 'fast_bullish', 'fast_bearish', 'EMA 9/21');
  }

  return crossovers;
=======
// Commodity Channel Index (CCI)
export interface CCIResult {
  timestamp: number;
  value: number;
}

export const calculateCCI = (prices: PricePoint[], period: number = 20): CCIResult[] => {
  const result: CCIResult[] = [];

  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1);
    // Typical price approximation using close price
    const typicalPrices = slice.map(p => p.price);
    const mean = typicalPrices.reduce((a, b) => a + b, 0) / period;
    const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - mean), 0) / period;

    const cci = meanDeviation === 0 ? 0 : (prices[i].price - mean) / (0.015 * meanDeviation);
    result.push({ timestamp: prices[i].timestamp, value: cci });
  }

  return result;
>>>>>>> 6c662583cebf889e47843b1d017a067516fafa64
};

// Get signal interpretation
export const getIndicatorSignal = (
  indicator: string,
  value: number,
  previousValue?: number
): 'bullish' | 'bearish' | 'neutral' => {
  switch (indicator) {
    case 'rsi':
      if (value < 30) return 'bullish'; // Oversold
      if (value > 70) return 'bearish'; // Overbought
      return 'neutral';
    case 'macd':
      if (previousValue !== undefined) {
        if (value > 0 && value > previousValue) return 'bullish';
        if (value < 0 && value < previousValue) return 'bearish';
      }
      return value > 0 ? 'bullish' : value < 0 ? 'bearish' : 'neutral';
    case 'stochastic':
      if (value < 20) return 'bullish'; // Oversold
      if (value > 80) return 'bearish'; // Overbought
      return 'neutral';
    case 'adx':
      // ADX measures trend strength, not direction
      // Combined with +DI/-DI for direction
      if (value > 25) return 'bullish'; // Strong trend
      if (value < 20) return 'neutral'; // Weak trend
      return 'neutral';
    default:
      return 'neutral';
  }
};

// Fibonacci Levels
export interface FibonacciLevels {
  level0: number;      // 0% (Low for Uptrend, High for Downtrend)
  level1: number;      // 100% (High for Uptrend, Low for Downtrend)
  retracement382: number;
  retracement500: number;
  retracement618: number;
  extension1618: number;
  extension2618: number;
}

export const calculateFibonacciLevels = (
  high: number,
  low: number,
  trend: 'bullish' | 'bearish'
): FibonacciLevels => {
  const diff = high - low;

  if (trend === 'bullish') {
    return {
      level0: low,
      level1: high,
      retracement382: high - (diff * 0.382),
      retracement500: high - (diff * 0.5),
      retracement618: high - (diff * 0.618),
      extension1618: high + (diff * 0.618), // Target 1
      extension2618: high + (diff * 1.618), // Target 2
    };
  } else {
    return {
      level0: high,
      level1: low,
      retracement382: low + (diff * 0.382),
      retracement500: low + (diff * 0.5),
      retracement618: low + (diff * 0.618),
      extension1618: low - (diff * 0.618), // Target 1
      extension2618: low - (diff * 1.618), // Target 2
    };
  }
};
