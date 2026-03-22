// ═══════════════════════════════════════════════════════════
// Backtest Routes — REST API for backtesting operations
// POST /api/backtest/run          → Executa backtesting
// POST /api/backtest/optimize     → Otimização por grid search
// POST /api/backtest/walk-forward → Walk-Forward Analysis
// ═══════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { logger } from '../../lib/logger.js';
import { BacktestEngine } from '../../engine/backtest/backtestEngine.js';
import { analyzeBacktestResults, calculateBuyAndHold } from '../../engine/backtest/backtestAnalyzer.js';
import { runGridSearchOptimization } from '../../engine/backtest/backtestOptimizer.js';
import { runWalkForwardAnalysis } from '../../engine/backtest/walkForwardAnalysis.js';
import type { BacktestConfig, OptimizationConfig, WalkForwardConfig, BacktestProgress } from '../../types/backtestTypes.js';
import type { OHLCPoint } from '../../types/trading.js';

const router = Router();

// ──── POST /run ────

router.post('/run', async (req: Request, res: Response) => {
    try {
        const { config, ohlcData } = req.body as {
            config: BacktestConfig;
            ohlcData: Record<string, OHLCPoint[]>;
        };

        if (!config || !ohlcData) {
            res.status(400).json({ error: 'config e ohlcData são obrigatórios' });
            return;
        }

        const symbols = Object.keys(ohlcData);
        if (symbols.length === 0) {
            res.status(400).json({ error: 'ohlcData deve conter pelo menos um símbolo' });
            return;
        }

        logger.info(`[Backtest] Iniciando — ${symbols.join(', ')}`);

        const engine = new BacktestEngine(config);

        let allTrades: any[] = [];
        let allEquityCurve: any[] = [];

        for (const symbol of symbols) {
            const { trades, equityCurve } = await engine.runSymbol(
                symbol,
                ohlcData[symbol],
                (p: BacktestProgress) => logger.debug(`[BT] ${p.message}`)
            );
            allTrades = allTrades.concat(trades);
            allEquityCurve = allEquityCurve.concat(equityCurve);
            engine.reset();
        }

        const metrics = analyzeBacktestResults(allTrades, allEquityCurve, config);
        const buyAndHold = symbols.length === 1
            ? calculateBuyAndHold(ohlcData[symbols[0]], config.initialCapital, symbols[0])
            : null;

        logger.info(`[Backtest] Completo — ${allTrades.length} trades, PnL: ${metrics.main.totalPnLPercent.toFixed(2)}%`);

        res.json({
            success: true,
            trades: allTrades,
            equityCurve: allEquityCurve,
            metrics,
            buyAndHold,
            summary: {
                totalTrades: allTrades.length,
                winRate: metrics.main.winRate,
                totalPnL: metrics.main.totalPnL,
                totalPnLPercent: metrics.main.totalPnLPercent,
                maxDrawdown: metrics.risk.maxDrawdownPercent,
                sharpeRatio: metrics.risk.sharpeRatio,
            },
        });
    } catch (error: any) {
        logger.error('[Backtest] Erro:', error);
        res.status(500).json({ error: error.message });
    }
});

// ──── POST /optimize ────

router.post('/optimize', async (req: Request, res: Response) => {
    try {
        const { optimizationConfig, ohlcData } = req.body as {
            optimizationConfig: OptimizationConfig;
            ohlcData: Record<string, OHLCPoint[]>;
        };

        if (!optimizationConfig || !ohlcData) {
            res.status(400).json({ error: 'optimizationConfig e ohlcData são obrigatórios' });
            return;
        }

        const dataMap = new Map<string, OHLCPoint[]>(Object.entries(ohlcData));

        logger.info('[Backtest] Iniciando otimização...');

        const results = await runGridSearchOptimization(
            optimizationConfig,
            dataMap,
            (p: BacktestProgress) => logger.debug(`[Opt] ${p.message}`)
        );

        logger.info(`[Backtest] Otimização completa — ${results.totalCombinations} combinações`);

        res.json({ success: true, results });
    } catch (error: any) {
        logger.error('[Backtest] Erro na otimização:', error);
        res.status(500).json({ error: error.message });
    }
});

// ──── POST /walk-forward ────

router.post('/walk-forward', async (req: Request, res: Response) => {
    try {
        const { wfConfig, ohlcData } = req.body as {
            wfConfig: WalkForwardConfig;
            ohlcData: Record<string, OHLCPoint[]>;
        };

        if (!wfConfig || !ohlcData) {
            res.status(400).json({ error: 'wfConfig e ohlcData são obrigatórios' });
            return;
        }

        const symbols = Object.keys(ohlcData);
        if (symbols.length === 0) {
            res.status(400).json({ error: 'ohlcData deve conter pelo menos um símbolo' });
            return;
        }

        const dataMap = new Map<string, OHLCPoint[]>(Object.entries(ohlcData));

        logger.info(`[Backtest] Walk-Forward para ${symbols.join(', ')}...`);

        const results = await runWalkForwardAnalysis(
            wfConfig,
            dataMap
        );

        logger.info(`[Backtest] Walk-Forward completo — ${results.windows.length} janelas`);

        res.json({ success: true, results });
    } catch (error: any) {
        logger.error('[Backtest] Erro no walk-forward:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
