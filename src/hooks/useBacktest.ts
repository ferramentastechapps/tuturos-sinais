// ═══════════════════════════════════════════════════════════
// useBacktest Hook — React integration for backtesting system
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from 'react';
import {
    runBacktest, runQuickBacktest, runOptimization, runWalkForward,
    getSavedResults, getLatestResult, clearSavedResults,
} from '@/services/backtestService';
import { getActiveAlerts, dismissAlert as dismissAlertService } from '@/services/backtestAlerts';
import { exportTradesToCSV } from '@/utils/backtestAnalyzer';
import {
    BacktestConfig, BacktestResult, BacktestProgress,
    OptimizationConfig, OptimizationResult,
    WalkForwardConfig, WalkForwardResult, BacktestAlert,
    DEFAULT_BACKTEST_CONFIG,
} from '@/types/backtestTypes';

export interface UseBacktestReturn {
    // State
    isRunning: boolean;
    progress: BacktestProgress | null;
    result: BacktestResult | null;
    optimizationResult: OptimizationResult | null;
    walkForwardResult: WalkForwardResult | null;
    error: string | null;
    alerts: BacktestAlert[];

    // Actions
    startBacktest: (config: BacktestConfig) => Promise<void>;
    startQuickBacktest: (symbols?: string[]) => Promise<void>;
    startOptimization: (config: OptimizationConfig) => Promise<void>;
    startWalkForward: (config: WalkForwardConfig) => Promise<void>;
    exportCSV: () => void;
    dismissAlert: (id: string) => void;

    // Saved results
    savedResults: BacktestResult[];
    latestResult: BacktestResult | null;
    loadResult: (result: BacktestResult) => void;
    clearHistory: () => void;

    // Config
    defaultConfig: BacktestConfig;
}

export const useBacktest = (): UseBacktestReturn => {
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState<BacktestProgress | null>(null);
    const [result, setResult] = useState<BacktestResult | null>(null);
    const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
    const [walkForwardResult, setWalkForwardResult] = useState<WalkForwardResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [savedResults, setSavedResults] = useState<BacktestResult[]>(() => getSavedResults());
    const [alerts, setAlerts] = useState<BacktestAlert[]>(() => getActiveAlerts());

    const latestResult = useMemo(() => getLatestResult(), [savedResults]);

    const startBacktest = useCallback(async (config: BacktestConfig) => {
        setIsRunning(true);
        setError(null);
        setResult(null);
        setProgress({ phase: 'fetching_data', percentComplete: 0, message: 'Iniciando...' });

        try {
            const res = await runBacktest(config, setProgress);
            setResult(res);
            setSavedResults(getSavedResults());
        } catch (e: any) {
            setError(e.message || 'Erro ao executar backtest');
            setProgress({ phase: 'error', percentComplete: 0, message: e.message });
        } finally {
            setIsRunning(false);
        }
    }, []);

    const startQuickBacktest = useCallback(async (symbols?: string[]) => {
        setIsRunning(true);
        setError(null);
        setResult(null);
        setProgress({ phase: 'fetching_data', percentComplete: 0, message: 'Backtest rápido...' });

        try {
            const res = await runQuickBacktest(symbols, setProgress);
            setResult(res);
            setSavedResults(getSavedResults());
        } catch (e: any) {
            setError(e.message || 'Erro ao executar backtest rápido');
        } finally {
            setIsRunning(false);
        }
    }, []);

    const startOptimization = useCallback(async (config: OptimizationConfig) => {
        setIsRunning(true);
        setError(null);
        setOptimizationResult(null);
        setProgress({ phase: 'optimizing', percentComplete: 0, message: 'Iniciando otimização...' });

        try {
            const res = await runOptimization(config, setProgress);
            setOptimizationResult(res);
        } catch (e: any) {
            setError(e.message || 'Erro na otimização');
        } finally {
            setIsRunning(false);
        }
    }, []);

    const startWalkForward = useCallback(async (config: WalkForwardConfig) => {
        setIsRunning(true);
        setError(null);
        setWalkForwardResult(null);
        setProgress({ phase: 'walk_forward', percentComplete: 0, message: 'Iniciando Walk Forward...' });

        try {
            const res = await runWalkForward(config, setProgress);
            setWalkForwardResult(res);
        } catch (e: any) {
            setError(e.message || 'Erro no Walk Forward');
        } finally {
            setIsRunning(false);
        }
    }, []);

    const exportCSV = useCallback(() => {
        if (!result?.trades.length) return;
        const csv = exportTradesToCSV(result.trades);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backtest_${result.id}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [result]);

    const dismissAlertFn = useCallback((id: string) => {
        dismissAlertService(id);
        setAlerts(getActiveAlerts());
    }, []);

    const loadResult = useCallback((res: BacktestResult) => {
        setResult(res);
    }, []);

    const clearHistory = useCallback(() => {
        clearSavedResults();
        setSavedResults([]);
    }, []);

    return {
        isRunning,
        progress,
        result,
        optimizationResult,
        walkForwardResult,
        error,
        alerts,
        startBacktest,
        startQuickBacktest,
        startOptimization,
        startWalkForward,
        exportCSV,
        dismissAlert: dismissAlertFn,
        savedResults,
        latestResult,
        loadResult,
        clearHistory,
        defaultConfig: DEFAULT_BACKTEST_CONFIG,
    };
};
