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

// Helper function to safely get string from req.params or req.query
const getStringParam = (value: any): string => {
    if (Array.isArray(value)) return value[0] || '';
    if (typeof value === 'string') return value;
    return '';
};

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

import { tradeTracker } from '../trading/tradeTracker.js';

router.get('/signals', (req: Request, res: Response) => {
    const limit = parseInt(getStringParam(req.query.limit)) || 20;
    const minScore = parseInt(getStringParam(req.query.minScore)) || 0;
    const tradeType = getStringParam(req.query.trade_type);

    let active = tradeTracker.getAllActiveSignals();
    
    // Convert to frontend compatible format
    let signals = active.map(s => ({
        id: s.id,
        pair: s.pair,
        type: s.type,
        trade_type: s.trade_type,
        entry: (s.entry_range_low + s.entry_range_high) / 2,
        entry_range_low: s.entry_range_low,
        entry_range_high: s.entry_range_high,
        takeProfit: s.take_profits[0]?.price,
        takeProfits: s.take_profits,
        takeProfit1: s.take_profits.find((t: any) => t.level === 1)?.price,
        takeProfit2: s.take_profits.find((t: any) => t.level === 2)?.price,
        takeProfit3: s.take_profits.find((t: any) => t.level === 3)?.price,
        stopLoss: s.stop_loss,
        initial_stop_loss: s.initial_stop_loss,
        status: s.status,
        createdAt: (s as any).created_at || new Date().toISOString(),
        score: s.score,
        quality: { score: s.score || 0 }
    }));

    if (minScore > 0) {
        signals = signals.filter(s => s.score && s.score >= minScore);
    }
    
    if (tradeType && tradeType !== 'ALL') {
        signals = signals.filter(s => s.trade_type === tradeType);
    }

    res.json(signals.slice(0, limit));
});

import { db } from '../lib/dbClient.js';

// ──── Symbols list ────
router.get('/symbols', (_req: Request, res: Response) => {
    res.json({ symbols: config.monitoredSymbols });
});

import { getPairStatsRanking } from '../lib/statsService.js';

