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
    default:
      return 'neutral';
  }
};
