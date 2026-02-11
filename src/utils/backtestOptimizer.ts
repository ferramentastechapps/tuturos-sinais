// ═══════════════════════════════════════════════════════════
// Backtest Optimizer — Grid Search Parameter Optimization
// Tests multiple parameter combinations and ranks results
// ═══════════════════════════════════════════════════════════

import { OHLCPoint } from '@/services/coingeckoOHLC';
import { BacktestEngine } from '@/utils/backtestEngine';
import { analyzeBacktestResults } from '@/utils/backtestAnalyzer';
import {
    BacktestConfig, OptimizationConfig, OptimizationResult,
    OptimizationEntry, BacktestProgress,
} from '@/types/backtestTypes';

// ──────────── Grid Search ────────────

/**
 * Executa otimização por grid search.
 * Testa todas as combinações de parâmetros e retorna ranking.
 */
export const runGridSearchOptimization = async (
    optimConfig: OptimizationConfig,
    dataMap: Map<string, OHLCPoint[]>,
    onProgress?: (progress: BacktestProgress) => void
): Promise<OptimizationResult> => {
    const startTime = Date.now();

    // Generate all parameter combinations
    const combinations = generateCombinations(optimConfig.parameters);
    const totalCombos = combinations.length;

    if (totalCombos > (optimConfig.maxCombinations || 500)) {
        console.warn(`[Optimizer] ${totalCombos} combinations exceeds limit. Truncating.`);
        combinations.splice(optimConfig.maxCombinations || 500);
    }

    const entries: OptimizationEntry[] = [];

    for (let i = 0; i < combinations.length; i++) {
        const combo = combinations[i];

        onProgress?.({
            phase: 'optimizing',
            percentComplete: Math.round((i / totalCombos) * 100),
            message: `Otimizando: ${i + 1}/${totalCombos} combinações`,
            currentBar: i,
            totalBars: totalCombos,
        });

        // Apply parameter overrides to config
        const testConfig = applyParamsToConfig(optimConfig.baseConfig, combo);

        // Run backtest with this config
        const engine = new BacktestEngine(testConfig);
        let allTrades: any[] = [];
        let allEquity: any[] = [];

        for (const [symbol, data] of dataMap) {
            const { trades, equityCurve } = await engine.runSymbol(symbol, data);
            allTrades.push(...trades);
            allEquity.push(...equityCurve);
            engine.reset();
        }

        if (allTrades.length === 0) continue;

        // Analyze
        const metrics = analyzeBacktestResults(allTrades, allEquity, testConfig);

        entries.push({
            rank: 0, // Will be set after sorting
            params: combo,
            totalPnL: metrics.main.totalPnL,
            totalPnLPercent: metrics.main.totalPnLPercent,
            winRate: metrics.main.winRate,
            sharpeRatio: metrics.risk.sharpeRatio,
            maxDrawdownPercent: metrics.risk.maxDrawdownPercent,
            profitFactor: metrics.risk.profitFactor,
            totalTrades: metrics.main.totalTrades,
        });
    }

    // Sort and rank by chosen criterion
    const sortedByProfit = [...entries].sort((a, b) => b.totalPnL - a.totalPnL);
    const sortedBySharpe = [...entries].sort((a, b) => b.sharpeRatio - a.sharpeRatio);
    const sortedByDD = [...entries].sort((a, b) => a.maxDrawdownPercent - b.maxDrawdownPercent);
    const sortedByRiskAdj = [...entries].sort((a, b) => {
        const scoreA = a.sharpeRatio * a.profitFactor / Math.max(a.maxDrawdownPercent, 1);
        const scoreB = b.sharpeRatio * b.profitFactor / Math.max(b.maxDrawdownPercent, 1);
        return scoreB - scoreA;
    });

    // Rank entries by selected criterion
    let ranked: OptimizationEntry[];
    switch (optimConfig.rankBy) {
        case 'sharpe': ranked = sortedBySharpe; break;
        case 'drawdown': ranked = sortedByDD; break;
        case 'riskAdjusted': ranked = sortedByRiskAdj; break;
        default: ranked = sortedByProfit;
    }
    ranked.forEach((e, i) => e.rank = i + 1);

    // Overfitting detection
    const overfittingWarnings = detectOverfitting(entries, optimConfig);

    return {
        id: `opt_${Date.now()}`,
        totalCombinations: totalCombos,
        completedCombinations: entries.length,
        results: ranked,
        bestByProfit: sortedByProfit[0] || createEmptyEntry(),
        bestBySharpe: sortedBySharpe[0] || createEmptyEntry(),
        bestByDrawdown: sortedByDD[0] || createEmptyEntry(),
        bestByRiskAdjusted: sortedByRiskAdj[0] || createEmptyEntry(),
        overfittingWarnings,
        timestamp: Date.now(),
    };
};

