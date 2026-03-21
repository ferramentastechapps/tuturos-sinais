import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';

import { 
  IndicatorAlert, 
  IndicatorAlertType, 
  IndicatorAlertConfig, 
  DEFAULT_INDICATOR_ALERT_CONFIG,
  INDICATOR_ALERT_INFO 
} from '@/types/indicatorAlerts';
import { TechnicalIndicator } from '@/types/trading';
import { useAuth } from './useAuth';

const ALERT_COOLDOWN = 5 * 60 * 1000;

interface UseIndicatorAlertsDBOptions {
  maxAlerts?: number;
}

function showNotification(
  info: { icon: string; label: string },
  symbol: string,
  message: string,
  direction: 'bullish' | 'bearish',
  browserNotifications: boolean
) {
  toast[direction === 'bullish' ? 'success' : 'warning'](
    `${info.icon} ${info.label}`,
    { description: `${symbol}: ${message}` }
  );

  if (browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`${info.icon} ${info.label} - ${symbol}`, {
        body: message,
        icon: '/favicon.ico',
        tag: `indicator-${info.label}-${symbol}`,
        requireInteraction: false,
      });
    } catch { /* ignore */ }
  }
}

export function useIndicatorAlertsDB(options: UseIndicatorAlertsDBOptions = {}) {
  const { maxAlerts = 100 } = options;
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const lastAlertTimeRef = useRef<Map<string, number>>(new Map());

  const { data: rawAlerts = [], isLoading: loadingAlerts } = useQuery<any[]>({
    queryKey: ['indicator-alerts'],
    queryFn: async () => {
      if (!isAuthenticated) return [];
      const { data } = await apiClient.get('/alerts');
      return Array.isArray(data) ? data : [];
    },
    enabled: isAuthenticated,
    refetchInterval: 10000,
  });

  const { data: rawConfig = DEFAULT_INDICATOR_ALERT_CONFIG, isLoading: loadingConfig } = useQuery<any>({
    queryKey: ['indicator-config'],
    queryFn: async () => {
      if (!isAuthenticated) return DEFAULT_INDICATOR_ALERT_CONFIG;
      const { data } = await apiClient.get('/alerts/config');
      return data || DEFAULT_INDICATOR_ALERT_CONFIG;
    },
    enabled: isAuthenticated,
  });

  const alerts: IndicatorAlert[] = rawAlerts.map(a => ({
    id: a.id,
    type: a.type as IndicatorAlertType,
    symbol: a.symbol,
    indicatorName: a.indicator_name,
    value: Number(a.value),
    threshold: a.threshold ? Number(a.threshold) : undefined,
    message: a.message,
    timestamp: new Date(a.created_at),
    read: a.read,
    direction: a.direction as 'bullish' | 'bearish',
  }));

  const config: IndicatorAlertConfig = {
    enabled: rawConfig.enabled ?? true,
    browserNotifications: rawConfig.browser_notifications ?? false,
    rsiOversold: Number(rawConfig.rsi_oversold ?? 30),
    rsiOverbought: Number(rawConfig.rsi_overbought ?? 70),
    stochOversold: Number(rawConfig.stoch_oversold ?? 20),
    stochOverbought: Number(rawConfig.stoch_overbought ?? 80),
    enableMacdCross: rawConfig.enable_macd_cross ?? true,
    enableEmaCross: rawConfig.enable_ema_cross ?? true,
    enableBollingerTouch: rawConfig.enable_bollinger_touch ?? true,
    enableIchimokuSignals: rawConfig.enable_ichimoku_signals ?? true,
    enableAdxCross: rawConfig.enable_adx_cross ?? true,
    adxStrongTrend: Number(rawConfig.adx_strong_trend ?? 25),
    enableAtrAlerts: rawConfig.enable_atr_alerts ?? true,
    atrHighVolatility: Number(rawConfig.atr_high_volatility ?? 3),
    atrLowVolatility: Number(rawConfig.atr_low_volatility ?? 1),
  };

  const addAlertMutation = useMutation({
    mutationFn: async (alertBody: any) => {
      const { data } = await apiClient.post('/alerts', alertBody);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['indicator-alerts'] })
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (updateData: any) => {
      const { data } = await apiClient.put('/alerts/config', updateData);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['indicator-config'] })
  });

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

    lastAlertTimeRef.current.set(`${symbol}-${type}`, Date.now());

    showNotification(info, symbol, message, direction, config.browserNotifications);
    
    addAlertMutation.mutate({
      type,
      symbol,
      indicator_name: indicatorName,
      value,
      threshold,
      message,
      direction
    });

    return null; // Optimistic return
  }, [config, canTriggerAlert, user, addAlertMutation]);

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
        addAlert('rsi_oversold', symbol, 'RSI (14)', rsi.value, `RSI em ${rsi.value.toFixed(1)} - zona de sobrevenda (< ${config.rsiOversold})`, 'bullish', config.rsiOversold);
      } else if (rsi.value >= config.rsiOverbought) {
        addAlert('rsi_overbought', symbol, 'RSI (14)', rsi.value, `RSI em ${rsi.value.toFixed(1)} - zona de sobrecompra (> ${config.rsiOverbought})`, 'bearish', config.rsiOverbought);
      }
    }

    // Stochastic Alerts
    const stochK = getIndicator('stochastic %k');
    if (stochK) {
      if (stochK.value <= config.stochOversold) {
        addAlert('stoch_oversold', symbol, 'Stochastic %K', stochK.value, `Stochastic em ${stochK.value.toFixed(1)} - zona de sobrevenda`, 'bullish', config.stochOversold);
      } else if (stochK.value >= config.stochOverbought) {
        addAlert('stoch_overbought', symbol, 'Stochastic %K', stochK.value, `Stochastic em ${stochK.value.toFixed(1)} - zona de sobrecompra`, 'bearish', config.stochOverbought);
      }
    }

    // MACD Cross Alerts
    if (config.enableMacdCross) {
      const macd = getIndicator('macd');
      const prevMacd = getPrevIndicator('macd');
      
      if (macd && prevMacd) {
        if (prevMacd.value < 0 && macd.value >= 0) {
          addAlert('macd_bullish_cross', symbol, 'MACD', macd.value, `MACD cruzou acima da linha de sinal - sinal de alta`, 'bullish');
        } else if (prevMacd.value > 0 && macd.value <= 0) {
          addAlert('macd_bearish_cross', symbol, 'MACD', macd.value, `MACD cruzou abaixo da linha de sinal - sinal de baixa`, 'bearish');
        }
      }
    }

    // EMA Cross
    if (config.enableEmaCross) {
      const ema20 = getIndicator('ema 20');
      const ema50 = getIndicator('ema 50');
      const prevEma20 = getPrevIndicator('ema 20');
      const prevEma50 = getPrevIndicator('ema 50');
      if (ema20 && ema50 && prevEma20 && prevEma50) {
        if (prevEma20.value < prevEma50.value && ema20.value >= ema50.value) {
          addAlert('ema_golden_cross', symbol, 'EMA 20/50', ema20.value, `Golden Cross: EMA 20 cruzou acima da EMA 50 - forte sinal de alta`, 'bullish');
        } else if (prevEma20.value > prevEma50.value && ema20.value <= ema50.value) {
          addAlert('ema_death_cross', symbol, 'EMA 20/50', ema20.value, `Death Cross: EMA 20 cruzou abaixo da EMA 50 - forte sinal de baixa`, 'bearish');
        }
      }
    }

    // Bollinger
    if (config.enableBollingerTouch) {
      const bbUpper = getIndicator('bb superior');
      const bbLower = getIndicator('bb inferior');
      if (bbUpper && bbLower) {
        const upperDist = Math.abs(currentPrice - bbUpper.value) / bbUpper.value;
        const lowerDist = Math.abs(currentPrice - bbLower.value) / bbLower.value;
        if (lowerDist < 0.005 || currentPrice < bbLower.value) {
          addAlert('bb_lower_touch', symbol, 'Bollinger Bands', currentPrice, `Preço tocou a banda inferior ($${bbLower.value.toFixed(2)}) - possível reversão de alta`, 'bullish');
        } else if (upperDist < 0.005 || currentPrice > bbUpper.value) {
          addAlert('bb_upper_touch', symbol, 'Bollinger Bands', currentPrice, `Preço tocou a banda superior ($${bbUpper.value.toFixed(2)}) - possível reversão de baixa`, 'bearish');
        }
      }
    }

    // Ichimoku
    if (config.enableIchimokuSignals) {
      const ichimoku = getIndicator('nuvem ichimoku');
      const tenkan = getIndicator('tenkan');
      const kijun = getIndicator('kijun');
      const prevTenkan = getPrevIndicator('tenkan');
      const prevKijun = getPrevIndicator('kijun');
      
      if (ichimoku) {
        if (ichimoku.signal === 'bullish' && ichimoku.description?.includes('acima')) {
          addAlert('ichimoku_bullish', symbol, 'Ichimoku Cloud', currentPrice, `Preço acima da nuvem Ichimoku - tendência de alta confirmada`, 'bullish');
        } else if (ichimoku.signal === 'bearish' && ichimoku.description?.includes('abaixo')) {
          addAlert('ichimoku_bearish', symbol, 'Ichimoku Cloud', currentPrice, `Preço abaixo da nuvem Ichimoku - tendência de baixa confirmada`, 'bearish');
        }
      }

      if (tenkan && kijun && prevTenkan && prevKijun) {
        if (prevTenkan.value < prevKijun.value && tenkan.value >= kijun.value) {
          addAlert('ichimoku_bullish', symbol, 'Ichimoku TK Cross', tenkan.value, `Tenkan-Sen cruzou acima de Kijun-Sen - sinal de alta`, 'bullish');
        } else if (prevTenkan.value > prevKijun.value && tenkan.value <= kijun.value) {
          addAlert('ichimoku_bearish', symbol, 'Ichimoku TK Cross', tenkan.value, `Tenkan-Sen cruzou abaixo de Kijun-Sen - sinal de baixa`, 'bearish');
        }
      }
    }

    // ADX
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
            addAlert('adx_bullish_cross', symbol, 'ADX', plusDI, `+DI (${plusDI.toFixed(1)}) cruzou acima de -DI (${minusDI.toFixed(1)}) - sinal de alta`, 'bullish');
          } else if (prevPlusDI >= prevMinusDI && plusDI < minusDI) {
            addAlert('adx_bearish_cross', symbol, 'ADX', minusDI, `-DI (${minusDI.toFixed(1)}) cruzou acima de +DI (${plusDI.toFixed(1)}) - sinal de baixa`, 'bearish');
          }
        }
        
        if (adx.value >= config.adxStrongTrend) {
          const direction = diIndicator.signal === 'bullish' ? 'bullish' : 'bearish';
          addAlert('adx_strong_trend', symbol, 'ADX', adx.value, `ADX em ${adx.value.toFixed(1)} indica tendência forte de ${direction === 'bullish' ? 'alta' : 'baixa'}`, direction);
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
            addAlert('atr_high_volatility', symbol, 'ATR', atr.value, `Volatilidade extrema de ${volatilityPercent.toFixed(2)}% - cautela recomendada`, 'bearish', config.atrHighVolatility);
          } else if (volatilityPercent <= config.atrLowVolatility) {
            addAlert('atr_low_volatility', symbol, 'ATR', atr.value, `Volatilidade baixa de ${volatilityPercent.toFixed(2)}% - possível acumulação antes de movimento`, 'bullish', config.atrLowVolatility);
          }
        }
      }
    }
  }, [config, addAlert, user]);

  const markAsRead = useCallback(async (alertId: string) => {
    if (!user) return;
    await apiClient.put(`/alerts/${alertId}/read`);
    queryClient.invalidateQueries({ queryKey: ['indicator-alerts'] });
  }, [user, queryClient]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    await apiClient.put('/alerts/read-all');
    queryClient.invalidateQueries({ queryKey: ['indicator-alerts'] });
  }, [user, queryClient]);

  const clearAlerts = useCallback(async () => {
    if (!user) return;
    await apiClient.delete('/alerts');
    queryClient.invalidateQueries({ queryKey: ['indicator-alerts'] });
    toast.success('Histórico de alertas limpo');
  }, [user, queryClient]);

  const deleteAlert = useCallback(async (alertId: string) => {
    if (!user) return;
    await apiClient.delete(`/alerts/${alertId}`);
    queryClient.invalidateQueries({ queryKey: ['indicator-alerts'] });
  }, [user, queryClient]);

  const updateConfig = useCallback(async (updates: Partial<IndicatorAlertConfig>) => {
    if (!user) return;
    
    // map camel case to snake case
    const dbUpdates: any = {};
    if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
    if (updates.browserNotifications !== undefined) dbUpdates.browser_notifications = updates.browserNotifications;
    if (updates.rsiOversold !== undefined) dbUpdates.rsi_oversold = updates.rsiOversold;
    if (updates.rsiOverbought !== undefined) dbUpdates.rsi_overbought = updates.rsiOverbought;
    if (updates.stochOversold !== undefined) dbUpdates.stoch_oversold = updates.stochOversold;
    if (updates.stochOverbought !== undefined) dbUpdates.stoch_overbought = updates.stochOverbought;
    if (updates.enableMacdCross !== undefined) dbUpdates.enable_macd_cross = updates.enableMacdCross;
    if (updates.enableEmaCross !== undefined) dbUpdates.enable_ema_cross = updates.enableEmaCross;
    if (updates.enableBollingerTouch !== undefined) dbUpdates.enable_bollinger_touch = updates.enableBollingerTouch;
    if (updates.enableIchimokuSignals !== undefined) dbUpdates.enable_ichimoku_signals = updates.enableIchimokuSignals;
    if (updates.enableAdxCross !== undefined) dbUpdates.enable_adx_cross = updates.enableAdxCross;
    if (updates.adxStrongTrend !== undefined) dbUpdates.adx_strong_trend = updates.adxStrongTrend;
    if (updates.enableAtrAlerts !== undefined) dbUpdates.enable_atr_alerts = updates.enableAtrAlerts;
    if (updates.atrHighVolatility !== undefined) dbUpdates.atr_high_volatility = updates.atrHighVolatility;
    if (updates.atrLowVolatility !== undefined) dbUpdates.atr_low_volatility = updates.atrLowVolatility;

    updateConfigMutation.mutate(dbUpdates);
  }, [user, updateConfigMutation]);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      toast.error('Navegador não suporta notificações');
      return false;
    }

    if (Notification.permission === 'granted') return true;

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
    loading: loadingAlerts || loadingConfig,
    isAuthenticated,
    checkIndicators,
    markAsRead,
    markAllAsRead,
    clearAlerts,
    deleteAlert,
    updateConfig,
    requestNotificationPermission,
    getNotificationStatus,
    refreshAlerts: () => queryClient.invalidateQueries({ queryKey: ['indicator-alerts'] }),
  };
}