router.get('/signals/pair-stats', async (req: Request, res: Response) => {
    try {
        const tradeType = getStringParam(req.query.trade_type);
        const dateRange = getStringParam(req.query.date_range);
        const type = getStringParam(req.query.type);

        const stats = await getPairStatsRanking({ tradeType, dateRange, type });

        res.json({ 
            topWinners: stats.topWinners.slice(0, 10), 
            topLosers: stats.topLosers.slice(0, 10) 
        });
    } catch (error: any) {
        logger.error('Error fetching pair stats', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.get('/signals/history', async (req: Request, res: Response) => {
    try {
        const page = parseInt(getStringParam(req.query.page)) || 1;
        const limit = parseInt(getStringParam(req.query.limit)) || 50;
        const symbol = getStringParam(req.query.symbol);
        const type = getStringParam(req.query.type);
        const status = getStringParam(req.query.status);
        const tradeType = getStringParam(req.query.trade_type);
        const dateRange = getStringParam(req.query.date_range); // 'day' | 'week' | 'month'

        const filter: any = {};
        if (symbol && symbol !== 'ALL') filter.pair = symbol;
        if (type && type !== 'ALL') filter.type = type;
        if (status && status !== 'ALL') filter.status = status;
        
        if (tradeType && tradeType !== 'ALL') {
            if (tradeType === 'Scalping') {
                filter.trade_type = 'Scalping';
            } else if (tradeType === 'Main') {
                filter.trade_type = { not: 'Scalping' };
            } else {
                filter.trade_type = tradeType;
            }
        }

        // Date range filter
        if (dateRange && dateRange !== 'ALL') {
            const now = new Date();
            let fromDate: Date;
            if (dateRange === 'day') {
                fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            } else if (dateRange === 'week') {
                const day = now.getDay();
                fromDate = new Date(now);
                fromDate.setDate(now.getDate() - day);
                fromDate.setHours(0, 0, 0, 0);
            } else if (dateRange === 'month') {
                fromDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
            } else {
                fromDate = new Date(0); // 'all'
            }
            filter.created_at = { gte: fromDate };
        }

        // Fetch paginated data
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

        // Fetch all matching to calculate precise stats
        const allStatsRaw = await db.tradeSignal.findMany({
            where: filter,
            select: { status: true, entry_range_low: true, entry_range_high: true, stop_loss: true, take_profits: true }
        });

        let wins = 0;
        let losses = 0;
        let active = 0;
        let totalPnl = 0;

        for (const s of allStatsRaw) {
            if (s.status === 'ACTIVE' || s.status === 'PENDING') active++;
            else if (s.status === 'CLOSED_TP') {
                wins++;
                const entry = (s.entry_range_low + s.entry_range_high) / 2;
                let tpPrice = entry;
                try {
                    const tpList = JSON.parse(s.take_profits);
                    if (tpList && tpList.length > 0) tpPrice = tpList[0].price;
                } catch(e) {}
                const gain = Math.abs((tpPrice - entry) / entry) * 100;
                totalPnl += gain;
            }
            else if (s.status === 'CLOSED_SL') {
                losses++;
                const entry = (s.entry_range_low + s.entry_range_high) / 2;
                const loss = Math.abs((entry - s.stop_loss) / entry) * 100;
                totalPnl -= loss; // Subtrai a % de loss do PNL
            }
        }

        const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;

        const formattedData = data.map(s => {
            let tps: any[] = [];
            try { tps = s.take_profits ? JSON.parse(s.take_profits) : []; } catch(e) {}
            return {
                ...s,
                entry: (s.entry_range_low + s.entry_range_high) / 2,
                takeProfit: tps[0]?.price,
                takeProfits: tps,
                takeProfit1: tps.find((t: any) => t.level === 1)?.price,
                takeProfit2: tps.find((t: any) => t.level === 2)?.price,
                takeProfit3: tps.find((t: any) => t.level === 3)?.price,
                stopLoss: s.stop_loss,
                initial_stop_loss: s.initial_stop_loss,
                score: s.confidence,
                quality: { score: s.confidence || 0 },
                indicators: typeof s.indicators === 'string' ? JSON.parse(s.indicators) : (s.indicators || []),
            };
        });

        res.json({
            data: formattedData,
            stats: {
                wins,
                losses,
                active,
                winRate,
                totalPnl
            },
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
    const id = getStringParam(req.params.id);
    const signal = getSignalById(id);
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

// ──── Portfolio Assets ────

router.get('/portfolio/assets', async (_req: Request, res: Response) => {
    try {
        const assets = await db.portfolioAsset.findMany({
            orderBy: { updated_at: 'desc' }
        });
        res.json(assets);
    } catch (error: any) {
        logger.error('Error fetching portfolio assets', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.post('/portfolio/assets', async (req: Request, res: Response) => {
    try {
        const { symbol, name, quantity, average_buy_price, total_fees } = req.body;
        
        // Check if asset already exists
        const existing = await db.portfolioAsset.findFirst({
            where: { 
                user_id: 'default', // TODO: Add user authentication
                symbol 
            }
        });

        if (existing) {
            // Update existing asset
            const updated = await db.portfolioAsset.update({
                where: { id: existing.id },
                data: {
                    quantity,
                    average_buy_price,
                    total_fees,
                    updated_at: new Date()
                }
            });
            res.json(updated);
        } else {
            // Create new asset
            const asset = await db.portfolioAsset.create({
                data: {
                    user_id: 'default', // TODO: Add user authentication
                    symbol,
                    name,
                    quantity,
                    average_buy_price,
                    total_fees
                }
            });
            res.json(asset);
        }
    } catch (error: any) {
        logger.error('Error creating/updating portfolio asset', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.delete('/portfolio/assets/:id', async (req: Request, res: Response) => {
    try {
        const id = getStringParam(req.params.id);
        await db.portfolioAsset.delete({
            where: { id }
        });
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error deleting portfolio asset', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// ──── History ────

router.get('/history', (req: Request, res: Response) => {
    const limit = parseInt(getStringParam(req.query.limit)) || 50;
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

router.get('/ml/stats', async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, robotType } = req.query;
        
        // Construir filtros dinâmicos
        const whereClause: any = { 
            status: { in: ['CLOSED_TP', 'CLOSED_SL'] } 
        };
        
        // Filtro de data
        if (startDate || endDate) {
            whereClause.exit_time = {};
            if (startDate) whereClause.exit_time.gte = new Date(startDate as string);
            if (endDate) whereClause.exit_time.lte = new Date(endDate as string);
        }
        
        // Filtro de tipo de robô
        if (robotType && robotType !== 'all') {
            whereClause.trade_type = robotType;
        }
        
        // Usar sinais REAIS fechados (não dados de treino históricos)
        const closedSignals = await db.tradeSignal.findMany({
            where: whereClause,
            select: {
                status: true,
                take_profits: true,
                entry_range_low: true,
                entry_range_high: true,
                stop_loss: true,
                pnl: true,
            }
        });

        const wins = closedSignals.filter((s: any) => s.status === 'CLOSED_TP').length;
        const losses = closedSignals.filter((s: any) => s.status === 'CLOSED_SL').length;
        const totalSignals = wins + losses;
        const winRate = totalSignals > 0 ? (wins / totalSignals) * 100 : 0;

        // PnL médio real
        const avgPnl = totalSignals > 0
            ? closedSignals.reduce((sum: number, s: any) => sum + (s.pnl || 0), 0) / totalSignals
            : 0;

        let tp1Hits = 0, tp2Hits = 0, tp3Hits = 0;
        for (const signal of closedSignals) {
            if (signal.status === 'CLOSED_TP') {
                let hasHit1 = false, hasHit2 = false, hasHit3 = false;
                try {
                    const tps = JSON.parse(signal.take_profits);
                    if (Array.isArray(tps)) {
                        if (tps.find((t: any) => (t.level === 1 || t.tp === 1) && t.hit)) hasHit1 = true;
                        if (tps.find((t: any) => (t.level === 2 || t.tp === 2) && t.hit)) hasHit2 = true;
                        if (tps.find((t: any) => (t.level === 3 || t.tp === 3) && t.hit)) hasHit3 = true;
                    }
                } catch (e) { /* ignore */ }
                
                // Fallback: Se o status é CLOSED_TP, no mínimo bateu o TP1
                if (!hasHit1) hasHit1 = true;

                if (hasHit1) tp1Hits++;
                if (hasHit2) tp2Hits++;
                if (hasHit3) tp3Hits++;
            }
        }

        // Amostras de treino (só para info)
        const trainingSamples = await db.mLTrainingData.count();

        res.json({
            enabled: config.ml.enabled,
            loaded: isModelLoaded(),
            totalSignals,
            wins,
            losses,
            winRate,
            tp1Hits,
            tp2Hits,
            tp3Hits,
            avgPnl,
            trainingSamples,
        });
    } catch (error: any) {
        logger.error('Error fetching ML stats', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// ──── ML Learning History ────

router.get('/ml/learning-history', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(getStringParam(req.query.limit)) || 5;
        const { startDate, endDate, robotType } = req.query;
        
        // Construir filtros dinâmicos
        const whereClause: any = { 
            outcome: { not: null } 
        };
        
        // Filtro de data
        if (startDate || endDate) {
            whereClause.exit_time = {};
            if (startDate) whereClause.exit_time.gte = new Date(startDate as string);
            if (endDate) whereClause.exit_time.lte = new Date(endDate as string);
        }
        
        // Filtro de tipo de robô
        if (robotType && robotType !== 'all') {
            whereClause.trade_type = robotType;
        }
        
        // Fetch recently closed trades with outcomes
        const history = await db.tradeSignal.findMany({
            where: whereClause,
            orderBy: { exit_time: 'desc' },
            take: limit,
            select: {
                id: true,
                pair: true,
                outcome: true,
                pnl: true,
                exit_time: true,
                ml_data: true,
                indicators: true,
                trade_type: true,
                entry_time: true,
                created_at: true
            }
        });

        const learnings = history.map((h: any) => {
            let parsedML: any = {};
            try { if (h.ml_data) parsedML = JSON.parse(h.ml_data); } catch(e){}
            
            let parsedInd: any[] = [];
            try { if (h.indicators) parsedInd = JSON.parse(h.indicators); } catch(e){}

            // 1 = previu WIN, 0 = previu LOSS. 
            // Se não houver previsão salva (sinais antigos), assumimos 1 pois o bot só opera previsões positivas.
            const predictedClass = parsedML.predictedClass ?? 1; 
            const isWin = h.outcome === 'WIN';
            
            // A IA acertou se: (Previu WIN e deu WIN) OU (Previu LOSS e deu LOSS)
            const wasCorrect = (predictedClass === 1 && isWin) || (predictedClass === 0 && !isWin);

            const key_indicators = parsedInd.length > 0 ? parsedInd.slice(0, 3) : ['RSI', 'MACD', 'EMA'];

            return {
                id: h.id,
                symbol: h.pair,
                result: h.outcome,
                profit_percent: h.pnl || 0,
                ml_was_correct: wasCorrect,
                key_indicators,
                trade_type: h.trade_type,
                entry_time: h.entry_time || h.created_at,
                exit_time: h.exit_time,
                all_indicators: parsedInd,
                ml_data: parsedML
            };
        });

        // Summary stats: Acurácia real da IA baseada nos sinais reais
        const whereClauseForAcc: any = { 
            outcome: { not: null }, 
            ml_data: { not: null } 
        };
        
        // Aplicar mesmos filtros de data e robô
        if (startDate || endDate) {
            whereClauseForAcc.exit_time = {};
            if (startDate) whereClauseForAcc.exit_time.gte = new Date(startDate as string);
            if (endDate) whereClauseForAcc.exit_time.lte = new Date(endDate as string);
        }
        if (robotType && robotType !== 'all') {
            whereClauseForAcc.trade_type = robotType;
        }
        
        const historyForAcc = await db.tradeSignal.findMany({
            where: whereClauseForAcc,
            select: { outcome: true, ml_data: true }
        });
        
        let correctCount = 0;
        let totalCount = 0;
        
        for (const h of historyForAcc) {
            let parsedML: any = {};
            try { if (h.ml_data) parsedML = JSON.parse(h.ml_data); } catch(e){}
            
            if (parsedML && typeof parsedML.predictedClass === 'number') {
                const isWin = h.outcome === 'WIN';
                const wasCorrect = (parsedML.predictedClass === 1 && isWin) || (parsedML.predictedClass === 0 && !isWin);
                if (wasCorrect) correctCount++;
                totalCount++;
            }
        }
        
        // Se não houver dados reais suficientes para acurácia, tenta usar o accuracy do model_metrics (treinamento)
        let ml_accuracy = totalCount > 0 ? correctCount / totalCount : 0;
        
        if (totalCount === 0) {
            try {
                const fs = require('fs');
                const path = require('path');
                const metricsPath = path.join(process.cwd(), '../ml_engine/data/model_metrics.json');
                if (fs.existsSync(metricsPath)) {
                    const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
                    if (metrics.test_accuracy) ml_accuracy = metrics.test_accuracy;
                }
            } catch(e) {}
        }

        const total = await db.mLTrainingData.count();

        res.json({
            success: true,
            learnings,
            summary: {
                total,
                ml_accuracy
            }
        });
    } catch (error: any) {
        logger.error('Error fetching ML learning history', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
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

// ──── ML Export Data ────
router.get('/ml/export', async (req: Request, res: Response) => {
    try {
        const data = await db.mLTrainingData.findMany({
            orderBy: { entry_time: 'desc' }
        });
        
        if (!data || data.length === 0) {
            res.status(404).send('No data found');
            return;
        }

        // Buscar trade_types do banco para diferenciar os robôs
        const signalIds = data.map((d: any) => d.signal_id);
        const tradeSignals = await db.tradeSignal.findMany({
            where: { id: { in: signalIds } },
            select: { id: true, trade_type: true }
        });
        const tradeTypeMap = new Map(tradeSignals.map((s: any) => [s.id, s.trade_type]));

        let csv = 'id,signal_id,symbol,trade_type,outcome_label,outcome_pnl,entry_time';
        let featureKeys: string[] = [];
        
        try {
            if (data[0].features) {
                const f = typeof data[0].features === 'string' ? JSON.parse(data[0].features) : data[0].features;
                featureKeys = Object.keys(f);
                csv += ',' + featureKeys.join(',');
            }
        } catch(e) {}
        
        csv += '\n';

        for (const row of data) {
            let featuresObj: any = {};
            try {
                featuresObj = typeof row.features === 'string' ? JSON.parse(row.features) : (row.features || {});
            } catch(e) {}
            
            const featureValues = featureKeys.map(k => featuresObj[k] !== undefined ? featuresObj[k] : '');
            const tradeType = tradeTypeMap.get(row.signal_id) || 'Desconhecido';
            
            csv += `${row.id},${row.signal_id},${row.symbol},${tradeType},${row.outcome_label},${row.outcome_pnl},${row.entry_time},${featureValues.join(',')}\n`;
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=ml_training_data.csv');
        res.send(csv);
    } catch (error: any) {
        logger.error('Error exporting ML data', { error: error.message });
        res.status(500).json({ error: error.message });
    }
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
