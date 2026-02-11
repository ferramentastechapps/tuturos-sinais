// Global Configuration — Centralized env config with defaults

import dotenv from 'dotenv';
dotenv.config();

export const config = {
    // Server
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

    // Bybit
    bybit: {
        apiKey: process.env.BYBIT_API_KEY || '',
        apiSecret: process.env.BYBIT_API_SECRET || '',
        testnet: process.env.BYBIT_TESTNET === 'true',
    },

    // Supabase
    supabase: {
        url: process.env.SUPABASE_URL || '',
        serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
    },

    // Telegram
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || '',
        enabled: process.env.TELEGRAM_ENABLED === 'true',
        minScore: parseInt(process.env.TELEGRAM_MIN_SCORE || '70', 10),
    },

    // System
    ml: {
        enabled: process.env.ML_ENABLED !== 'false',
        modelPath: process.env.ML_MODEL_PATH || './current_model.onnx',
    },

    paperTrading: {
        autoEnabled: process.env.PAPER_TRADING_AUTO === 'true',
        maxPositions: parseInt(process.env.MAX_SIMULTANEOUS_POSITIONS || '5', 10),
    },

    // Signal engine intervals
    engine: {
        signalIntervalMs: parseInt(process.env.SIGNAL_INTERVAL_MS || '300000', 10), // 5 min
        priceUpdateMs: parseInt(process.env.PRICE_UPDATE_MS || '5000', 10), // 5 sec
        healthCheckMs: parseInt(process.env.HEALTH_CHECK_MS || '60000', 10), // 1 min
    },

    // Monitored symbols for Bybit
    monitoredSymbols: (process.env.MONITORED_SYMBOLS || 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,DOGEUSDT,ADAUSDT,AVAXUSDT,DOTUSDT,LINKUSDT').split(','),
} as const;
