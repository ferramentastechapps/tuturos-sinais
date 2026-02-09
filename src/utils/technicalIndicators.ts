// Technical Indicators Calculation Utilities

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

// VWAP (Volume Weighted Average Price) - Simplified version using price only
export const calculateVWAP = (prices: PricePoint[]): IndicatorPoint[] => {
  const result: IndicatorPoint[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  
  for (let i = 0; i < prices.length; i++) {
    // Simulate volume based on price movement
    const priceChange = i > 0 ? Math.abs(prices[i].price - prices[i - 1].price) : 0;
    const simulatedVolume = 1000 + priceChange * 100;
    
    cumulativeTPV += prices[i].price * simulatedVolume;
    cumulativeVolume += simulatedVolume;
    
    result.push({
      timestamp: prices[i].timestamp,
      value: cumulativeTPV / cumulativeVolume,
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
    const high = prices[i].price * 1.005; // Simulate high as 0.5% above close
    const low = prices[i].price * 0.995;  // Simulate low as 0.5% below close
    const prevClose = prices[i - 1].price;
    
    // True Range = max(high - low, |high - prevClose|, |low - prevClose|)
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
    
    if (trueRanges.length >= period) {
      // Use Wilder's smoothing method for ATR
      if (result.length === 0) {
        // First ATR is simple average
        const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
        result.push({
          timestamp: prices[i].timestamp,
          atr,
          trueRange: tr,
        });
      } else {
        // Subsequent ATRs use smoothing: ATR = ((prevATR * (period - 1)) + TR) / period
        const prevATR = result[result.length - 1].atr;
        const atr = ((prevATR * (period - 1)) + tr) / period;
        result.push({
          timestamp: prices[i].timestamp,
          atr,
          trueRange: tr,
        });
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
    
    // Calculate directional movement
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    
    let plusDM = 0;
    let minusDM = 0;
    
    if (upMove > downMove && upMove > 0) {
      plusDM = upMove;
    }
    if (downMove > upMove && downMove > 0) {
      minusDM = downMove;
    }
    
    plusDMs.push(plusDM);
    minusDMs.push(minusDM);
    
    // True Range
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
    
    if (trueRanges.length >= period) {
      // Smooth the values using Wilder's method
      const smoothedPlusDM = plusDMs.slice(-period).reduce((a, b) => a + b, 0);
      const smoothedMinusDM = minusDMs.slice(-period).reduce((a, b) => a + b, 0);
      const smoothedTR = trueRanges.slice(-period).reduce((a, b) => a + b, 0);
      
      // Calculate +DI and -DI
      const plusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
      const minusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;
      
      // Calculate DX
      const diSum = plusDI + minusDI;
      const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
      
      // Calculate ADX (smoothed DX)
      if (result.length === 0) {
        result.push({
          timestamp: prices[i].timestamp,
          adx: dx,
          plusDI,
          minusDI,
        });
      } else if (result.length < period) {
        // Accumulate DX values for initial ADX
        const avgDX = (result.reduce((sum, r) => sum + r.adx, 0) + dx) / (result.length + 1);
        result.push({
          timestamp: prices[i].timestamp,
          adx: avgDX,
          plusDI,
          minusDI,
        });
      } else {
        // Smooth ADX
        const prevADX = result[result.length - 1].adx;
        const adx = ((prevADX * (period - 1)) + dx) / period;
        result.push({
          timestamp: prices[i].timestamp,
          adx,
          plusDI,
          minusDI,
        });
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
