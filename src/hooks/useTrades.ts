import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trade, TradeWithMetrics, TradesSummary } from '@/types/trades';
import { useCryptoPrices } from './useCryptoPrices';
import { useIndicatorPerformance } from './useIndicatorPerformance';
import { ActiveIndicatorState } from '@/types/indicatorPerformanceTypes';
import { apiClient } from '@/services/apiClient';

export const useTrades = () => {
  const queryClient = useQueryClient();
  const { data: livePrices } = useCryptoPrices();
  const { recordClosedTrade } = useIndicatorPerformance();

  const { data: rawTrades = [] } = useQuery<any[]>({
    queryKey: ['user-trades'],
    queryFn: async () => {
      const { data } = await apiClient.get('/user-trades');
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5000,
  });

  // Map snake_case to camelCase
  const trades: Trade[] = useMemo(() => rawTrades.map(t => ({
    id: t.id,
    symbol: t.symbol,
    name: t.name,
    type: t.type,
    entryPrice: Number(t.entry_price),
    exitPrice: t.exit_price !== null ? Number(t.exit_price) : undefined,
    quantity: Number(t.quantity),
    entryFee: Number(t.entry_fee),
    exitFee: t.exit_fee !== null ? Number(t.exit_fee) : undefined,
    status: t.status,
    notes: t.notes,
    exchange: t.exchange,
    signalIndicators: t.signal_indicators,
    profileUsed: t.profile_used,
    createdAt: new Date(t.created_at),
    closedAt: t.closed_at ? new Date(t.closed_at) : undefined,
  })), [rawTrades]);

  const addTradeMutation = useMutation({
    mutationFn: async (tradeBody: any) => {
      const { data } = await apiClient.post('/user-trades', tradeBody);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-trades'] });
    }
  });

  const closeTradeMutation = useMutation({
    mutationFn: async ({ id, exit_price, exit_fee }: any) => {
      const { data } = await apiClient.put(`/user-trades/${id}/close`, { exit_price, exit_fee });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-trades'] });
    }
  });

  const deleteTradeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/user-trades/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-trades'] });
    }
  });

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

    addTradeMutation.mutate({
      symbol,
      name: pair.name,
      type,
      entry_price: entryPrice,
      quantity,
      entry_fee: entryFee,
      notes,
      exchange,
      signal_indicators: signalIndicators || [],
      profile_used: profileUsed
    });
  }, [livePrices, addTradeMutation]);

  const closeTrade = useCallback((id: string, exitPrice: number, exitFee: number = 0) => {
    const trade = trades.find(t => t.id === id);
    if (!trade) return;
    
    closeTradeMutation.mutate(
      { id, exit_price: exitPrice, exit_fee: exitFee },
      {
        onSuccess: () => {
          // Calculate PnL locally to send to performance recorder
          if (trade.signalIndicators && trade.signalIndicators.length > 0) {
            const investedValue = trade.quantity * trade.entryPrice;
            const currentValue = trade.quantity * exitPrice;
            
            let pnl = trade.type === 'buy' 
              ? currentValue - investedValue
              : investedValue - currentValue;
              
            const pnlPercentage = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
            const isWin = pnlPercentage > 0;
            
            const activeIndicators: ActiveIndicatorState[] = trade.signalIndicators.map(key => ({
              key: key as any,
              weight: 100,
              confirmed: true 
            }));
            
            recordClosedTrade({
              symbol: trade.symbol,
              result: isWin ? 'win' : 'loss',
              profitPercent: pnlPercentage,
              direction: trade.type === 'buy' ? 'long' : 'short',
              activeIndicators,
              profileUsed: trade.profileUsed
            }).catch(e => console.error("Failed to record trade performance:", e));
          }
        }
      }
    );
  }, [trades, closeTradeMutation, recordClosedTrade]);

  const deleteTrade = useCallback((id: string) => {
    deleteTradeMutation.mutate(id);
  }, [deleteTradeMutation]);

  const getTradeWithMetrics = useCallback((trade: Trade): TradeWithMetrics => {
    const pair = livePrices?.find(p => p.symbol === trade.symbol);
    const currentPrice = trade.status === 'closed' 
      ? (trade.exitPrice ?? trade.entryPrice)
      : (pair?.price ?? trade.entryPrice);
    
    const investedValue = trade.quantity * trade.entryPrice;
    const currentValue = trade.quantity * currentPrice;
    
    // Calculate fees
    const totalFees = (trade.entryFee || 0) + (trade.exitFee || 0);
    
    let pnl = trade.type === 'buy' 
      ? currentValue - investedValue
      : investedValue - currentValue;
    
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