// ──────────── Helpers ────────────

const generateCombinations = (
    params: OptimizationConfig['parameters']
): Record<string, number>[] => {
    if (params.length === 0) return [{}];

    const result: Record<string, number>[] = [];

    const generate = (index: number, current: Record<string, number>): void => {
        if (index >= params.length) {
            result.push({ ...current });
            return;
        }

        const param = params[index];
        for (const value of param.values) {
            current[param.field] = value;
            generate(index + 1, current);
        }
    };

    generate(0, {});
    return result;
};

const applyParamsToConfig = (
    baseConfig: BacktestConfig,
    params: Record<string, number>
): BacktestConfig => {
    const config = JSON.parse(JSON.stringify(baseConfig)) as BacktestConfig;

    for (const [field, value] of Object.entries(params)) {
        const parts = field.split('.');
        let obj: any = config;
        for (let i = 0; i < parts.length - 1; i++) {
            if (obj[parts[i]] === undefined) break;
            obj = obj[parts[i]];
        }
        const lastKey = parts[parts.length - 1];
        if (obj && lastKey in obj) {
            obj[lastKey] = value;
        }
    }

    return config;
};

const detectOverfitting = (
    entries: OptimizationEntry[],
    config: OptimizationConfig
): string[] => {
    const warnings: string[] = [];

    if (entries.length < 3) return warnings;

    // Check if best params are at extreme values
    for (const param of config.parameters) {
        const bestEntry = entries.sort((a, b) => b.totalPnL - a.totalPnL)[0];
        const bestValue = bestEntry.params[param.field];

        if (bestValue === param.values[0] || bestValue === param.values[param.values.length - 1]) {
            warnings.push(
                `⚠️ Parâmetro "${param.name}" otimizou no valor extremo (${bestValue}). Considere expandir o range de teste.`
            );
        }
    }

    // Check if top results have high variance
    const topResults = entries.sort((a, b) => b.totalPnL - a.totalPnL).slice(0, 5);
    const pnlValues = topResults.map(e => e.totalPnLPercent);
    const mean = pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length;
    const variance = pnlValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / pnlValues.length;
    const cv = Math.sqrt(variance) / Math.abs(mean || 1); // Coef. de variação

    if (cv > 0.5) {
        warnings.push(
            `⚠️ Alta variação nos top resultados (CV: ${(cv * 100).toFixed(1)}%). Resultados podem ser sensíveis a overfitting.`
        );
    }

    // Check if best result has very few trades
    const bestByProfit = entries.sort((a, b) => b.totalPnL - a.totalPnL)[0];
    if (bestByProfit.totalTrades < 10) {
        warnings.push(
            `⚠️ Melhor resultado tem apenas ${bestByProfit.totalTrades} trades. Amostra insuficiente para conclusões confiáveis.`
        );
    }

    return warnings;
};

const createEmptyEntry = (): OptimizationEntry => ({
    rank: 0,
    params: {},
    totalPnL: 0,
    totalPnLPercent: 0,
    winRate: 0,
    sharpeRatio: 0,
    maxDrawdownPercent: 0,
    profitFactor: 0,
    totalTrades: 0,
});

// ──────────── Default Optimization Params ────────────

export const DEFAULT_OPTIMIZATION_PARAMS = [
    {
        name: 'Score Mínimo',
        field: 'signal.minScore',
        values: [60, 65, 70, 75, 80],
    },
    {
        name: 'Capital Máximo por Posição (%)',
        field: 'signal.maxCapitalPerPosition',
        values: [10, 15, 20, 25],
    },
    {
        name: 'Max Posições Simultâneas',
        field: 'signal.maxSimultaneousPositions',
        values: [3, 5, 7, 10],
    },
];
