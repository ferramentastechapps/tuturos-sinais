import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  IndicatorAlert, 
  IndicatorAlertType, 
  IndicatorAlertConfig, 
  DEFAULT_INDICATOR_ALERT_CONFIG,
  INDICATOR_ALERT_INFO 
} from '@/types/indicatorAlerts';
import { TechnicalIndicator } from '@/types/trading';
import { useAuth } from './useAuth';

const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown per alert type per symbol

interface UseIndicatorAlertsDBOptions {
  maxAlerts?: number;
}

// Convert database row to IndicatorAlert
function dbRowToAlert(row: any): IndicatorAlert {
  return {
    id: row.id,
    type: row.type as IndicatorAlertType,
    symbol: row.symbol,
    indicatorName: row.indicator_name,
    value: Number(row.value),
    threshold: row.threshold ? Number(row.threshold) : undefined,
    message: row.message,
    timestamp: new Date(row.created_at),
    read: row.read,
    direction: row.direction as 'bullish' | 'bearish',
  };
}

// Convert database row to IndicatorAlertConfig
function dbRowToConfig(row: any): IndicatorAlertConfig {
  return {
    enabled: row.enabled,
    browserNotifications: row.browser_notifications,
    rsiOversold: Number(row.rsi_oversold),
    rsiOverbought: Number(row.rsi_overbought),
    stochOversold: Number(row.stoch_oversold),
    stochOverbought: Number(row.stoch_overbought),
    enableMacdCross: row.enable_macd_cross,
    enableEmaCross: row.enable_ema_cross,
    enableBollingerTouch: row.enable_bollinger_touch,
    enableIchimokuSignals: row.enable_ichimoku_signals,
    enableAdxCross: row.enable_adx_cross,
    adxStrongTrend: Number(row.adx_strong_trend),
    enableAtrAlerts: row.enable_atr_alerts,
    atrHighVolatility: Number(row.atr_high_volatility),
    atrLowVolatility: Number(row.atr_low_volatility),
  };
}

