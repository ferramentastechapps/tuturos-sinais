// ═══════════════════════════════════════════════════════════
// Walk Forward Analysis — In-Sample / Out-of-Sample Validation
// Validates that backtest results are not overfitting
// ═══════════════════════════════════════════════════════════

import { OHLCPoint } from '@/services/coingeckoOHLC';
import { BacktestEngine } from '@/utils/backtestEngine';
import { analyzeBacktestResults } from '@/utils/backtestAnalyzer';
import { runGridSearchOptimization } from '@/utils/backtestOptimizer';
import {
    BacktestConfig, WalkForwardConfig, WalkForwardResult,
    WalkForwardWindow, BacktestProgress, OptimizationConfig,
} from '@/types/backtestTypes';

/**
 * Executa Walk Forward Analysis:
 * 1. Divide dados em janelas sobrepostas
 * 2. Otimiza parâmetros na porção in-sample
 * 3. Valida na porção out-of-sample
 * 4. Compara resultados para detectar overfitting
 */
export const runWalkForwardAnalysis = async (
    wfConfig: WalkForwardConfig,
    dataMap: Map<string, OHLCPoint[]>,
    onProgress?: (progress: BacktestProgress) => void
): Promise<WalkForwardResult> => {
    const windows: WalkForwardWindow[] = [];

    // Get overall date range from data
    let globalStart = Infinity;
    let globalEnd = -Infinity;
    for (const [, data] of dataMap) {
        if (data.length > 0) {
            globalStart = Math.min(globalStart, data[0].timestamp);
            globalEnd = Math.max(globalEnd, data[data.length - 1].timestamp);
        }
    }

    const windowMs = wfConfig.windowMonths * 30 * 24 * 60 * 60 * 1000;
    const stepMs = windowMs * 0.5; // 50% overlap
    let windowStart = globalStart;
    let windowIndex = 0;

    while (windowStart + windowMs <= globalEnd) {
        const windowEnd = windowStart + windowMs;
        const splitPoint = windowStart + (windowMs * wfConfig.inSampleRatio);

        onProgress?.({
            phase: 'walk_forward',
            percentComplete: Math.round(((windowStart - globalStart) / (globalEnd - globalStart)) * 100),
            message: `Walk Forward: Janela ${windowIndex + 1}`,
            currentBar: windowIndex,
        });

        // Split data for this window
        const isDataMap = new Map<string, OHLCPoint[]>();
        const oosDataMap = new Map<string, OHLCPoint[]>();

        for (const [symbol, data] of dataMap) {
            const isData = data.filter(d => d.timestamp >= windowStart && d.timestamp < splitPoint);
            const oosData = data.filter(d => d.timestamp >= splitPoint && d.timestamp < windowEnd);
            if (isData.length >= 200) isDataMap.set(symbol, isData);
            if (oosData.length >= 50) oosDataMap.set(symbol, oosData);
        }

        // Skip if insufficient data
        if (isDataMap.size === 0 || oosDataMap.size === 0) {
            windowStart += stepMs;
            windowIndex++;
            continue;
        }

        // 1. Optimize on In-Sample
        const optimResult = await runGridSearchOptimization(
            wfConfig.optimizationConfig,
            isDataMap
        );

        const bestParams = optimResult.bestByRiskAdjusted?.params || {};

        // 2. In-sample metrics (using best params)
        const isConfig = applyParams(wfConfig.baseConfig, bestParams);
        const isEngine = new BacktestEngine(isConfig);
        let isTrades: any[] = [];
        let isEquity: any[] = [];
        for (const [symbol, data] of isDataMap) {
            const { trades, equityCurve } = await isEngine.runSymbol(symbol, data);
            isTrades.push(...trades);
            isEquity.push(...equityCurve);
            isEngine.reset();
        }
        const isMetrics = analyzeBacktestResults(isTrades, isEquity, isConfig);

        // 3. Run on Out-of-Sample with best params
        const oosConfig = applyParams(wfConfig.baseConfig, bestParams);
        const oosEngine = new BacktestEngine(oosConfig);
        let oosTrades: any[] = [];
        let oosEquity: any[] = [];
        for (const [symbol, data] of oosDataMap) {
            const { trades, equityCurve } = await oosEngine.runSymbol(symbol, data);
            oosTrades.push(...trades);
            oosEquity.push(...equityCurve);
            oosEngine.reset();
        }
        const oosMetrics = analyzeBacktestResults(oosTrades, oosEquity, oosConfig);

        // 4. Calculate efficiency
        const isFinal = isMetrics.main.totalPnLPercent;
        const oosFinal = oosMetrics.main.totalPnLPercent;
        const efficiency = isFinal !== 0 ? oosFinal / isFinal : 0;

        windows.push({
            windowIndex,
            inSampleStart: windowStart,
            inSampleEnd: splitPoint,
            outOfSampleStart: splitPoint,
            outOfSampleEnd: windowEnd,
            bestParams,
            inSamplePnL: isMetrics.main.totalPnL,
            inSamplePnLPercent: isFinal,
            outOfSamplePnL: oosMetrics.main.totalPnL,
            outOfSamplePnLPercent: oosFinal,
            inSampleWinRate: isMetrics.main.winRate,
            outOfSampleWinRate: oosMetrics.main.winRate,
            efficiency,
        });

        windowStart += stepMs;
        windowIndex++;
    }

    // Overall assessment
    const profitableOOS = windows.filter(w => w.outOfSamplePnL > 0).length;
    const isConsistent = windows.length > 0 && (profitableOOS / windows.length) > 0.5;

    const avgEfficiency = windows.length > 0
        ? windows.reduce((s, w) => s + w.efficiency, 0) / windows.length
        : 0;

    let summary = '';
    if (windows.length === 0) {
        summary = 'Dados insuficientes para Walk Forward Analysis.';
    } else if (isConsistent && avgEfficiency > 0.5) {
        summary = `✅ Estratégia CONSISTENTE. ${profitableOOS}/${windows.length} janelas OOS lucrativas. Eficiência média: ${(avgEfficiency * 100).toFixed(0)}%.`;
    } else if (isConsistent) {
        summary = `⚠️ Estratégia moderada. ${profitableOOS}/${windows.length} janelas OOS lucrativas, mas eficiência baixa (${(avgEfficiency * 100).toFixed(0)}%).`;
    } else {
        summary = `❌ Possível OVERFITTING. Apenas ${profitableOOS}/${windows.length} janelas OOS foram lucrativas. Eficiência: ${(avgEfficiency * 100).toFixed(0)}%.`;
    }

    return {
        id: `wf_${Date.now()}`,
        windows,
        overallEfficiency: avgEfficiency,
        isConsistent,
        summary,
        timestamp: Date.now(),
    };
};

// ──────────── Helper ────────────

const applyParams = (
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
