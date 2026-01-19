import { useEffect, useRef, useCallback } from 'react';
import { CryptoPair, TradeSignal } from '@/types/trading';

interface UseMarketMonitorOptions {
  pairs: CryptoPair[];
  signals: TradeSignal[];
  onTPHit: (symbol: string, price: number, profit: number) => void;
  onSLHit: (symbol: string, price: number, loss: number) => void;
  onHighVolatility: (symbol: string, change: number) => void;
  onTrendChange: (symbol: string, direction: 'bullish' | 'bearish', timeframe: string) => void;
  volatilityThreshold?: number;
  enabled?: boolean;
}

export function useMarketMonitor({
  pairs,
  signals,
  onTPHit,
  onSLHit,
  onHighVolatility,
  onTrendChange,
  volatilityThreshold = 3,
  enabled = true,
}: UseMarketMonitorOptions) {
  const previousPrices = useRef<Map<string, number>>(new Map());
  const previousTrends = useRef<Map<string, string>>(new Map());
  const alertedSignals = useRef<Set<string>>(new Set());
  const alertedVolatility = useRef<Map<string, number>>(new Map());

  const checkSignals = useCallback(() => {
    signals.forEach((signal) => {
      if (signal.status !== 'active') return;
      
      const pair = pairs.find(p => p.symbol === signal.pair);
      if (!pair) return;

      const signalKey = `${signal.id}_${signal.pair}`;
      if (alertedSignals.current.has(signalKey)) return;

      // Check TP
      if (signal.type === 'long' && pair.price >= signal.takeProfit) {
        const profit = ((signal.takeProfit - signal.entry) / signal.entry) * 100;
        onTPHit(signal.pair, pair.price, profit);
        alertedSignals.current.add(signalKey);
      } else if (signal.type === 'short' && pair.price <= signal.takeProfit) {
        const profit = ((signal.entry - signal.takeProfit) / signal.entry) * 100;
        onTPHit(signal.pair, pair.price, profit);
        alertedSignals.current.add(signalKey);
      }

      // Check SL
      if (signal.type === 'long' && pair.price <= signal.stopLoss) {
        const loss = ((signal.stopLoss - signal.entry) / signal.entry) * 100;
        onSLHit(signal.pair, pair.price, loss);
        alertedSignals.current.add(signalKey);
      } else if (signal.type === 'short' && pair.price >= signal.stopLoss) {
        const loss = ((signal.entry - signal.stopLoss) / signal.entry) * 100;
        onSLHit(signal.pair, pair.price, loss);
        alertedSignals.current.add(signalKey);
      }
    });
  }, [signals, pairs, onTPHit, onSLHit]);

  const checkVolatility = useCallback(() => {
    pairs.forEach((pair) => {
      const previousPrice = previousPrices.current.get(pair.symbol);
      const lastAlertTime = alertedVolatility.current.get(pair.symbol) || 0;
      const now = Date.now();

      // Only alert once every 5 minutes per symbol
      if (now - lastAlertTime < 300000) return;

      if (previousPrice) {
        const change = ((pair.price - previousPrice) / previousPrice) * 100;
        
        if (Math.abs(change) >= volatilityThreshold) {
          onHighVolatility(pair.symbol, change);
          alertedVolatility.current.set(pair.symbol, now);
        }
      }

      previousPrices.current.set(pair.symbol, pair.price);
    });
  }, [pairs, volatilityThreshold, onHighVolatility]);

  const checkTrendChanges = useCallback(() => {
    pairs.forEach((pair) => {
      const previousTrend = previousTrends.current.get(pair.symbol);
      const currentTrend = pair.change24h >= 0 ? 'bullish' : 'bearish';

      if (previousTrend && previousTrend !== currentTrend) {
        // Only trigger if significant change
        if (Math.abs(pair.change24h) > 1) {
          onTrendChange(pair.symbol, currentTrend, '1H');
        }
      }

      previousTrends.current.set(pair.symbol, currentTrend);
    });
  }, [pairs, onTrendChange]);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      checkSignals();
      checkVolatility();
      checkTrendChanges();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [enabled, checkSignals, checkVolatility, checkTrendChanges]);

  return {
    resetAlerts: () => {
      alertedSignals.current.clear();
      alertedVolatility.current.clear();
    },
  };
}
