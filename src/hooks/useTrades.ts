import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trade, TradeWithMetrics, TradesSummary } from '@/types/trades';
import { useCryptoPrices } from './useCryptoPrices';

const STORAGE_KEY = 'crypto-trades';

const loadFromStorage = (): Trade[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((trade: Trade) => ({
        ...trade,
        createdAt: new Date(trade.createdAt),
        closedAt: trade.closedAt ? new Date(trade.closedAt) : undefined,
      }));
    }
  } catch (error) {
    console.error('Error loading trades from storage:', error);
  }
  return [];
};

const saveToStorage = (trades: Trade[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  } catch (error) {
    console.error('Error saving trades to storage:', error);
  }
};

export const useTrades = () => {
  const [trades, setTrades] = useState<Trade[]>(() => loadFromStorage());
  const { data: livePrices } = useCryptoPrices();

  useEffect(() => {
    saveToStorage(trades);
  }, [trades]);

  const addTrade = useCallback((
    symbol: string,
    type: 'buy' | 'sell',
    entryPrice: number,
    quantity: number
  ) => {
    const pair = livePrices?.find(p => p.symbol === symbol);
    if (!pair) return;

    const newTrade: Trade = {
      id: crypto.randomUUID(),
      symbol,
      name: pair.name,
      type,
      entryPrice,
      quantity,
      status: 'open',
      createdAt: new Date(),
    };

    setTrades(prev => [newTrade, ...prev]);
  }, [livePrices]);

  const closeTrade = useCallback((id: string, exitPrice: number) => {
    setTrades(prev =>
      prev.map(trade =>
        trade.id === id
          ? { ...trade, exitPrice, status: 'closed' as const, closedAt: new Date() }
          : trade
      )
    );
  }, []);

  const deleteTrade = useCallback((id: string) => {
    setTrades(prev => prev.filter(trade => trade.id !== id));
  }, []);

  const getTradeWithMetrics = useCallback((trade: Trade): TradeWithMetrics => {
    const pair = livePrices?.find(p => p.symbol === trade.symbol);
    const currentPrice = trade.status === 'closed' 
      ? (trade.exitPrice ?? trade.entryPrice)
      : (pair?.price ?? trade.entryPrice);
    
    const investedValue = trade.quantity * trade.entryPrice;
    const currentValue = trade.quantity * currentPrice;
    
    // For buy: profit when price goes up
    // For sell (short): profit when price goes down
    const pnl = trade.type === 'buy' 
      ? currentValue - investedValue
      : investedValue - currentValue;
    
    const pnlPercentage = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

    return {
      ...trade,
      currentPrice,
      currentValue,
      investedValue,
      pnl,
      pnlPercentage,
    };
  }, [livePrices]);

  const tradesWithMetrics = useMemo(() => 
    trades.map(getTradeWithMetrics),
    [trades, getTradeWithMetrics]
  );

  const summary: TradesSummary = useMemo(() => {
    const openTrades = tradesWithMetrics.filter(t => t.status === 'open');
    const closedTrades = tradesWithMetrics.filter(t => t.status === 'closed');
    const totalPnL = tradesWithMetrics.reduce((sum, t) => sum + t.pnl, 0);
    const winningTrades = closedTrades.filter(t => t.pnl > 0);
    const winRate = closedTrades.length > 0 
      ? (winningTrades.length / closedTrades.length) * 100 
      : 0;

    return {
      totalTrades: trades.length,
      openTrades: openTrades.length,
      closedTrades: closedTrades.length,
      totalPnL,
      winRate,
    };
  }, [trades, tradesWithMetrics]);

  return {
    trades: tradesWithMetrics,
    summary,
    addTrade,
    closeTrade,
    deleteTrade,
    livePrices,
  };
};
