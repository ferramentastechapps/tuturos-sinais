export type IndicatorAlertType = 
  | 'rsi_oversold'
  | 'rsi_overbought'
  | 'macd_bullish_cross'
  | 'macd_bearish_cross'
  | 'ema_golden_cross'
  | 'ema_death_cross'
  | 'bb_lower_touch'
  | 'bb_upper_touch'
  | 'stoch_oversold'
  | 'stoch_overbought'
  | 'ichimoku_bullish'
  | 'ichimoku_bearish'
  | 'adx_bullish_cross'
  | 'adx_bearish_cross'
  | 'adx_strong_trend'
  | 'atr_high_volatility'
  | 'atr_low_volatility';

export interface IndicatorAlert {
  id: string;
  type: IndicatorAlertType;
  symbol: string;
  indicatorName: string;
  value: number;
  threshold?: number;
  message: string;
  timestamp: Date;
  read: boolean;
  direction: 'bullish' | 'bearish';
}

export interface IndicatorAlertConfig {
  enabled: boolean;
  rsiOversold: number;
  rsiOverbought: number;
  stochOversold: number;
  stochOverbought: number;
  enableMacdCross: boolean;
  enableEmaCross: boolean;
  enableBollingerTouch: boolean;
  enableIchimokuSignals: boolean;
  enableAdxCross: boolean;
  adxStrongTrend: number;
  enableAtrAlerts: boolean;
  atrHighVolatility: number;
  atrLowVolatility: number;
}

export const DEFAULT_INDICATOR_ALERT_CONFIG: IndicatorAlertConfig = {
  enabled: true,
  rsiOversold: 30,
  rsiOverbought: 70,
  stochOversold: 20,
  stochOverbought: 80,
  enableMacdCross: true,
  enableEmaCross: true,
  enableBollingerTouch: true,
  enableIchimokuSignals: true,
  enableAdxCross: true,
  adxStrongTrend: 25,
  enableAtrAlerts: true,
  atrHighVolatility: 3,
  atrLowVolatility: 1,
};

export const INDICATOR_ALERT_INFO: Record<IndicatorAlertType, { 
  icon: string; 
  label: string;
  color: string;
}> = {
  rsi_oversold: { icon: '📉', label: 'RSI Sobrevendido', color: 'text-success' },
  rsi_overbought: { icon: '📈', label: 'RSI Sobrecomprado', color: 'text-destructive' },
  macd_bullish_cross: { icon: '🔼', label: 'MACD Cruzamento Alta', color: 'text-success' },
  macd_bearish_cross: { icon: '🔽', label: 'MACD Cruzamento Baixa', color: 'text-destructive' },
  ema_golden_cross: { icon: '✨', label: 'Golden Cross (EMA)', color: 'text-success' },
  ema_death_cross: { icon: '💀', label: 'Death Cross (EMA)', color: 'text-destructive' },
  bb_lower_touch: { icon: '⬇️', label: 'Toque Banda Inferior', color: 'text-success' },
  bb_upper_touch: { icon: '⬆️', label: 'Toque Banda Superior', color: 'text-destructive' },
  stoch_oversold: { icon: '🔻', label: 'Stochastic Sobrevendido', color: 'text-success' },
  stoch_overbought: { icon: '🔺', label: 'Stochastic Sobrecomprado', color: 'text-destructive' },
  ichimoku_bullish: { icon: '☁️', label: 'Ichimoku Alta', color: 'text-success' },
  ichimoku_bearish: { icon: '🌧️', label: 'Ichimoku Baixa', color: 'text-destructive' },
  adx_bullish_cross: { icon: '📊', label: 'ADX +DI Cruzou Acima', color: 'text-success' },
  adx_bearish_cross: { icon: '📉', label: 'ADX -DI Cruzou Acima', color: 'text-destructive' },
  adx_strong_trend: { icon: '💪', label: 'ADX Tendência Forte', color: 'text-primary' },
  atr_high_volatility: { icon: '⚡', label: 'ATR Alta Volatilidade', color: 'text-warning' },
  atr_low_volatility: { icon: '😴', label: 'ATR Baixa Volatilidade', color: 'text-muted-foreground' },
};
