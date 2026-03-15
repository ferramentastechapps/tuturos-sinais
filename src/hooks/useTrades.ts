import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trade, TradeWithMetrics, TradesSummary } from '@/types/trades';
import { useCryptoPrices } from './useCryptoPrices';
import { useIndicatorPerformance } from './useIndicatorPerformance';
import { ActiveIndicatorState } from '@/types/indicatorPerformanceTypes';

const STORAGE_KEY = 'crypto-trades';

const loadFromStorage = (): Trade[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
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
  const { recordClosedTrade } = useIndicatorPerformance();

  useEffect(() => {
    saveToStorage(trades);
  }, [trades]);

  const addTrade = useCallback((
    symbol: string,
    type: 'buy' | 'sell',
    entryPrice: number,
    quantity: number,
    entryFee: number = 0,
    notes?: string,
    exchange?: string,
    signalIndicators?: string[],
    profileUsed?: string
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
      entryFee,
      notes,
      exchange,
      signalIndicators,
      profileUsed
    };

    setTrades(prev => [newTrade, ...prev]);
  }, [livePrices]);

  const closeTrade = useCallback((id: string, exitPrice: number, exitFee: number = 0) => {
    setTrades(prev => {
      const trade = prev.find(t => t.id === id);
      if (!trade) return prev;
      
      const newTrade = { ...trade, exitPrice, exitFee, status: 'closed' as const, closedAt: new Date() };
      
      // Calculate PnL locally to send to performance recorder
      if (trade.signalIndicators && trade.signalIndicators.length > 0) {
        const investedValue = trade.quantity * trade.entryPrice;
        const currentValue = trade.quantity * exitPrice;
        
        let pnl = trade.type === 'buy' 
          ? currentValue - investedValue
          : investedValue - currentValue;
          
        const pnlPercentage = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
        const isWin = pnlPercentage > 0;
        
        // Build active indicators array (all confirmed for now, ideally we'd pass their actual weight/confirmation status from the original signal, but we'll assume they were confirmed if they appeared in signalIndicators, and we'll leave weight default to 100 or fake it for analysis)
        // In a real scenario we'd track the exact condition at generation time.
        const activeIndicators: ActiveIndicatorState[] = trade.signalIndicators.map(key => ({
          key: key as any,
          weight: 100,
          confirmed: true 
        }));
        
        // This runs asynchronously in background
        recordClosedTrade({
          symbol: trade.symbol,
          result: isWin ? 'win' : 'loss',
          profitPercent: pnlPercentage,
          direction: trade.type === 'buy' ? 'long' : 'short',
          activeIndicators,
          profileUsed: trade.profileUsed
        }).catch(e => console.error("Failed to record trade performance:", e));
      }
      
      return prev.map(t => t.id === id ? newTrade : t);
    });
  }, [recordClosedTrade]);

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
    
    // Calculate fees
    const totalFees = (trade.entryFee || 0) + (trade.exitFee || 0);
    
    // For buy: profit when price goes up
    // For sell (short): profit when price goes down
    let pnl = trade.type === 'buy' 
      ? currentValue - investedValue
      : investedValue - currentValue;
    
    // Subtract fees from P&L
    pnl -= totalFees;
    
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
