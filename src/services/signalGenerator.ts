// Real-time Signal Generator based on Technical Indicators

import { TechnicalIndicator } from '@/types/trading';
import { TradeSignal } from '@/types/trading';

export interface SignalGeneratorInput {
  symbol: string;
  currentPrice: number;
  indicators: TechnicalIndicator[];
  high24h: number;
  low24h: number;
}

export interface GeneratedSignal {
  type: 'long' | 'short';
  entry: number;
  takeProfit: number;
  stopLoss: number;
  riskReward: number;
  confidence: number;
  indicators: string[];
  timeframe: string;
}

export const generateTradeSignal = (input: SignalGeneratorInput): GeneratedSignal | null => {
  const { currentPrice, indicators, high24h, low24h } = input;
  
  // Count bullish and bearish signals
  const bullishCount = indicators.filter(i => i.signal === 'bullish').length;
  const bearishCount = indicators.filter(i => i.signal === 'bearish').length;
  const totalSignals = indicators.length;

  // Need at least 60% agreement for a signal
  const bullishPercent = (bullishCount / totalSignals) * 100;
  const bearishPercent = (bearishCount / totalSignals) * 100;

  // Get specific indicators
  const rsi = indicators.find(i => i.name.includes('RSI'));
  const macd = indicators.find(i => i.name === 'MACD');
  const ema20 = indicators.find(i => i.name === 'EMA 20');
  const ema50 = indicators.find(i => i.name === 'EMA 50');
  const ema200 = indicators.find(i => i.name === 'EMA 200');

  // LONG Signal Logic
  if (bullishPercent >= 60) {
    const reasons: string[] = [];
    let confidence = bullishPercent;

    // RSI oversold
    if (rsi && rsi.value < 40) {
      reasons.push('RSI Oversold');
      confidence += 5;
    }

    // MACD bullish
    if (macd && macd.signal === 'bullish') {
      reasons.push('MACD Bullish Cross');
      confidence += 5;
    }

    // Price above EMAs
    if (ema20 && currentPrice > ema20.value) {
      reasons.push('Above EMA 20');
    }
    if (ema50 && currentPrice > ema50.value) {
      reasons.push('Above EMA 50');
    }
    if (ema200 && currentPrice > ema200.value) {
      reasons.push('Above EMA 200');
      confidence += 5;
    }

    // Calculate entry, TP, and SL
    const entry = currentPrice;
    const atr = (high24h - low24h) * 0.5; // Simplified ATR
    const stopLoss = entry - (atr * 1.5);
    const takeProfit = entry + (atr * 3);
    const riskReward = (takeProfit - entry) / (entry - stopLoss);

    return {
      type: 'long',
      entry: parseFloat(entry.toFixed(2)),
      takeProfit: parseFloat(takeProfit.toFixed(2)),
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      riskReward: parseFloat(riskReward.toFixed(2)),
      confidence: Math.min(Math.round(confidence), 95),
      indicators: reasons,
      timeframe: '4H',
    };
  }

  // SHORT Signal Logic
  if (bearishPercent >= 60) {
    const reasons: string[] = [];
    let confidence = bearishPercent;

    // RSI overbought
    if (rsi && rsi.value > 60) {
      reasons.push('RSI Overbought');
      confidence += 5;
    }

    // MACD bearish
    if (macd && macd.signal === 'bearish') {
      reasons.push('MACD Bearish Cross');
      confidence += 5;
    }

    // Price below EMAs
    if (ema20 && currentPrice < ema20.value) {
      reasons.push('Below EMA 20');
    }
    if (ema50 && currentPrice < ema50.value) {
      reasons.push('Below EMA 50');
    }
    if (ema200 && currentPrice < ema200.value) {
      reasons.push('Below EMA 200');
      confidence += 5;
    }

    // Calculate entry, TP, and SL
    const entry = currentPrice;
    const atr = (high24h - low24h) * 0.5;
    const stopLoss = entry + (atr * 1.5);
    const takeProfit = entry - (atr * 3);
    const riskReward = (entry - takeProfit) / (stopLoss - entry);

    return {
      type: 'short',
      entry: parseFloat(entry.toFixed(2)),
      takeProfit: parseFloat(takeProfit.toFixed(2)),
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      riskReward: parseFloat(riskReward.toFixed(2)),
      confidence: Math.min(Math.round(confidence), 95),
      indicators: reasons,
      timeframe: '4H',
    };
  }

  return null;
};

export const generateSignalsForPairs = async (
  pairs: Array<{ symbol: string; price: number; high24h: number; low24h: number }>,
  getIndicators: (symbol: string) => Promise<TechnicalIndicator[]>
): Promise<TradeSignal[]> => {
  const signals: TradeSignal[] = [];

  for (const pair of pairs) {
    try {
      const indicators = await getIndicators(pair.symbol);
      
      const generatedSignal = generateTradeSignal({
        symbol: pair.symbol,
        currentPrice: pair.price,
        indicators,
        high24h: pair.high24h,
        low24h: pair.low24h,
      });

      if (generatedSignal) {
        signals.push({
          id: `${pair.symbol}-${Date.now()}`,
          pair: pair.symbol,
          type: generatedSignal.type,
          entry: generatedSignal.entry,
          takeProfit: generatedSignal.takeProfit,
          stopLoss: generatedSignal.stopLoss,
          riskReward: generatedSignal.riskReward,
          timeframe: generatedSignal.timeframe,
          status: 'active',
          confidence: generatedSignal.confidence,
          createdAt: new Date(),
          indicators: generatedSignal.indicators,
        });
      }
    } catch (error) {
      console.error(`Error generating signal for ${pair.symbol}:`, error);
    }
  }

  return signals;
};
