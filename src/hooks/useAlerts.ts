import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { TradingAlert, AlertType, AlertPriority, ALERT_CONFIG } from '@/types/alerts';

interface UseAlertsOptions {
  enableSound?: boolean;
  maxAlerts?: number;
}

export function useAlerts(options: UseAlertsOptions = {}) {
  const { enableSound = true, maxAlerts = 50 } = options;
  const [alerts, setAlerts] = useState<TradingAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element for notifications
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleBoAHI/NzaJuKgwlk9DSn3QuEiuT0NGecy4QLZPR0JxxLhAvk9HQm3EvDy+T0dCbcS8PL5PR0JtxLw8vk9HQm3EvDy+T0dCbcS8PL5PR0JtxLw8=');
    return () => {
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, []);

  const playSound = useCallback(() => {
    if (enableSound && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [enableSound]);

  const generateId = () => `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addAlert = useCallback((
    type: AlertType,
    symbol: string,
    title: string,
    message: string,
    priority: AlertPriority = 'medium',
    data?: TradingAlert['data']
  ) => {
    const config = ALERT_CONFIG[type];
    const newAlert: TradingAlert = {
      id: generateId(),
      type,
      priority,
      symbol,
      title,
      message,
      timestamp: new Date(),
      read: false,
      data,
    };

    setAlerts(prev => [newAlert, ...prev].slice(0, maxAlerts));
    setUnreadCount(prev => prev + 1);

    // Show toast notification
    const variant = priority === 'critical' || type === 'sl_hit' ? 'destructive' : 'default';
    
    toast({
      title: `${config.icon} ${title}`,
      description: message,
      variant,
    });

    if (config.sound) {
      playSound();
    }

    return newAlert;
  }, [maxAlerts, playSound]);

  const triggerTPAlert = useCallback((symbol: string, price: number, profit: number) => {
    return addAlert(
      'tp_hit',
      symbol,
      `Take Profit Atingido! ${symbol}`,
      `Preço atingiu $${price.toLocaleString()} (+${profit.toFixed(2)}%)`,
      'high',
      { price, change: profit }
    );
  }, [addAlert]);

  const triggerSLAlert = useCallback((symbol: string, price: number, loss: number) => {
    return addAlert(
      'sl_hit',
      symbol,
      `Stop Loss Atingido! ${symbol}`,
      `Preço atingiu $${price.toLocaleString()} (${loss.toFixed(2)}%)`,
      'critical',
      { price, change: loss }
    );
  }, [addAlert]);

  const triggerVolatilityAlert = useCallback((symbol: string, change: number) => {
    const direction = change > 0 ? 'alta' : 'queda';
    return addAlert(
      'high_volatility',
      symbol,
      `Alta Volatilidade: ${symbol}`,
      `Movimento de ${Math.abs(change).toFixed(2)}% detectado (${direction})`,
      change > 5 ? 'high' : 'medium',
      { change }
    );
  }, [addAlert]);

  const triggerTrendChangeAlert = useCallback((
    symbol: string, 
    direction: 'bullish' | 'bearish',
    timeframe: string
  ) => {
    const emoji = direction === 'bullish' ? '📈' : '📉';
    const text = direction === 'bullish' ? 'ALTA' : 'BAIXA';
    return addAlert(
      'trend_change',
      symbol,
      `${emoji} Mudança de Tendência: ${symbol}`,
      `Nova tendência de ${text} detectada no ${timeframe}`,
      'medium',
      { direction }
    );
  }, [addAlert]);

  const triggerEntrySignal = useCallback((
    symbol: string,
    type: 'LONG' | 'SHORT',
    entry: number,
    confidence: number
  ) => {
    const emoji = type === 'LONG' ? '🟢' : '🔴';
    return addAlert(
      'entry_signal',
      symbol,
      `${emoji} Novo Sinal: ${symbol} ${type}`,
      `Entrada sugerida em $${entry.toLocaleString()} (${confidence}% confiança)`,
      confidence >= 80 ? 'high' : 'medium',
      { price: entry }
    );
  }, [addAlert]);

  const markAsRead = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, read: true } : alert
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setAlerts(prev => prev.map(alert => ({ ...alert, read: true })));
    setUnreadCount(0);
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setUnreadCount(0);
  }, []);

  return {
    alerts,
    unreadCount,
    addAlert,
    triggerTPAlert,
    triggerSLAlert,
    triggerVolatilityAlert,
    triggerTrendChangeAlert,
    triggerEntrySignal,
    markAsRead,
    markAllAsRead,
    clearAlerts,
  };
}