export function useIndicatorAlertsDB(options: UseIndicatorAlertsDBOptions = {}) {
  const { maxAlerts = 100 } = options;
  const { user, isAuthenticated } = useAuth();
  const [alerts, setAlerts] = useState<IndicatorAlert[]>([]);
  const [config, setConfig] = useState<IndicatorAlertConfig>(DEFAULT_INDICATOR_ALERT_CONFIG);
  const [loading, setLoading] = useState(true);
  const lastAlertTimeRef = useRef<Map<string, number>>(new Map());

  // Load alerts from database
  const loadAlerts = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('indicator_alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(maxAlerts);

      if (error) throw error;

      setAlerts(data?.map(dbRowToAlert) || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  }, [user, maxAlerts]);

  // Load config from database
  const loadConfig = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('indicator_alert_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(dbRowToConfig(data));
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }, [user]);

  // Load data when user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      setLoading(true);
      Promise.all([loadAlerts(), loadConfig()]).finally(() => setLoading(false));
    } else {
      setAlerts([]);
      setConfig(DEFAULT_INDICATOR_ALERT_CONFIG);
      setLoading(false);
    }
  }, [isAuthenticated, user, loadAlerts, loadConfig]);

  const canTriggerAlert = useCallback((symbol: string, type: IndicatorAlertType): boolean => {
    const key = `${symbol}-${type}`;
    const lastTime = lastAlertTimeRef.current.get(key);
    if (!lastTime) return true;
    return Date.now() - lastTime >= ALERT_COOLDOWN;
  }, []);

  const addAlert = useCallback(async (
    type: IndicatorAlertType,
    symbol: string,
    indicatorName: string,
    value: number,
    message: string,
    direction: 'bullish' | 'bearish',
    threshold?: number
  ): Promise<IndicatorAlert | null> => {
    if (!config.enabled) return null;
    if (!canTriggerAlert(symbol, type)) return null;
    if (!user) return null;

    const info = INDICATOR_ALERT_INFO[type];

    try {
      const { data, error } = await supabase
        .from('indicator_alerts')
        .insert({
          user_id: user.id,
          type,
          symbol,
          indicator_name: indicatorName,
          value,
          threshold,
          message,
          direction,
        })
        .select()
        .single();

      if (error) throw error;

      const newAlert = dbRowToAlert(data);
      setAlerts(prev => [newAlert, ...prev].slice(0, maxAlerts));
      lastAlertTimeRef.current.set(`${symbol}-${type}`, Date.now());

      // Show toast notification
      toast[direction === 'bullish' ? 'success' : 'warning'](
        `${info.icon} ${info.label}`,
        { description: `${symbol}: ${message}` }
      );

      // Send browser notification if enabled
      if (config.browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`${info.icon} ${info.label} - ${symbol}`, {
            body: message,
            icon: '/favicon.ico',
            tag: `indicator-${type}-${symbol}`,
            requireInteraction: false,
          });
        } catch (e) {
          console.error('Failed to show browser notification:', e);
        }
      }

      return newAlert;
    } catch (error) {
      console.error('Error adding alert:', error);
      return null;
    }
  }, [config.enabled, config.browserNotifications, canTriggerAlert, user, maxAlerts]);

  const checkIndicators = useCallback((
    symbol: string,
    indicators: TechnicalIndicator[],
    currentPrice: number,
    previousIndicators?: TechnicalIndicator[]
  ) => {
    if (!config.enabled || !user) return;

    const getIndicator = (name: string) => indicators.find(i => i.name.toLowerCase().includes(name.toLowerCase()));
    const getPrevIndicator = (name: string) => previousIndicators?.find(i => i.name.toLowerCase().includes(name.toLowerCase()));

    // RSI Alerts
    const rsi = getIndicator('rsi');
    if (rsi) {
      if (rsi.value <= config.rsiOversold) {
        addAlert(
          'rsi_oversold',
          symbol,
          'RSI (14)',
          rsi.value,
          `RSI em ${rsi.value.toFixed(1)} - zona de sobrevenda (< ${config.rsiOversold})`,
          'bullish',
          config.rsiOversold
        );
      } else if (rsi.value >= config.rsiOverbought) {
        addAlert(
          'rsi_overbought',
          symbol,
          'RSI (14)',
          rsi.value,
          `RSI em ${rsi.value.toFixed(1)} - zona de sobrecompra (> ${config.rsiOverbought})`,
          'bearish',
          config.rsiOverbought
        );
      }
    }

    // Stochastic Alerts
    const stochK = getIndicator('stochastic %k');
    if (stochK) {
      if (stochK.value <= config.stochOversold) {
        addAlert(
          'stoch_oversold',
          symbol,
          'Stochastic %K',
          stochK.value,
          `Stochastic em ${stochK.value.toFixed(1)} - zona de sobrevenda`,
          'bullish',
          config.stochOversold
        );
      } else if (stochK.value >= config.stochOverbought) {
        addAlert(
          'stoch_overbought',
          symbol,
          'Stochastic %K',
          stochK.value,
          `Stochastic em ${stochK.value.toFixed(1)} - zona de sobrecompra`,
          'bearish',
          config.stochOverbought
        );
      }
    }

    // MACD Cross Alerts
    if (config.enableMacdCross) {
      const macd = getIndicator('macd');
      const prevMacd = getPrevIndicator('macd');
      
      if (macd && prevMacd) {
        if (prevMacd.value < 0 && macd.value >= 0) {
          addAlert(
            'macd_bullish_cross',
            symbol,
            'MACD',
            macd.value,
            `MACD cruzou acima da linha de sinal - sinal de alta`,
            'bullish'
          );
        } else if (prevMacd.value > 0 && macd.value <= 0) {
          addAlert(
            'macd_bearish_cross',
            symbol,
            'MACD',
            macd.value,
            `MACD cruzou abaixo da linha de sinal - sinal de baixa`,
            'bearish'
          );
        }
      }
    }

    // EMA Cross Alerts
    if (config.enableEmaCross) {
      const ema20 = getIndicator('ema 20');
      const ema50 = getIndicator('ema 50');
      const prevEma20 = getPrevIndicator('ema 20');
      const prevEma50 = getPrevIndicator('ema 50');
      
      if (ema20 && ema50 && prevEma20 && prevEma50) {
        if (prevEma20.value < prevEma50.value && ema20.value >= ema50.value) {
          addAlert(
            'ema_golden_cross',
            symbol,
            'EMA 20/50',
            ema20.value,
            `Golden Cross: EMA 20 cruzou acima da EMA 50 - forte sinal de alta`,
            'bullish'
          );
        } else if (prevEma20.value > prevEma50.value && ema20.value <= ema50.value) {
          addAlert(
            'ema_death_cross',
            symbol,
            'EMA 20/50',
            ema20.value,
            `Death Cross: EMA 20 cruzou abaixo da EMA 50 - forte sinal de baixa`,
            'bearish'
          );
        }
      }
    }

    // Bollinger Bands Touch Alerts
    if (config.enableBollingerTouch) {
      const bbUpper = getIndicator('bb superior');
      const bbLower = getIndicator('bb inferior');
      
      if (bbUpper && bbLower) {
        const upperDist = Math.abs(currentPrice - bbUpper.value) / bbUpper.value;
        const lowerDist = Math.abs(currentPrice - bbLower.value) / bbLower.value;
        
        if (lowerDist < 0.005 || currentPrice < bbLower.value) {
          addAlert(
            'bb_lower_touch',
            symbol,
            'Bollinger Bands',
            currentPrice,
            `Preço tocou a banda inferior ($${bbLower.value.toFixed(2)}) - possível reversão de alta`,
            'bullish'
          );
        } else if (upperDist < 0.005 || currentPrice > bbUpper.value) {
          addAlert(
            'bb_upper_touch',
            symbol,
            'Bollinger Bands',
            currentPrice,
            `Preço tocou a banda superior ($${bbUpper.value.toFixed(2)}) - possível reversão de baixa`,
            'bearish'
          );
        }
      }
    }

    // Ichimoku Cloud Alerts
    if (config.enableIchimokuSignals) {
      const ichimoku = getIndicator('nuvem ichimoku');
      const tenkan = getIndicator('tenkan');
      const kijun = getIndicator('kijun');
      const prevTenkan = getPrevIndicator('tenkan');
      const prevKijun = getPrevIndicator('kijun');
      
      if (ichimoku) {
        if (ichimoku.signal === 'bullish' && ichimoku.description?.includes('acima')) {
          addAlert(
            'ichimoku_bullish',
            symbol,
            'Ichimoku Cloud',
            currentPrice,
            `Preço acima da nuvem Ichimoku - tendência de alta confirmada`,
            'bullish'
          );
        } else if (ichimoku.signal === 'bearish' && ichimoku.description?.includes('abaixo')) {
          addAlert(
            'ichimoku_bearish',
            symbol,
            'Ichimoku Cloud',
            currentPrice,
            `Preço abaixo da nuvem Ichimoku - tendência de baixa confirmada`,
            'bearish'
          );
        }
      }

      if (tenkan && kijun && prevTenkan && prevKijun) {
        if (prevTenkan.value < prevKijun.value && tenkan.value >= kijun.value) {
          addAlert(
            'ichimoku_bullish',
            symbol,
            'Ichimoku TK Cross',
            tenkan.value,
            `Tenkan-Sen cruzou acima de Kijun-Sen - sinal de alta`,
            'bullish'
          );
        } else if (prevTenkan.value > prevKijun.value && tenkan.value <= kijun.value) {
          addAlert(
            'ichimoku_bearish',
            symbol,
            'Ichimoku TK Cross',
            tenkan.value,
            `Tenkan-Sen cruzou abaixo de Kijun-Sen - sinal de baixa`,
            'bearish'
          );
        }
      }
    }

    // ADX Alerts
    if (config.enableAdxCross) {
      const adx = getIndicator('adx');
      const diIndicator = getIndicator('+di');
      const prevDi = getPrevIndicator('+di');
      
      if (adx && diIndicator && prevDi) {
        const diMatch = diIndicator.description?.match(/\+DI:\s*([\d.]+)\s*\|\s*-DI:\s*([\d.]+)/);
        const prevDiMatch = prevDi.description?.match(/\+DI:\s*([\d.]+)\s*\|\s*-DI:\s*([\d.]+)/);
        
        if (diMatch && prevDiMatch) {
          const plusDI = parseFloat(diMatch[1]);
          const minusDI = parseFloat(diMatch[2]);
          const prevPlusDI = parseFloat(prevDiMatch[1]);
          const prevMinusDI = parseFloat(prevDiMatch[2]);
          
          if (prevPlusDI <= prevMinusDI && plusDI > minusDI) {
            addAlert(
              'adx_bullish_cross',
              symbol,
              'ADX',
              plusDI,
              `+DI (${plusDI.toFixed(1)}) cruzou acima de -DI (${minusDI.toFixed(1)}) - sinal de alta`,
              'bullish'
            );
          } else if (prevPlusDI >= prevMinusDI && plusDI < minusDI) {
            addAlert(
              'adx_bearish_cross',
              symbol,
              'ADX',
              minusDI,
              `-DI (${minusDI.toFixed(1)}) cruzou acima de +DI (${plusDI.toFixed(1)}) - sinal de baixa`,
              'bearish'
            );
          }
        }
        
        if (adx.value >= config.adxStrongTrend) {
          const direction = diIndicator.signal === 'bullish' ? 'bullish' : 'bearish';
          addAlert(
            'adx_strong_trend',
            symbol,
            'ADX',
            adx.value,
            `ADX em ${adx.value.toFixed(1)} indica tendência forte de ${direction === 'bullish' ? 'alta' : 'baixa'}`,
            direction
          );
        }
      }
    }

    // ATR Volatility Alerts
    if (config.enableAtrAlerts) {
      const atr = getIndicator('atr');
      
      if (atr && atr.description) {
        const volMatch = atr.description.match(/Volatilidade:\s*([\d.]+)%/);
        
        if (volMatch) {
          const volatilityPercent = parseFloat(volMatch[1]);
          
          if (volatilityPercent >= config.atrHighVolatility) {
            addAlert(
              'atr_high_volatility',
              symbol,
              'ATR',
              atr.value,
              `Volatilidade extrema de ${volatilityPercent.toFixed(2)}% - cautela recomendada`,
              'bearish',
              config.atrHighVolatility
            );
          } else if (volatilityPercent <= config.atrLowVolatility) {
            addAlert(
              'atr_low_volatility',
              symbol,
              'ATR',
              atr.value,
              `Volatilidade baixa de ${volatilityPercent.toFixed(2)}% - possível acumulação antes de movimento`,
              'bullish',
              config.atrLowVolatility
            );
          }
        }
      }
    }
  }, [config, addAlert, user]);

  const markAsRead = useCallback(async (alertId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('indicator_alerts')
        .update({ read: true })
        .eq('id', alertId)
        .eq('user_id', user.id);

      if (error) throw error;

      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, read: true } : alert
      ));
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('indicator_alerts')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;

      setAlerts(prev => prev.map(alert => ({ ...alert, read: true })));
    } catch (error) {
      console.error('Error marking all alerts as read:', error);
    }
  }, [user]);

  const clearAlerts = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('indicator_alerts')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setAlerts([]);
      toast.success('Histórico de alertas limpo');
    } catch (error) {
      console.error('Error clearing alerts:', error);
      toast.error('Erro ao limpar alertas');
    }
  }, [user]);

  const deleteAlert = useCallback(async (alertId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('indicator_alerts')
        .delete()
        .eq('id', alertId)
        .eq('user_id', user.id);

      if (error) throw error;

      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  }, [user]);

  const updateConfig = useCallback(async (updates: Partial<IndicatorAlertConfig>) => {
    if (!user) return;

    const newConfig = { ...config, ...updates };
    setConfig(newConfig);

    try {
      const { error } = await supabase
        .from('indicator_alert_config')
        .update({
          enabled: newConfig.enabled,
          browser_notifications: newConfig.browserNotifications,
          rsi_oversold: newConfig.rsiOversold,
          rsi_overbought: newConfig.rsiOverbought,
          stoch_oversold: newConfig.stochOversold,
          stoch_overbought: newConfig.stochOverbought,
          enable_macd_cross: newConfig.enableMacdCross,
          enable_ema_cross: newConfig.enableEmaCross,
          enable_bollinger_touch: newConfig.enableBollingerTouch,
          enable_ichimoku_signals: newConfig.enableIchimokuSignals,
          enable_adx_cross: newConfig.enableAdxCross,
          adx_strong_trend: newConfig.adxStrongTrend,
          enable_atr_alerts: newConfig.enableAtrAlerts,
          atr_high_volatility: newConfig.atrHighVolatility,
          atr_low_volatility: newConfig.atrLowVolatility,
        })
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error('Erro ao salvar configurações');
    }
  }, [user, config]);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      toast.error('Navegador não suporta notificações');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      toast.error('Notificações bloqueadas. Habilite nas configurações do navegador.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast.success('Notificações ativadas!');
        return true;
      } else {
        toast.error('Permissão de notificações negada');
        return false;
      }
    } catch (e) {
      console.error('Error requesting notification permission:', e);
      return false;
    }
  }, []);

  const getNotificationStatus = useCallback((): 'granted' | 'denied' | 'default' | 'unsupported' => {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }, []);

  const unreadCount = alerts.filter(a => !a.read).length;

  return {
    alerts,
    unreadCount,
    config,
    loading,
    isAuthenticated,
    checkIndicators,
    markAsRead,
    markAllAsRead,
    clearAlerts,
    deleteAlert,
    updateConfig,
    requestNotificationPermission,
    getNotificationStatus,
    refreshAlerts: loadAlerts,
  };
}
