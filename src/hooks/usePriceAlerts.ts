import { useState, useCallback, useEffect, useRef } from 'react';
import { PriceAlert, PriceAlertFormData } from '@/types/priceAlerts';
import { CryptoPair } from '@/types/trading';
import { toast } from '@/hooks/use-toast';

const STORAGE_KEY = 'price-alerts';

const loadAlerts = (): PriceAlert[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const alerts = JSON.parse(stored);
    return alerts.map((a: PriceAlert) => ({
      ...a,
      createdAt: new Date(a.createdAt),
      triggeredAt: a.triggeredAt ? new Date(a.triggeredAt) : undefined,
    }));
  } catch {
    return [];
  }
};

const saveAlerts = (alerts: PriceAlert[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
};

interface UsePriceAlertsOptions {
  pairs: CryptoPair[];
  onAlertTriggered?: (alert: PriceAlert, currentPrice: number) => void;
  enabled?: boolean;
}

export function usePriceAlerts(options: UsePriceAlertsOptions) {
  const { pairs, onAlertTriggered, enabled = true } = options;
  const [alerts, setAlerts] = useState<PriceAlert[]>(loadAlerts);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleBoAHI/NzaJuKgwlk9DSn3QuEiuT0NGecy4QLZPR0JxxLhAvk9HQm3EvDy+T0dCbcS8PL5PR0JtxLw8vk9HQm3EvDy+T0dCbcS8PL5PR0JtxLw8=');
    return () => {
      audioRef.current = null;
    };
  }, []);

  // Persist to localStorage
  useEffect(() => {
    saveAlerts(alerts);
  }, [alerts]);

  const generateId = () => `pa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addAlert = useCallback((data: PriceAlertFormData): PriceAlert => {
    const newAlert: PriceAlert = {
      id: generateId(),
      ...data,
      createdAt: new Date(),
      triggered: false,
    };
    setAlerts(prev => [newAlert, ...prev]);
    
    toast({
      title: '🔔 Alerta criado',
      description: `${data.symbol} ${data.condition === 'above' ? 'acima de' : 'abaixo de'} $${data.targetPrice.toLocaleString()}`,
    });
    
    return newAlert;
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const clearTriggeredAlerts = useCallback(() => {
    setAlerts(prev => prev.filter(a => !a.triggered));
  }, []);

  // Monitor prices
  useEffect(() => {
    if (!enabled || pairs.length === 0) return;

    const activeAlerts = alerts.filter(a => !a.triggered);
    if (activeAlerts.length === 0) return;

    activeAlerts.forEach(alert => {
      const pair = pairs.find(p => p.symbol === alert.symbol);
      if (!pair) return;

      const shouldTrigger = 
        (alert.condition === 'above' && pair.price >= alert.targetPrice) ||
        (alert.condition === 'below' && pair.price <= alert.targetPrice);

      if (shouldTrigger) {
        setAlerts(prev => prev.map(a => 
          a.id === alert.id 
            ? { ...a, triggered: true, triggeredAt: new Date() }
            : a
        ));

        // Play sound
        if (audioRef.current) {
          audioRef.current.play().catch(() => {});
        }

        // Show toast
        const emoji = alert.condition === 'above' ? '📈' : '📉';
        const text = alert.condition === 'above' ? 'subiu acima de' : 'caiu abaixo de';
        
        toast({
          title: `${emoji} Alerta de Preço: ${alert.symbol}`,
          description: `Preço ${text} $${alert.targetPrice.toLocaleString()} (atual: $${pair.price.toLocaleString()})`,
        });

        onAlertTriggered?.(alert, pair.price);
      }
    });
  }, [pairs, alerts, enabled, onAlertTriggered]);

  const activeAlerts = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  return {
    alerts,
    activeAlerts,
    triggeredAlerts,
    addAlert,
    removeAlert,
    clearTriggeredAlerts,
  };
}
