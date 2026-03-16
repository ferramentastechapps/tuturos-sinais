import { IndicatorPerformanceRecord, TradePerformanceEntry } from '@/types/indicatorPerformanceTypes';

const STORAGE_KEY = 'indicator-performance-data';

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

export const indicatorPerformanceService = {
  async recordTradePerformance(trade: TradePerformanceEntry): Promise<void> {
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
  },
  
  async loadPerformanceForSymbol(symbol: string): Promise<IndicatorPerformanceRecord[]> {
    const data = getLocalData();
    return Object.values(data).filter(r => r.symbol === symbol);
  },
  
  async loadAllSymbolPerformance(): Promise<IndicatorPerformanceRecord[]> {
    return Object.values(getLocalData());
  },
  
  async resetSymbolData(symbol: string): Promise<boolean> {
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
};
