// ═══════════════════════════════════════════════════════════
// Backtest Routes — REST API for backtesting operations
// POST /api/backtest/run          → Executa backtesting
// POST /api/backtest/optimize     → Otimização por grid search
// POST /api/backtest/walk-forward → Walk-Forward Analysis
// GET  /api/backtest/history      → Histórico persistido (Supabase)
// POST /api/backtest/compare      → Comparação de até 3 configs
// POST /api/backtest/apply-to-robot → Aplica params ao robô ativo
// GET  /api/backtest/ohlc         → Proxy Bybit klines (resolve CORS)
// ═══════════════════════════════════════════════════════════
//
// DEBUG: todos os endpoints logam payload size e duração
// para facilitar diagnóstico de problemas.
// ═══════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabaseClient.js';
import { BacktestEngine } from '../../engine/backtest/backtestEngine.js';
import { analyzeBacktestResults, calculateBuyAndHold } from '../../engine/backtest/backtestAnalyzer.js';
import { runGridSearchOptimization } from '../../engine/backtest/backtestOptimizer.js';
import { runWalkForwardAnalysis } from '../../engine/backtest/walkForwardAnalysis.js';
import { paperTradingEngine } from '../../trading/paperTradingEngine.js';
import type { BacktestConfig, OptimizationConfig, WalkForwardConfig, BacktestProgress } from '../../types/backtestTypes.js';
import type { OHLCPoint } from '../../types/trading.js';

const router = Router();

// ──────────── Helpers ────────────

/** Runs the engine for all symbols and returns merged results. */
async function runEngineForConfig(
    config: BacktestConfig,
    ohlcData: Record<string, OHLCPoint[]>,
    onProgress?: (p: BacktestProgress) => void
) {
    const symbols = Object.keys(ohlcData);
    const engine = new BacktestEngine(config);
    let allTrades: any[] = [];
    let allEquityCurve: any[] = [];

    for (const symbol of symbols) {
        const { trades, equityCurve } = await engine.runSymbol(
            symbol,
            ohlcData[symbol],
            onProgress ?? ((p: BacktestProgress) => logger.debug(`[BT] ${p.message}`))
        );
        allTrades = allTrades.concat(trades);
        allEquityCurve = allEquityCurve.concat(equityCurve);
        engine.reset();
    }

    const metrics = analyzeBacktestResults(allTrades, allEquityCurve, config);
    const buyAndHold = symbols.length === 1
        ? calculateBuyAndHold(ohlcData[symbols[0]], config.initialCapital, symbols[0])
        : null;

    return { trades: allTrades, equityCurve: allEquityCurve, metrics, buyAndHold };
}

/** Persists a completed backtest run to Supabase. */
async function persistResult(
    config: BacktestConfig,
    trades: any[],
    equityCurve: any[],
    metrics: any,
    buyAndHold: any
) {
    const m = metrics?.main ?? {};
    const r = metrics?.risk ?? {};

    const row = {
        symbols:           config.symbols,
        timeframe:         config.timeframe,
        start_date:        config.startDate,
        end_date:          config.endDate,
        initial_capital:   config.initialCapital,
        total_trades:      m.totalTrades ?? 0,
        win_rate:          m.winRate ?? null,
        profit_factor:     r.profitFactor ?? null,
        total_pnl:         m.totalPnL ?? null,
        total_pnl_percent: m.totalPnLPercent ?? null,
        max_drawdown_pct:  r.maxDrawdownPercent ?? null,
        sharpe_ratio:      r.sharpeRatio ?? null,
        sortino_ratio:     r.sortinoRatio ?? null,
        config_json:       config,
        result_json: {
            trades:        trades.slice(0, 500),   // cap at 500 trades to avoid JSONB bloat
            equityCurve:   equityCurve.filter((_: any, i: number) => i % 3 === 0), // downsample 3x
            metrics,
            buyAndHold,
        },
    };

    const { error } = await supabase.from('backtest_results').insert(row);
    if (error) logger.warn('[Backtest] Failed to persist result:', error.message);
}

