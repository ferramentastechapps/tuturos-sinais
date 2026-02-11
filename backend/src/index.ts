// Signal Engine — Main Entry Point
// Starts all services: Express API, WebSocket, Bybit connection, Signal engine

import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { apiRouter } from './server/api.js';
import { initWebSocketServer, broadcastPrices, broadcastPositions, broadcastPortfolio } from './server/wsServer.js';
import { bybitConnector } from './exchange/bybitConnector.js';
import { startEngine, stopEngine } from './engine/signalEngine.js';
import { paperTradingEngine } from './trading/paperTradingEngine.js';
import { loadModel } from './ml/mlPredictionService.js';
import { telegramService } from './notifications/telegramService.js';
import {
    sendSystemStartAlert,
    sendCriticalErrorAlert,
    sendWebSocketReconnectAlert,
    startSystemMonitor,
} from './notifications/systemAlerts.js';

const app = express();
const server = createServer(app);

// ──── Middleware ────

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));

app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
}));

app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests' },
});
app.use('/api', limiter);

// ──── Routes ────

app.use('/api', apiRouter);

// Root route
app.get('/', (_req, res) => {
    res.json({
        name: 'Signal Engine',
        version: '1.0.0',
        status: 'running',
        docs: '/api/health',
    });
});

// ──── WebSocket ────

initWebSocketServer(server);

// ──── Startup ────

async function bootstrap(): Promise<void> {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('🚀 Signal Engine Starting...');
    logger.info(`📍 Environment: ${config.nodeEnv}`);
    logger.info(`🔌 Port: ${config.port}`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 1. Load ML model
    if (config.ml.enabled) {
        const mlLoaded = await loadModel();
        logger.info(`🤖 ML Model: ${mlLoaded ? 'Loaded' : 'Not available'}`);
    }

    // 2. Connect to Bybit WebSocket
    try {
        await bybitConnector.connect(config.monitoredSymbols);

        bybitConnector.on('connected', () => {
            logger.info('✅ Bybit WebSocket connected');
        });

        bybitConnector.on('disconnected', () => {
            logger.warn('⚠️ Bybit WebSocket disconnected');
        });

        bybitConnector.on('reconnecting', () => {
            sendWebSocketReconnectAlert('Bybit', 1).catch(() => { });
        });

        bybitConnector.on('price:update', (tickers) => {
            // Broadcast prices to dashboard clients
            const prices: Record<string, number> = {};
            for (const [symbol, ticker] of tickers) {
                prices[symbol] = ticker.lastPrice;
            }
            broadcastPrices(prices);

            // Update paper trading positions
            const closedOrders = paperTradingEngine.tickUpdate(prices);
            if (closedOrders.length > 0) {
                broadcastPositions(
                    paperTradingEngine.getState().positions.filter(p => p.status === 'open')
                );
                broadcastPortfolio(paperTradingEngine.getState());
            }
        });
    } catch (error) {
        logger.error('Failed to connect to Bybit', { error });
    }

    // 3. Start signal engine
    startEngine();
    logger.info('📊 Signal engine started');

    // 4. Start system monitor
    startSystemMonitor(config.engine.healthCheckMs);
    logger.info('🔍 System monitor started');

    // 5. Start HTTP server
    server.listen(config.port, () => {
        logger.info(`🌐 API server listening on port ${config.port}`);
        logger.info(`💡 Health check: http://localhost:${config.port}/api/health`);
        logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    // 6. Send startup notification
    if (telegramService.isEnabled) {
        await sendSystemStartAlert();
    }
}

// ──── Graceful Shutdown ────

function shutdown(signal: string): void {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    stopEngine();
    bybitConnector.disconnect();
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
    // Force exit after 10 seconds
    setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    sendCriticalErrorAlert(error.message, 'uncaughtException').catch(() => { });
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
    sendCriticalErrorAlert(String(reason), 'unhandledRejection').catch(() => { });
});

// ──── Start ────

bootstrap().catch((error) => {
    logger.error('Fatal startup error', { error });
    process.exit(1);
});
