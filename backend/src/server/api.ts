// API Routes — Express router with all REST endpoints

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import { bybitConnector } from '../exchange/bybitConnector.js';
import { getActiveSignals, getSignalHistory, getSignalById, getEngineStats, isEngineRunning } from '../engine/signalEngine.js';
import { paperTradingEngine } from '../trading/paperTradingEngine.js';
import { isModelLoaded } from '../ml/mlPredictionService.js';
import { telegramService } from '../notifications/telegramService.js';
import { getUptime, getUptimeMs } from '../notifications/systemAlerts.js';
import { getConnectedClients } from './wsServer.js';
import pushRoutes from './routes/pushRoutes.js';
import tradeRoutes from './routes/tradeRoutes.js';
import portfolioRoutes from './routes/portfolioRoutes.js';
import tradeHistoryRoutes from './routes/tradeHistoryRoutes.js';
import indicatorAlertsRoutes from './routes/indicatorAlertsRoutes.js';
import backtestRoutes from './routes/backtestRoutes.js';

const router = Router();

// ──── Health Check ────

router.get('/health', (_req: Request, res: Response) => {
    const stats = getEngineStats();

    res.json({
        status: 'ok',
        uptime: getUptime(),
        services: {
            bybitWebSocket: bybitConnector.isConnected() ? 'connected' : 'disconnected',
            db: 'connected',
            telegram: telegramService.getConnectionStatus(),
            mlModel: isModelLoaded() ? 'loaded' : 'not_loaded',
            paperTrading: isEngineRunning() ? 'running' : 'stopped',
        },
        stats: {
            signalsToday: stats.signalsToday,
            signalsSent: stats.signalsSent,
            positionsOpen: paperTradingEngine.getState().positions.filter(p => p.status === 'open').length,
            lastSignalAt: stats.lastSignalAt,
        },
    });
});

// ──── Telegram Proxy ────