// ──────────── GET /ohlc (Proxy Bybit — resolve CORS do browser) ────────────

const BYBIT_INTERVAL: Record<string, string> = {
    '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1d': 'D',
};

router.get('/ohlc', async (req: Request, res: Response) => {
    try {
        const symbol   = String(req.query.symbol ?? '').toUpperCase();
        const interval = String(req.query.interval ?? '60');
        const start    = String(req.query.start ?? '');
        const end      = String(req.query.end ?? '');
        const limit    = Math.min(parseInt(String(req.query.limit ?? '1000')), 1000);

        if (!symbol || !start || !end) {
            res.status(400).json({ error: 'symbol, start e end são obrigatórios' });
            return;
        }

        const bybitInterval = BYBIT_INTERVAL[interval] ?? interval;
        const url = new URL('https://api.bybit.com/v5/market/kline');
        url.searchParams.set('category', 'linear');
        url.searchParams.set('symbol', symbol);
        url.searchParams.set('interval', bybitInterval);
        url.searchParams.set('start', start);
        url.searchParams.set('end', end);
        url.searchParams.set('limit', limit.toString());

        logger.debug(`[Backtest/OHLC] ${symbol} ${interval} start=${start} end=${end} limit=${limit}`);

        const response = await fetch(url.toString());
        if (!response.ok) {
            res.status(response.status).json({ error: `Bybit API error: ${response.statusText}` });
            return;
        }

        const json = await response.json() as any;
        if (json.retCode !== 0) {
            res.status(400).json({ error: `Bybit API: ${json.retMsg}` });
            return;
        }

        // Pass through Bybit response directly
        res.json(json);
    } catch (error: any) {
        logger.error('[Backtest/OHLC] Proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ──────────── POST /run ────────────

router.post('/run', async (req: Request, res: Response) => {
    const t0 = Date.now();
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

        // Debug: log payload size
        const payloadKB = Math.round(JSON.stringify(req.body).length / 1024);
        const candleCounts = symbols.map(s => `${s}:${ohlcData[s]?.length ?? 0}`).join(', ');
        logger.info(`[Backtest/run] Início — símbolos=[${symbols.join(', ')}] candles=[${candleCounts}] payload=${payloadKB}KB`);
        logger.info(`[Backtest/run] Config — tf=${config.timeframe} período=${config.startDate}→${config.endDate} score≥${config.signal?.minScore} maxPos=${config.signal?.maxSimultaneousPositions}`);

        const { trades, equityCurve, metrics, buyAndHold } = await runEngineForConfig(config, ohlcData);

        const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
        logger.info(`[Backtest/run] Completo em ${elapsedSec}s — ${trades.length} trades, PnL: ${metrics.main.totalPnLPercent.toFixed(2)}%, WR: ${metrics.main.winRate.toFixed(1)}%`);

        // Persist to Supabase asynchronously (don't block response)
        persistResult(config, trades, equityCurve, metrics, buyAndHold).catch(() => {});

        res.json({
            success: true,
            trades,
            equityCurve,
            metrics,
            buyAndHold,
            summary: {
                totalTrades:      trades.length,
                winRate:          metrics.main.winRate,
                totalPnL:         metrics.main.totalPnL,
                totalPnLPercent:  metrics.main.totalPnLPercent,
                maxDrawdown:      metrics.risk.maxDrawdownPercent,
                sharpeRatio:      metrics.risk.sharpeRatio,
            },
        });
    } catch (error: any) {
        logger.error('[Backtest] Erro:', error);
        res.status(500).json({ error: error.message });
    }
});

// ──────────── POST /optimize ────────────

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

// ──────────── POST /walk-forward ────────────

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

        const results = await runWalkForwardAnalysis(wfConfig, dataMap);

        logger.info(`[Backtest] Walk-Forward completo — ${results.windows.length} janelas`);

        res.json({ success: true, results });
    } catch (error: any) {
        logger.error('[Backtest] Erro no walk-forward:', error);
        res.status(500).json({ error: error.message });
    }
});

