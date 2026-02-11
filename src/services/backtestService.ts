// ═══════════════════════════════════════════════════════════
// Backtest Service — Orchestrator for all backtest operations
// ═══════════════════════════════════════════════════════════

import { OHLCPoint } from '@/services/coingeckoOHLC';
import { fetchHistoricalData, fetchMultiSymbolData } from '@/services/historicalDataService';
import { BacktestEngine } from '@/utils/backtestEngine';
import { analyzeBacktestResults, calculateBuyAndHold } from '@/utils/backtestAnalyzer';
import { runGridSearchOptimization } from '@/utils/backtestOptimizer';
import { runWalkForwardAnalysis } from '@/utils/walkForwardAnalysis';
import {
    BacktestConfig, BacktestResult, BacktestProgress,
    OptimizationConfig, OptimizationResult,
    WalkForwardConfig, WalkForwardResult,
    DEFAULT_BACKTEST_CONFIG,
} from '@/types/backtestTypes';

const RESULTS_STORAGE_KEY = 'bt_results';
const MAX_STORED_RESULTS = 10;

// ──────────── Run Full Backtest ────────────

export const runBacktest = async (
    config: BacktestConfig,
    onProgress?: (progress: BacktestProgress) => void
): Promise<BacktestResult> => {
    const startTime = Date.now();

    // 1. Fetch data
    onProgress?.({
        phase: 'fetching_data',
        percentComplete: 0,
        message: `Buscando dados históricos para ${config.symbols.length} símbolo(s)...`,
    });

    const dataMap = await fetchMultiSymbolData(
        config.symbols,
        config.timeframe,
        config.startDate,
        config.endDate,
        (symbol, fetched, estimated) => {
            onProgress?.({
                phase: 'fetching_data',
                currentSymbol: symbol,
                percentComplete: Math.round((fetched / Math.max(estimated, 1)) * 30),
                message: `Buscando ${symbol}: ${fetched}/${estimated} candles`,
            });
        }
    );

    // 2. Run engine for each symbol
    onProgress?.({
        phase: 'warming_up',
        percentComplete: 30,
        message: 'Aquecendo indicadores...',
    });

    const engine = new BacktestEngine(config);
    let allTrades: any[] = [];
    let allEquityCurve: any[] = [];
    const symbolsList = Array.from(dataMap.keys());

    for (let si = 0; si < symbolsList.length; si++) {
        const symbol = symbolsList[si];
        const data = dataMap.get(symbol)!;

        const { trades, equityCurve } = await engine.runSymbol(symbol, data, (progress) => {
            const symbolProgress = (si / symbolsList.length) * 60;
            const barProgress = (progress.percentComplete / 100) * (60 / symbolsList.length);
            onProgress?.({
                ...progress,
                percentComplete: Math.round(30 + symbolProgress + barProgress),
            });
        });

        allTrades.push(...trades);
        allEquityCurve.push(...equityCurve);

        // Don't reset between symbols if we want cumulative equity
        // engine.reset(); // Only if we want independent simulations
    }

    // Sort equity curve by timestamp
    allEquityCurve.sort((a: any, b: any) => a.timestamp - b.timestamp);

    // 3. Analyze
    onProgress?.({
        phase: 'analyzing',
        percentComplete: 90,
        message: 'Calculando métricas...',
    });

    const metrics = analyzeBacktestResults(allTrades, allEquityCurve, config);

    // 4. Buy & Hold comparison (first symbol)
    const firstSymbol = symbolsList[0];
    const firstData = dataMap.get(firstSymbol) || [];
    const buyAndHold = calculateBuyAndHold(firstData, config.initialCapital, firstSymbol);

    const result: BacktestResult = {
        id: `bt_${Date.now()}`,
        config,
        metrics,
        trades: allTrades,
        equityCurve: allEquityCurve,
        buyAndHoldComparison: buyAndHold,
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
    };

    // 5. Save to localStorage
    saveResult(result);

    onProgress?.({
        phase: 'complete',
        percentComplete: 100,
        message: `Backtest completo! ${allTrades.length} trades em ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    });

    return result;
};

// ──────────── Quick Backtest (30 days) ────────────

export const runQuickBacktest = async (
    symbols: string[] = ['BTCUSDT'],
    onProgress?: (progress: BacktestProgress) => void
): Promise<BacktestResult> => {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const config: BacktestConfig = {
        ...DEFAULT_BACKTEST_CONFIG,
        symbols,
        startDate,
        endDate,
        timeframe: '1h',
    };

    return runBacktest(config, onProgress);
};

// ──────────── Optimization ────────────

export const runOptimization = async (
    optimConfig: OptimizationConfig,
    onProgress?: (progress: BacktestProgress) => void
): Promise<OptimizationResult> => {
    // Fetch data
    onProgress?.({
        phase: 'fetching_data',
        percentComplete: 0,
        message: 'Buscando dados para otimização...',
    });

    const dataMap = await fetchMultiSymbolData(
        optimConfig.baseConfig.symbols,
        optimConfig.baseConfig.timeframe,
        optimConfig.baseConfig.startDate,
        optimConfig.baseConfig.endDate
    );

    onProgress?.({
        phase: 'optimizing',
        percentComplete: 10,
        message: 'Iniciando grid search...',
    });

    return runGridSearchOptimization(optimConfig, dataMap, onProgress);
};

// ──────────── Walk Forward ────────────

export const runWalkForward = async (
    wfConfig: WalkForwardConfig,
    onProgress?: (progress: BacktestProgress) => void
): Promise<WalkForwardResult> => {
    onProgress?.({
        phase: 'fetching_data',
        percentComplete: 0,
        message: 'Buscando dados para Walk Forward...',
    });

    const dataMap = await fetchMultiSymbolData(
        wfConfig.baseConfig.symbols,
        wfConfig.baseConfig.timeframe,
        wfConfig.baseConfig.startDate,
        wfConfig.baseConfig.endDate
    );

    return runWalkForwardAnalysis(wfConfig, dataMap, onProgress);
};

// ──────────── Storage ────────────

const saveResult = (result: BacktestResult): void => {
    try {
        const existing = getSavedResults();

        // Only store summary (not full trades array if too large)
        const toStore = {
            ...result,
            trades: result.trades.slice(0, 200), // Limit stored trades
            equityCurve: result.equityCurve.filter((_, i) => i % 5 === 0), // Downsample
        };

        existing.unshift(toStore);

        // Keep only last N results
        while (existing.length > MAX_STORED_RESULTS) existing.pop();

        localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(existing));
    } catch (e) {
        console.warn('[BacktestService] Failed to save result:', e);
    }
};

export const getSavedResults = (): BacktestResult[] => {
    try {
        const raw = localStorage.getItem(RESULTS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

export const getLatestResult = (): BacktestResult | null => {
    const results = getSavedResults();
    return results.length > 0 ? results[0] : null;
};

export const clearSavedResults = (): void => {
    localStorage.removeItem(RESULTS_STORAGE_KEY);
};
