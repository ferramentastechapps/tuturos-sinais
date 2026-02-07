import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { 
  IndicatorAlert, 
  IndicatorAlertType, 
  IndicatorAlertConfig, 
  DEFAULT_INDICATOR_ALERT_CONFIG,
  INDICATOR_ALERT_INFO 
} from '@/types/indicatorAlerts';
import { TechnicalIndicator } from '@/types/trading';

const STORAGE_KEY = 'indicator-alerts';
const CONFIG_KEY = 'indicator-alert-config';
const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown per alert type per symbol

interface UseIndicatorAlertsOptions {
  maxAlerts?: number;
}

export function useIndicatorAlerts(options: UseIndicatorAlertsOptions = {}) {
  const { maxAlerts = 100 } = options;
  const [alerts, setAlerts] = useState<IndicatorAlert[]>([]);
  const [config, setConfig] = useState<IndicatorAlertConfig>(DEFAULT_INDICATOR_ALERT_CONFIG);
  const lastAlertTimeRef = useRef<Map<string, number>>(new Map());

  // Load from localStorage
  useEffect(() => {
    const savedAlerts = localStorage.getItem(STORAGE_KEY);
    const savedConfig = localStorage.getItem(CONFIG_KEY);
    
    if (savedAlerts) {
      try {
        const parsed = JSON.parse(savedAlerts);
        setAlerts(parsed.map((a: IndicatorAlert) => ({
          ...a,
          timestamp: new Date(a.timestamp),
        })));
      } catch (e) {
        console.error('Failed to parse saved alerts:', e);
      }
    }
    
    if (savedConfig) {
      try {
        setConfig({ ...DEFAULT_INDICATOR_ALERT_CONFIG, ...JSON.parse(savedConfig) });
      } catch (e) {
        console.error('Failed to parse saved config:', e);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  const generateId = () => `ind_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const canTriggerAlert = useCallback((symbol: string, type: IndicatorAlertType): boolean => {
    const key = `${symbol}-${type}`;
    const lastTime = lastAlertTimeRef.current.get(key);
    if (!lastTime) return true;
    return Date.now() - lastTime >= ALERT_COOLDOWN;
  }, []);

  const addAlert = useCallback((
    type: IndicatorAlertType,
    symbol: string,
    indicatorName: string,
    value: number,
    message: string,
    direction: 'bullish' | 'bearish',
    threshold?: number
  ) => {
    if (!config.enabled) return null;
    if (!canTriggerAlert(symbol, type)) return null;

    const info = INDICATOR_ALERT_INFO[type];
    const newAlert: IndicatorAlert = {
      id: generateId(),
      type,
      symbol,
      indicatorName,
      value,
      threshold,
      message,
      timestamp: new Date(),
      read: false,
      direction,
    };

    setAlerts(prev => [newAlert, ...prev].slice(0, maxAlerts));
    lastAlertTimeRef.current.set(`${symbol}-${type}`, Date.now());

    // Show toast notification
    toast[direction === 'bullish' ? 'success' : 'warning'](
      `${info.icon} ${info.label}`,
      { description: `${symbol}: ${message}` }
    );

    return newAlert;
  }, [config.enabled, canTriggerAlert, maxAlerts]);

  const checkIndicators = useCallback((
    symbol: string,
    indicators: TechnicalIndicator[],
    currentPrice: number,
    previousIndicators?: TechnicalIndicator[]
  ) => {
    if (!config.enabled) return;

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
        // Bullish cross: histogram crosses from negative to positive
        if (prevMacd.value < 0 && macd.value >= 0) {
          addAlert(
            'macd_bullish_cross',
            symbol,
            'MACD',
            macd.value,
            `MACD cruzou acima da linha de sinal - sinal de alta`,
            'bullish'
          );
        }
        // Bearish cross: histogram crosses from positive to negative
        else if (prevMacd.value > 0 && macd.value <= 0) {
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

    // EMA Cross Alerts (Golden Cross / Death Cross)
    if (config.enableEmaCross) {
      const ema20 = getIndicator('ema 20');
      const ema50 = getIndicator('ema 50');
      const prevEma20 = getPrevIndicator('ema 20');
      const prevEma50 = getPrevIndicator('ema 50');
      
      if (ema20 && ema50 && prevEma20 && prevEma50) {
        // Golden Cross: EMA 20 crosses above EMA 50
        if (prevEma20.value < prevEma50.value && ema20.value >= ema50.value) {
          addAlert(
            'ema_golden_cross',
            symbol,
            'EMA 20/50',
            ema20.value,
            `Golden Cross: EMA 20 cruzou acima da EMA 50 - forte sinal de alta`,
            'bullish'
          );
        }
        // Death Cross: EMA 20 crosses below EMA 50
        else if (prevEma20.value > prevEma50.value && ema20.value <= ema50.value) {
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
        
        // Price touching lower band (within 0.5%)
        if (lowerDist < 0.005 || currentPrice < bbLower.value) {
          addAlert(
            'bb_lower_touch',
            symbol,
            'Bollinger Bands',
            currentPrice,
            `Preço tocou a banda inferior ($${bbLower.value.toFixed(2)}) - possível reversão de alta`,
            'bullish'
          );
        }
        // Price touching upper band (within 0.5%)
        else if (upperDist < 0.005 || currentPrice > bbUpper.value) {
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
        // Check if price just crossed above/below cloud
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

      // TK Cross
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

    // ADX Alerts - +DI/-DI Crossovers
    if (config.enableAdxCross) {
      const adx = getIndicator('adx');
      const diIndicator = getIndicator('+di');
      const prevDi = getPrevIndicator('+di');
      
      if (adx && diIndicator && prevDi) {
        // Parse +DI and -DI from the description (format: "+DI: XX.X | -DI: XX.X")
        const diMatch = diIndicator.description?.match(/\+DI:\s*([\d.]+)\s*\|\s*-DI:\s*([\d.]+)/);
        const prevDiMatch = prevDi.description?.match(/\+DI:\s*([\d.]+)\s*\|\s*-DI:\s*([\d.]+)/);
        
        if (diMatch && prevDiMatch) {
          const plusDI = parseFloat(diMatch[1]);
          const minusDI = parseFloat(diMatch[2]);
          const prevPlusDI = parseFloat(prevDiMatch[1]);
          const prevMinusDI = parseFloat(prevDiMatch[2]);
          
          // Bullish cross: +DI crosses above -DI
          if (prevPlusDI <= prevMinusDI && plusDI > minusDI) {
            addAlert(
              'adx_bullish_cross',
              symbol,
              'ADX',
              plusDI,
              `+DI (${plusDI.toFixed(1)}) cruzou acima de -DI (${minusDI.toFixed(1)}) - sinal de alta`,
              'bullish'
            );
          }
          // Bearish cross: -DI crosses above +DI
          else if (prevPlusDI >= prevMinusDI && plusDI < minusDI) {
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
        
        // Strong trend alert
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
        // Parse volatility percentage from description (format: "Volatilidade: X.XX%")
        const volMatch = atr.description.match(/Volatilidade:\s*([\d.]+)%/);
        
        if (volMatch) {
          const volatilityPercent = parseFloat(volMatch[1]);
          
          // High volatility alert
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
          }
          // Low volatility alert (potential breakout)
          else if (volatilityPercent <= config.atrLowVolatility) {
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
  }, [config, addAlert]);

  const markAsRead = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, read: true } : alert
    ));
  }, []);

  const markAllAsRead = useCallback(() => {
    setAlerts(prev => prev.map(alert => ({ ...alert, read: true })));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const deleteAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  const updateConfig = useCallback((updates: Partial<IndicatorAlertConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const unreadCount = alerts.filter(a => !a.read).length;

  return {
    alerts,
    unreadCount,
    config,
    checkIndicators,
    markAsRead,
    markAllAsRead,
    clearAlerts,
    deleteAlert,
    updateConfig,
  };
}