// ──────────── GET /history ────────────

router.get('/history', async (req: Request, res: Response) => {
    try {
        const limit  = Math.min(parseInt(String(req.query.limit  ?? '50')), 100);
        const symbol = String(req.query.symbol ?? '');

        let query = supabase
            .from('backtest_results')
            .select([
                'id', 'created_at', 'symbols', 'timeframe', 'start_date', 'end_date',
                'initial_capital', 'total_trades', 'win_rate', 'profit_factor',
                'total_pnl', 'total_pnl_percent', 'max_drawdown_pct',
                'sharpe_ratio', 'sortino_ratio', 'label',
            ].join(', '))
            .order('created_at', { ascending: false })
            .limit(limit);

        // Optional symbol filter (Supabase array contains)
        if (symbol) {
            query = query.contains('symbols', [symbol.toUpperCase()]);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, history: data ?? [] });
    } catch (error: any) {
        logger.error('[Backtest] Erro ao buscar histórico:', error);
        res.status(500).json({ error: error.message });
    }
});

// ──────────── GET /history/:id ────────────

router.get('/history/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('backtest_results')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            res.status(404).json({ error: 'Backtest não encontrado' });
            return;
        }

        res.json({ success: true, result: data });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ──────────── POST /compare ────────────

router.post('/compare', async (req: Request, res: Response) => {
    try {
        const { configs, ohlcData } = req.body as {
            configs: BacktestConfig[];                    // 2–3 configs
            ohlcData: Record<string, OHLCPoint[]>;       // shared OHLC data
        };

        if (!configs || !Array.isArray(configs) || configs.length < 2) {
            res.status(400).json({ error: 'Envie entre 2 e 3 configs para comparar' });
            return;
        }

        if (configs.length > 3) {
            res.status(400).json({ error: 'Máximo de 3 configs por comparação' });
            return;
        }

        if (!ohlcData || Object.keys(ohlcData).length === 0) {
            res.status(400).json({ error: 'ohlcData é obrigatório' });
            return;
        }

        logger.info(`[Backtest] Comparando ${configs.length} configurações...`);

        // Run all configs in parallel
        const results = await Promise.all(
            configs.map(config => runEngineForConfig(config, ohlcData))
        );

        // Build comparison score for ranking
        const scored = results.map((r, idx) => {
            const m = r.metrics?.main ?? {};
            const risk = r.metrics?.risk ?? {};
            const score = scoreConfig(m, risk);
            return { index: idx, config: configs[idx], score, summary: buildSummary(m, risk) };
        });

        const ranking = [...scored].sort((a, b) => b.score - a.score);

        res.json({
            success: true,
            results: results.map((r, idx) => ({
                index:       idx,
                config:      configs[idx],
                trades:      r.trades,
                equityCurve: r.equityCurve,
                metrics:     r.metrics,
                buyAndHold:  r.buyAndHold,
            })),
            ranking,
        });
    } catch (error: any) {
        logger.error('[Backtest] Erro na comparação:', error);
        res.status(500).json({ error: error.message });
    }
});

// ──────────── POST /apply-to-robot ────────────

router.post('/apply-to-robot', async (req: Request, res: Response) => {
    try {
        const { config } = req.body as { config: BacktestConfig };

        if (!config?.signal) {
            res.status(400).json({ error: 'config.signal é obrigatório' });
            return;
        }

        const { signal } = config;

        // Read current config then patch only the relevant fields
        const current = paperTradingEngine.getState().config.autoTrade;
        paperTradingEngine.updateConfig({
            autoTrade: {
                ...current,
                minScore:                signal.minScore,
                maxSimultaneousPositions: signal.maxSimultaneousPositions,
                maxCapitalPerTrade:      signal.maxCapitalPerPosition ?? current.maxCapitalPerTrade,
            },
        });

        logger.info(`[Backtest] Config aplicada ao robô: score≥${signal.minScore}, maxPos=${signal.maxSimultaneousPositions}, cap=${signal.maxCapitalPerPosition}%`);

        res.json({
            success: true,
            message: 'Configuração aplicada ao robô em tempo real',
            applied: {
                minScore:                signal.minScore,
                maxSimultaneousPositions: signal.maxSimultaneousPositions,
                maxCapitalPerTrade:      signal.maxCapitalPerPosition ?? 20,
            },
        });
    } catch (error: any) {
        logger.error('[Backtest] Erro ao aplicar config ao robô:', error);
        res.status(500).json({ error: error.message });
    }
});

