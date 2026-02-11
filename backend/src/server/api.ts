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

const router = Router();

// ──── Health Check ────

router.get('/health', (_req: Request, res: Response) => {
    const stats = getEngineStats();

    res.json({
        status: 'ok',
        uptime: getUptime(),
        services: {
            bybitWebSocket: bybitConnector.isConnected() ? 'connected' : 'disconnected',
            supabase: config.supabase.url ? 'connected' : 'disconnected',
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

export { router as apiRouter };
