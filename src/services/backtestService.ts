// ═══════════════════════════════════════════════════════════
// Backtest Service — Orchestrator for all backtest operations
// ═══════════════════════════════════════════════════════════

import { OHLCPoint } from '@/services/coingeckoOHLC';
import { fetchMultiSymbolData } from '@/services/historicalDataService';
import {
    BacktestConfig, BacktestResult, BacktestProgress,
    OptimizationConfig, OptimizationResult,
    WalkForwardConfig, WalkForwardResult,
    DEFAULT_BACKTEST_CONFIG,
} from '@/types/backtestTypes';

const RESULTS_STORAGE_KEY = 'bt_results';
const MAX_STORED_RESULTS = 10;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Helpers
const getApiUrl = (endpoint: string) => `${API_BASE_URL.replace(/\/$/, '')}/api/backtest${endpoint}`;

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

    const ohlcData = Object.fromEntries(dataMap);
    const totalCandles = Object.values(ohlcData).reduce((s, c) => s + c.length, 0);
    console.log(`[BacktestService] OHLC pronto: ${Object.keys(ohlcData).join(', ')} | total ${totalCandles} candles`);

    if (totalCandles === 0) {
        throw new Error('Nenhum dado histórico encontrado. Verifique se o backend está rodando e se a Bybit está acessível.');
    }

    onProgress?.({
        phase: 'warming_up',
        percentComplete: 35,
        message: `Enviando ${totalCandles} candles para o motor de backtest...`,
    });

    console.log(`[BacktestService] Enviando para API: ${getApiUrl('/run')}`);
    const t0 = Date.now();

    // 2. Run engine via Backend API
    const response = await fetch(getApiUrl('/run'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config, ohlcData }),
    });

    if (!response.ok) {
        let errorMsg = `Erro na API: ${response.statusText}`;
        try {
            const errBody = await response.json();
            errorMsg = errBody.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
    }

    onProgress?.({
        phase: 'analyzing',
        percentComplete: 90,
        message: 'Recebendo e formatando resultados...',
    });

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.error || 'Erro desconhecido na execução');
    }

    const apiMs = Date.now() - t0;
    console.log(`[BacktestService] API respondeu em ${(apiMs/1000).toFixed(1)}s | ${data.trades?.length ?? 0} trades | PnL: ${data.metrics?.main?.totalPnLPercent?.toFixed(2) ?? '?'}% | WR: ${data.metrics?.main?.winRate?.toFixed(1) ?? '?'}%`);

    const result: BacktestResult = {
        id: `bt_${Date.now()}`,
        config,
        metrics: data.metrics,
        trades: data.trades,
        equityCurve: data.equityCurve,
        buyAndHoldComparison: data.buyAndHold,
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
    };

    // 5. Save to localStorage
    saveResult(result);

    onProgress?.({
        phase: 'complete',
        percentComplete: 100,
        message: `Backtest completo! ${data.trades.length} trades em ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    });

    return result;
};

// ──────────── Quick Backtest (90 days with bot config) ────────────

export const runQuickBacktest = async (
    symbols?: string[],
    onProgress?: (progress: BacktestProgress) => void
): Promise<BacktestResult> => {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Try to load bot settings, fall back to defaults
    const botConfig = await loadBotConfig().catch(() => null);

    const config: BacktestConfig = {
        ...DEFAULT_BACKTEST_CONFIG,
        ...botConfig,
        symbols: symbols ?? botConfig?.symbols ?? ['BTCUSDT'],
        startDate,
        endDate,
        timeframe: '1h',
    };

    return runBacktest(config, onProgress);
};

// ──────────── Load Bot Settings as BacktestConfig ────────────

export const loadBotConfig = async (): Promise<Partial<BacktestConfig>> => {
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    
    const [portfolioRes, marketRes] = await Promise.all([
        fetch(`${apiUrl}/api/portfolio`, { credentials: 'include' }).catch(() => null),
        fetch(`${apiUrl}/api/market`, { credentials: 'include' }).catch(() => null)
    ]);

    if (!portfolioRes?.ok && !marketRes?.ok) {
        throw new Error('Não foi possível acessar a API do servidor');
    }

    const partial: Partial<BacktestConfig> = {};

    if (portfolioRes?.ok) {
        const pData = await portfolioRes.json();
        const auto = pData?.config?.autoTrade;
        if (auto) {
            partial.signal = { 
                ...(partial.signal ?? DEFAULT_BACKTEST_CONFIG.signal), 
                minScore: Number(auto.minScore ?? 75),
                maxSimultaneousPositions: Number(auto.maxSimultaneousPositions ?? 5)
            };
        }
    }

    if (marketRes?.ok) {
        const mData = await marketRes.json();
        if (Array.isArray(mData) && mData.length > 0) {
            partial.symbols = mData.map((m: any) => m.symbol.replace('/', '').toUpperCase());
        }
    }

    return partial;
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
    const ohlcData = Object.fromEntries(dataMap);

    onProgress?.({
        phase: 'optimizing',
        percentComplete: 20,
        message: 'Processando grid search no servidor...',
    });

    const response = await fetch(getApiUrl('/optimize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optimizationConfig: optimConfig, ohlcData }),
    });

    if (!response.ok) {
        let errorMsg = `Erro na API: ${response.statusText}`;
        try {
            const errBody = await response.json();
            errorMsg = errBody.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
    }

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.error || 'Erro desconhecido na otimização');
    }

    return data.results;
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
    const ohlcData = Object.fromEntries(dataMap);

    onProgress?.({
        phase: 'walk_forward',
        percentComplete: 20,
        message: 'Processando Walk Forward no servidor...',
    });

    const response = await fetch(getApiUrl('/walk-forward'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wfConfig, ohlcData }),
    });

    if (!response.ok) {
        let errorMsg = `Erro na API: ${response.statusText}`;
        try {
            const errBody = await response.json();
            errorMsg = errBody.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
    }

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.error || 'Erro desconhecido no Walk Forward');
    }

    return data.results;
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