// ──────────── Scoring helpers ────────────

function scoreConfig(m: any, risk: any): number {
    const winRateScore    = ((m.winRate ?? 0) / 100) * 35;
    const pfScore         = Math.min((risk.profitFactor ?? 0) / 3, 1) * 25;
    const sharpeScore     = Math.min((risk.sharpeRatio ?? 0) / 2, 1) * 20;
    const drawdownScore   = (1 - Math.min((risk.maxDrawdownPercent ?? 50) / 50, 1)) * 15;
    const expectancyScore = (m.expectancy ?? 0) > 0 ? 5 : 0;
    return winRateScore + pfScore + sharpeScore + drawdownScore + expectancyScore;
}

function buildSummary(m: any, risk: any) {
    return {
        totalTrades:      m.totalTrades      ?? 0,
        winRate:          m.winRate          ?? 0,
        totalPnLPercent:  m.totalPnLPercent  ?? 0,
        profitFactor:     risk.profitFactor  ?? 0,
        maxDrawdownPct:   risk.maxDrawdownPercent ?? 0,
        sharpeRatio:      risk.sharpeRatio   ?? 0,
        expectancy:       m.expectancy       ?? 0,
    };
}

// ──────────── GET /strategies ────────────

router.get('/strategies', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('backtest_strategies')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, strategies: data ?? [] });
    } catch (error: any) {
        logger.error('[Backtest] Erro ao buscar estratégias:', error);
        res.status(500).json({ error: error.message });
    }
});

// ──────────── POST /strategies ────────────

router.post('/strategies', async (req: Request, res: Response) => {
    try {
        const { name, description, type, timeframe, indicators } = req.body;

        if (!name || !description) {
            res.status(400).json({ error: 'name e description são obrigatórios' });
            return;
        }

        const { data, error } = await supabase
            .from('backtest_strategies')
            .insert({
                name,
                description,
                type: type || 'swing',
                timeframe: timeframe || '1h',
                indicators: indicators || [],
            })
            .select()
            .single();

        if (error) throw error;

        logger.info(`[Backtest] Nova estratégia criada: ${name}`);

        res.json({ success: true, strategy: data });
    } catch (error: any) {
        logger.error('[Backtest] Erro ao criar estratégia:', error);
        res.status(500).json({ error: error.message });
    }
});

// ──────────── GET /robot-config/:type ────────────

router.get('/robot-config/:type', async (req: Request, res: Response) => {
    try {
        const { type } = req.params; // 'swing' or 'scalping'

        if (type !== 'swing' && type !== 'scalping') {
            res.status(400).json({ error: 'type deve ser "swing" ou "scalping"' });
            return;
        }

        // Load config from environment or database
        const robotConfig = {
            symbols: type === 'swing' 
                ? ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']
                : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
            signal: {
                minScore: type === 'swing' ? 75 : 70,
                maxSimultaneousPositions: type === 'swing' ? 5 : 8,
                maxCapitalPerPosition: type === 'swing' ? 10 : 5,
                allowLong: true,
                allowShort: true,
                useMLFilter: false,
            },
            timeframe: type === 'swing' ? '1h' : '5m',
            strategyId: type === 'swing' ? 'DEFAULT' : 'SCALPING_BOT',
        };

        logger.info(`[Backtest] Config do robô ${type} carregada`);

        res.json({ success: true, config: robotConfig });
    } catch (error: any) {
        logger.error('[Backtest] Erro ao carregar config do robô:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;

