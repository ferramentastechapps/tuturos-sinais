// ═══════════════════════════════════════════════════════════
// Backtest Alerts — Divergence detection (Real vs Backtest)
// ═══════════════════════════════════════════════════════════

import { BacktestAlert, BacktestResult } from '@/types/backtestTypes';

const ALERTS_KEY = 'bt_alerts';

// ──────────── Check Divergence ────────────

export interface RealPerformanceData {
    winRate: number;           // % real atual
    maxDrawdownPercent: number; // drawdown real atual
    totalTrades: number;
    recentVolatility: number;  // volatilidade recente (ATR ratio)
}

/**
 * Compara performance real com baseline do backtest.
 * Retorna alertas se houver divergência significativa.
 */
export const checkPerformanceDivergence = (
    backtestResult: BacktestResult,
    realPerformance: RealPerformanceData
): BacktestAlert[] => {
    const alerts: BacktestAlert[] = [];
    const now = Date.now();

    // 1. Win Rate Drift (>15% abaixo do backtest)
    const btWinRate = backtestResult.metrics.main.winRate;
    const winRateDiff = btWinRate - realPerformance.winRate;

    if (winRateDiff > 15) {
        alerts.push({
            id: `alert_wr_${now}`,
            type: 'win_rate_drift',
            severity: winRateDiff > 25 ? 'critical' : 'warning',
            message: `Win rate real (${realPerformance.winRate.toFixed(1)}%) está ${winRateDiff.toFixed(1)}% abaixo do backtest (${btWinRate.toFixed(1)}%).`,
            backtestValue: btWinRate,
            realValue: realPerformance.winRate,
            deviation: winRateDiff,
            timestamp: now,
            dismissed: false,
        });
    }

    // 2. Drawdown excede máximo do backtest
    const btMaxDD = backtestResult.metrics.risk.maxDrawdownPercent;
    if (realPerformance.maxDrawdownPercent > btMaxDD) {
        const excess = realPerformance.maxDrawdownPercent - btMaxDD;
        alerts.push({
            id: `alert_dd_${now}`,
            type: 'drawdown_exceeded',
            severity: 'critical',
            message: `Drawdown real (${realPerformance.maxDrawdownPercent.toFixed(1)}%) excede o máximo do backtest (${btMaxDD.toFixed(1)}%) em ${excess.toFixed(1)}%.`,
            backtestValue: btMaxDD,
            realValue: realPerformance.maxDrawdownPercent,
            deviation: excess,
            timestamp: now,
            dismissed: false,
        });
    }

    // 3. Mudança de regime de mercado
    if (realPerformance.recentVolatility > 2.0) {
        alerts.push({
            id: `alert_regime_${now}`,
            type: 'market_regime_change',
            severity: 'warning',
            message: `Volatilidade recente (${realPerformance.recentVolatility.toFixed(1)}x média) sugere mudança de regime. Considere re-rodar o backtest.`,
            backtestValue: 1.0,
            realValue: realPerformance.recentVolatility,
            deviation: (realPerformance.recentVolatility - 1) * 100,
            timestamp: now,
            dismissed: false,
        });
    }

    // 4. Backtest muito antigo (>30 dias)
    const backtestAge = now - backtestResult.timestamp;
    const maxAge = 30 * 24 * 60 * 60 * 1000;
    if (backtestAge > maxAge) {
        alerts.push({
            id: `alert_revalidation_${now}`,
            type: 'revalidation_needed',
            severity: 'info',
            message: `Último backtest tem ${Math.round(backtestAge / (24 * 60 * 60 * 1000))} dias. Recomendado rodar novo backtest para revalidar a estratégia.`,
            backtestValue: maxAge,
            realValue: backtestAge,
            deviation: ((backtestAge - maxAge) / maxAge) * 100,
            timestamp: now,
            dismissed: false,
        });
    }

    return alerts;
};

// ──────────── Storage ────────────

export const saveAlerts = (alerts: BacktestAlert[]): void => {
    try {
        const existing = getAlerts();
        existing.push(...alerts);
        // Keep last 50
        while (existing.length > 50) existing.shift();
        localStorage.setItem(ALERTS_KEY, JSON.stringify(existing));
    } catch (e) {
        console.warn('[BacktestAlerts] save error:', e);
    }
};

export const getAlerts = (): BacktestAlert[] => {
    try {
        const raw = localStorage.getItem(ALERTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

export const dismissAlert = (alertId: string): void => {
    const alerts = getAlerts();
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
        alert.dismissed = true;
        localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
    }
};

export const getActiveAlerts = (): BacktestAlert[] => {
    return getAlerts().filter(a => !a.dismissed);
};

export const clearAlerts = (): void => {
    localStorage.removeItem(ALERTS_KEY);
};
