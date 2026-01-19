export type AlertType = 'tp_hit' | 'sl_hit' | 'high_volatility' | 'trend_change' | 'entry_signal';

export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TradingAlert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  symbol: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: {
    price?: number;
    change?: number;
    direction?: 'bullish' | 'bearish';
    signalId?: string;
  };
}

export const ALERT_CONFIG: Record<AlertType, { icon: string; color: string; sound?: boolean }> = {
  tp_hit: { icon: '🎯', color: 'text-trading-profit', sound: true },
  sl_hit: { icon: '🛑', color: 'text-trading-loss', sound: true },
  high_volatility: { icon: '⚡', color: 'text-trading-warning', sound: false },
  trend_change: { icon: '🔄', color: 'text-trading-accent', sound: false },
  entry_signal: { icon: '📊', color: 'text-primary', sound: true },
};
