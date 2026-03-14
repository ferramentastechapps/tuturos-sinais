import { supabase } from '@/integrations/supabase/client';
import { IndicatorPerformanceRecord, TradePerformanceEntry } from '@/types/indicatorPerformanceTypes';

const STORAGE_KEY = 'indicator-performance-data';

// ==========================================
// MOCK/LOCAL STORAGE FALLBACK
// ==========================================

const getLocalData = (): Record<string, IndicatorPerformanceRecord> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

const saveLocalData = (data: Record<string, IndicatorPerformanceRecord>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const getLocalKey = (symbol: string, indicatorKey: string) => `${symbol}_${indicatorKey}`;

// ==========================================
// CORE CRUD OPERATIONS
// ==========================================

export const indicatorPerformanceService = {
  /**
   * Process a closed trade and update performance records for all active indicators.
   * This is called by useTrades when a trade is closed.
   */
  async recordTradePerformance(trade: TradePerformanceEntry): Promise<void> {
    const session = await supabase?.auth.getSession();
    const userId = session?.data?.session?.user?.id;
    
    // MOCK / LOCAL STORAGE IMPL (Quando não está autenticado)
    if (!userId || !supabase) {
      console.log('Recording performance locally (unauthenticated)...');
      const data = getLocalData();
      
      trade.activeIndicators.forEach(ind => {
        const key = getLocalKey(trade.symbol, ind.key);
        const existing = data[key] || {
          symbol: trade.symbol,
          indicator_key: ind.key,
          total_trades: 0,
          total_confirmed: 0,
          wins_when_confirmed: 0,
          losses_when_confirmed: 0,
          wins_when_not_confirmed: 0,
          losses_when_not_confirmed: 0,
          avg_profit_when_confirmed: 0,
          avg_loss_when_confirmed: 0,
          total_profit: 0,
          total_loss: 0
        };
        
        existing.total_trades += 1;
        
        const isWin = trade.result === 'win';
        
        if (ind.confirmed) {
          existing.total_confirmed += 1;
          if (isWin) {
            existing.wins_when_confirmed += 1;
            existing.total_profit += trade.profitPercent;
            // Update rolling average
            existing.avg_profit_when_confirmed = existing.total_profit / existing.wins_when_confirmed;
          } else {
            existing.losses_when_confirmed += 1;
            existing.total_loss += Math.abs(trade.profitPercent);
            existing.avg_loss_when_confirmed = existing.total_loss / existing.losses_when_confirmed;
          }
        } else {
          if (isWin) {
            existing.wins_when_not_confirmed += 1;
          } else {
            existing.losses_when_not_confirmed += 1;
          }
        }
        
        data[key] = existing;
      });
      
      saveLocalData(data);
      return;
    }
    
    // SUPABASE IMPL
    try {
      // For each active indicator, upsert the performance record
      for (const ind of trade.activeIndicators) {
        // Fetch existing first to update running totals
        const { data: existingRecords } = await supabase
          .from('indicator_performance_by_symbol' as any)
          .select('*')
          .eq('user_id', userId)
          .eq('symbol', trade.symbol)
          .eq('indicator_key', ind.key)
          .limit(1);
          
        const existing = existingRecords && (existingRecords as any[]).length > 0 ? (existingRecords as any[])[0] : null;
        const isWin = trade.result === 'win';
        
        const updateData: Record<string, string | number> = {
          user_id: userId,
          symbol: trade.symbol,
          indicator_key: ind.key,
          total_trades: (existing?.total_trades || 0) + 1,
        };
        
        if (ind.confirmed) {
          updateData.total_confirmed = (existing?.total_confirmed || 0) + 1;
          
          if (isWin) {
            updateData.wins_when_confirmed = (existing?.wins_when_confirmed || 0) + 1;
            updateData.total_profit = (existing?.total_profit || 0) + trade.profitPercent;
            updateData.avg_profit_when_confirmed = updateData.total_profit / updateData.wins_when_confirmed;
          } else {
            updateData.losses_when_confirmed = (existing?.losses_when_confirmed || 0) + 1;
            updateData.total_loss = (existing?.total_loss || 0) + Math.abs(trade.profitPercent);
            updateData.avg_loss_when_confirmed = updateData.total_loss / updateData.losses_when_confirmed;
          }
        } else {
          if (isWin) {
            updateData.wins_when_not_confirmed = (existing?.wins_when_not_confirmed || 0) + 1;
          } else {
            updateData.losses_when_not_confirmed = (existing?.losses_when_not_confirmed || 0) + 1;
          }
        }
        
        // Upsert matching on user_id, symbol, indicator_key via unique constraint
        await supabase
          .from('indicator_performance_by_symbol')
          .upsert(updateData, { onConflict: 'user_id,symbol,indicator_key' });
      }
    } catch (e) {
      console.error('[indicatorPerformanceService] Failed to record performance:', e);
      // Fallback a save en local si falla supabase?
    }
  },
  
  /**
   * Load all performance records for a specific symbol.
   */
  async loadPerformanceForSymbol(symbol: string): Promise<IndicatorPerformanceRecord[]> {
    const session = await supabase?.auth.getSession();
    const userId = session?.data?.session?.user?.id;
    
    if (!userId || !supabase) {
      const data = getLocalData();
      return Object.values(data).filter(r => r.symbol === symbol);
    }
    
    const { data, error } = await supabase
      .from('indicator_performance_by_symbol')
      .select('*')
      .eq('user_id', userId)
      .eq('symbol', symbol);
      
    if (error) {
      console.error('[indicatorPerformanceService] Error loading for symbol:', error);
      return [];
    }
    
    return data as IndicatorPerformanceRecord[];
  },
  
  /**
   * Load all performance records across all symbols (for comparison matrix).
   */
  async loadAllSymbolPerformance(): Promise<IndicatorPerformanceRecord[]> {
    const session = await supabase?.auth.getSession();
    const userId = session?.data?.session?.user?.id;
    
    if (!userId || !supabase) {
      return Object.values(getLocalData());
    }
    
    const { data, error } = await supabase
      .from('indicator_performance_by_symbol')
      .select('*')
      .eq('user_id', userId);
      
    if (error) {
      console.error('[indicatorPerformanceService] Error loading all performance:', error);
      return [];
    }
    
    return data as IndicatorPerformanceRecord[];
  },
  
  /**
   * Reset data for a specific symbol.
   */
  async resetSymbolData(symbol: string): Promise<boolean> {
    const session = await supabase?.auth.getSession();
    const userId = session?.data?.session?.user?.id;
    
    if (!userId || !supabase) {
      const data = getLocalData();
      const newData: Record<string, IndicatorPerformanceRecord> = {};
      
      Object.keys(data).forEach(k => {
        if (data[k].symbol !== symbol) {
          newData[k] = data[k];
        }
      });
      
      saveLocalData(newData);
      return true;
    }
    
    const { error } = await supabase
      .from('indicator_performance_by_symbol')
      .delete()
      .eq('user_id', userId)
      .eq('symbol', symbol);
      
    if (error) {
      console.error('[indicatorPerformanceService] Error resetting symbol:', error);
      return false;
    }
    return true;
  }
};