router.post('/telegram/proxy', async (req: Request, res: Response) => {
    try {
        const token = config.telegram.botToken;
        if (!token) {
            return res.status(400).json({ error: 'Telegram bot token not configured on server' });
        }
        
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        
        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        logger.error('Telegram proxy error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// ──── Status ────

router.get('/status', (_req: Request, res: Response) => {
    const engineStats = getEngineStats();
    const state = paperTradingEngine.getState();

    res.json({
        engine: engineStats,
        bybit: {
            connected: bybitConnector.isConnected(),
            monitoredSymbols: config.monitoredSymbols.length,
            tickerCount: bybitConnector.getTickers().size,
        },
        paperTrading: {
            mode: state.mode,
            balance: state.balance,
            equity: state.equity,
            openPositions: state.positions.filter(p => p.status === 'open').length,
        },
        telegram: {
            enabled: telegramService.isEnabled,
            status: telegramService.getConnectionStatus(),
            queueSize: telegramService.getQueueSize(),
        },
        ml: {
            enabled: config.ml.enabled,
            loaded: isModelLoaded(),
        },
    });
});

// ──── Signals ────

router.get('/signals', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const minScore = parseInt(req.query.minScore as string) || 0;
    let signals = getActiveSignals();
    if (minScore > 0) {
        signals = signals.filter(s => (s.quality?.score ?? s.confidence) >= minScore);
    }
    res.json(signals.slice(0, limit));
});

import { db } from '../lib/dbClient.js';

router.get('/signals/history', async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const symbol = req.query.symbol as string;
        const type = req.query.type as string;
        const status = req.query.status as string;

        const filter: any = {};
        if (symbol) filter.pair = symbol;
        if (type) filter.type = type;
        if (status) filter.status = status;

        const from = (page - 1) * limit;

        const [data, count] = await Promise.all([
            db.tradeSignal.findMany({
                where: filter,
                orderBy: { created_at: 'desc' },
                skip: from,
                take: limit
            }),
            db.tradeSignal.count({ where: filter })
        ]);

        res.json({
            data,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        });
    } catch (error: any) {
        logger.error('Error fetching signals history', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.get('/signals/:id', (req: Request, res: Response) => {
    const signal = getSignalById(req.params.id as string);
    if (!signal) {
        res.status(404).json({ error: 'Signal not found' });
        return;
    }
    res.json(signal);
});

// ──── Positions ────

router.get('/positions', (_req: Request, res: Response) => {
    const state = paperTradingEngine.getState();
    res.json(state.positions.filter(p => p.status === 'open'));
});

// ──── Portfolio ────

router.get('/portfolio', (_req: Request, res: Response) => {
    const state = paperTradingEngine.getState();
    const metrics = paperTradingEngine.getMetrics();
    res.json({
        balance: state.balance,
        equity: state.equity,
        marginInUse: state.marginInUse,
        mode: state.mode,
        config: state.config,
        metrics,
        equityCurve: state.equityCurve.slice(-100),
    });
});

// ──── History ────

router.get('/history', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const state = paperTradingEngine.getState();
    res.json(state.history.slice(0, limit));
});

// ──── Market ────

router.get('/market', (_req: Request, res: Response) => {
    const tickers = bybitConnector.getTickers();
    const market: any[] = [];

    for (const [symbol, ticker] of tickers) {
        if (config.monitoredSymbols.includes(symbol)) {
            market.push({
                symbol,
                price: ticker.lastPrice,
                change24h: ticker.price24hPcnt * 100,
                high24h: ticker.highPrice24h,
                low24h: ticker.lowPrice24h,
                volume24h: ticker.turnover24h,
                fundingRate: parseFloat(ticker.fundingRate),
                openInterest: parseFloat(ticker.openInterest),
            });
        }
    }

    res.json(market);
});

// ──── Metrics ────

router.get('/metrics', (_req: Request, res: Response) => {
    const metrics = paperTradingEngine.getMetrics();
    const engineStats = getEngineStats();

    res.json({
        engine: engineStats,
        trading: metrics,
    });
});

// ──── ML Stats ────

router.get('/ml/stats', (_req: Request, res: Response) => {
    res.json({
        enabled: config.ml.enabled,
        loaded: isModelLoaded(),
        modelPath: config.ml.modelPath,
    });
});

// ──── ML Force Retrain ────

import { executeRetrain } from '../jobs/mlRetrainJob.js';

router.post('/ml/retrain', async (_req: Request, res: Response) => {
    if (!config.ml.enabled) {
        res.status(503).json({ error: 'ML disabled in config. Set ML_ENABLED=true.' });
        return;
    }

    logger.info('[API] Force retrain requested via POST /ml/retrain');
    res.json({ status: 'started', message: 'Retraining initiated. Check server logs for progress.' });

    // Run async so we don't hold the HTTP connection open
    executeRetrain().then(success => {
        logger.info(`[API] Force retrain finished — success: ${success}`);
    }).catch(err => {
        logger.error('[API] Force retrain failed', { error: err });
    });
});

// ──── ML Predict ────

import { predictSignal } from '../ml/mlPredictionService.js';

router.post('/ml/predict', async (req: Request, res: Response) => {
    if (!config.ml.enabled) {
        res.status(503).json({ error: 'ML disabled' });
        return;
    }

    if (!isModelLoaded()) {
        const loaded = await import('../ml/mlPredictionService.js').then(m => m.loadModel());
        if (!loaded) {
            res.status(503).json({ error: 'ML model not available' });
            return;
        }
    }

    try {
        const features = req.body;
        if (!features || typeof features !== 'object') {
            res.status(400).json({ error: 'Invalid feature vector' });
            return;
        }

        const prediction = await predictSignal(features);
        if (!prediction) {
            res.status(500).json({ error: 'Prediction failed' });
            return;
        }

        res.json(prediction);
    } catch (error: any) {
        logger.error('ML predict error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// ──── Paper Trading Actions ────

router.post('/paper/open', (req: Request, res: Response) => {
    try {
        const { symbol, direction, currentPrice, stopLoss, takeProfit1, takeProfit2, takeProfit3, leverage } = req.body;

        if (!symbol || !direction || !currentPrice || !stopLoss || !takeProfit1) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const price = currentPrice || bybitConnector.getPrice(symbol);
        const position = paperTradingEngine.openPosition({
            symbol,
            direction,
            currentPrice: price,
            stopLoss,
            takeProfit1,
            takeProfit2,
            takeProfit3,
            leverage,
            signalScore: 0,
            signalConfidence: 0,
            mlProbability: 0,
            signalIndicators: ['manual'],
        });

        if (position) {
            res.json({ success: true, position });
        } else {
            res.status(400).json({ error: 'Failed to open position' });
        }
    } catch (error: any) {
        logger.error('Error opening paper position', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.post('/paper/close', (req: Request, res: Response) => {
    try {
        const { positionId, exitPrice } = req.body;
        if (!positionId) {
            res.status(400).json({ error: 'Missing positionId' });
            return;
        }

        const price = exitPrice || bybitConnector.getPrice(
            paperTradingEngine.getState().positions.find(p => p.id === positionId)?.symbol || ''
        );

        const order = paperTradingEngine.closePosition(positionId, 'manual', price);
        if (order) {
            res.json({ success: true, order });
        } else {
            res.status(404).json({ error: 'Position not found or already closed' });
        }
    } catch (error: any) {
        logger.error('Error closing paper position', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.post('/paper/toggle', (req: Request, res: Response) => {
    const currentMode = paperTradingEngine.getMode();
    const newMode = currentMode === 'automatic' ? 'manual' : 'automatic';
    paperTradingEngine.setMode(newMode);
    res.json({ success: true, mode: newMode });
});

// ──── Settings ────

router.post('/settings', (req: Request, res: Response) => {
    try {
        const updates = req.body;
        if (updates.paperTrading) {
            paperTradingEngine.updateConfig(updates.paperTrading);
        }
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
// ──── Notification Integrations ────
router.use('/push', pushRoutes);

// ──── Live Trading ────
router.use('/trade', tradeRoutes);

// ──── User Data ────
router.use('/portfolio', portfolioRoutes);
router.use('/user-trades', tradeHistoryRoutes);
router.use('/alerts', indicatorAlertsRoutes);

// ──── Backtesting ────
router.use('/backtest', backtestRoutes);

export { router as apiRouter };
