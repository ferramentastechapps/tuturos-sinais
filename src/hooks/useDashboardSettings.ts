import { useState, useEffect } from 'react';

export interface DashboardSettings {
  showPortfolioValue: boolean;
  showRecentTrades: boolean;
  showActiveAlerts: boolean;
  showHistoricalSignals: boolean;
  showBacktest: boolean;
  showSignalsPanel: boolean;
  showRiskCalculator: boolean;
  showIndicatorAlerts: boolean;
  showPriceAlerts: boolean;
  showTechnicalAnalysis: boolean;
  showActivePositions: boolean;
  showAdvancedChart: boolean;
  showAlertDemo: boolean;
}

const defaultSettings: DashboardSettings = {
  showPortfolioValue: true,
  showRecentTrades: true,
  showActiveAlerts: true,
  showHistoricalSignals: true,
  showBacktest: true,
  showSignalsPanel: true,
  showRiskCalculator: true,
  showIndicatorAlerts: true,
  showPriceAlerts: true,
  showTechnicalAnalysis: true,
  showActivePositions: true,
  showAdvancedChart: true,
  showAlertDemo: import.meta.env.DEV, // default true in dev
};

export const useDashboardSettings = () => {
  const [settings, setSettings] = useState<DashboardSettings>(() => {
    try {
      const stored = localStorage.getItem('dashboard_settings');
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to parse dashboard settings:', error);
    }
    return defaultSettings;
  });

  useEffect(() => {
    try {
      localStorage.setItem('dashboard_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save dashboard settings:', error);
    }
  }, [settings]);

  const toggleSetting = (key: keyof DashboardSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const updateSetting = (key: keyof DashboardSettings, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return {
    settings,
    toggleSetting,
    updateSetting,
  };
};
