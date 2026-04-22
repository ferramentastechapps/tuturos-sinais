// Global Configuration — Centralized env config with defaults

import dotenv from 'dotenv';
dotenv.config();

export const config = {
    // Server
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'https://sinaiscripto.ftech-apps.com.br,http://212.85.10.239,http://localhost:5173,http://localhost:3000,http://192.168.15.35:8080,http://192.168.18.209:8080,http://localhost:8080',

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
        scalpingChatId: process.env.TELEGRAM_SCALPING_CHAT_ID || '',
        enabled: process.env.TELEGRAM_ENABLED === 'true',
        minScore: parseInt(process.env.TELEGRAM_MIN_SCORE || '85', 10),
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

    // Risk Management
    riskManagement: {
        riskPercent: parseFloat(process.env.RISK_PERCENT || '3.0'),   // % da banca por trade
        marginPercent: parseFloat(process.env.MARGIN_PERCENT || '10.0'), // % da banca como margem
    },

    // Signal engine intervals
    engine: {
        signalIntervalMs: parseInt(process.env.SIGNAL_INTERVAL_MS || '300000', 10), // 5 min
        priceUpdateMs: parseInt(process.env.PRICE_UPDATE_MS || '5000', 10), // 5 sec
        healthCheckMs: parseInt(process.env.HEALTH_CHECK_MS || '60000', 10), // 1 min
        maxSignalsPerDay: parseInt(process.env.MAX_SIGNALS_PER_DAY || '3', 10), // FASE 1: Reduzido de 5 para 3 (qualidade > quantidade)
    },

    // Scalping Bot — second signal mode (5m timeframe, separate Telegram channel)
    scalpingBot: {
        enabled: process.env.SCALPING_BOT_ENABLED === 'true',
        chatId: process.env.TELEGRAM_SCALPING_CHAT_ID || '',
        intervalMs: parseInt(process.env.SCALPING_INTERVAL_MS || '60000', 10), // 1 min
        // FASE 1: Score aumentado de 80 para 85 (apenas sinais excelentes)
        minScore: parseInt(process.env.SCALPING_MIN_SCORE || '85', 10),
        // FASE 1: ML threshold aumentado de 62% para 65% (vantagem real)
        mlMinProb: parseFloat(process.env.SCALPING_ML_MIN_PROB || '0.65'),
        cooldownMs: parseInt(process.env.SCALPING_COOLDOWN_MS || '1800000', 10), // 30 min
    },

    // Pares dedicados ao scalping — apenas alta liquidez (5m funciona mal em altcoins spot)
    // Foram removidos: API3, UMA, GMT, ZEC, DASH, THETA, KAVA, etc (Top 10 Losses no dashboard)
    scalpingSymbols: (process.env.SCALPING_SYMBOLS ||
        'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,ADAUSDT,AVAXUSDT,DOGEUSDT,LINKUSDT,DOTUSDT,LTCUSDT,ATOMUSDT,NEARUSDT,APTUSDT,SUIUSDT,ARBUSDT,OPUSDT,INJUSDT,UNIUSDT,AAVEUSDT,MATICUSDT,TONUSDT,FTMUSDT,RUNEUSDT,SHIB1000USDT,1000PEPEUSDT'
    ).split(','),

    // Monitored symbols for Bybit (Matched with Frontend Dashboard)
    monitoredSymbols: (process.env.MONITORED_SYMBOLS || 
        'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,ADAUSDT,AVAXUSDT,DOTUSDT,ATOMUSDT,NEARUSDT,APTUSDT,SUIUSDT,TONUSDT,TRXUSDT,LTCUSDT,BCHUSDT,FILUSDT,ICPUSDT,ALGOUSDT,VETUSDT,HBARUSDT,EOSUSDT,XLMUSDT,THETAUSDT,EGLDUSDT,FTMUSDT,KAVAUSDT,INJUSDT,SEIUSDT,TIAUSDT,STXUSDT,MATICUSDT,ARBUSDT,OPUSDT,IMXUSDT,STRKUSDT,MANTAUSDT,ZKUSDT,UNIUSDT,AAVEUSDT,CRVUSDT,MKRUSDT,SNXUSDT,COMPUSDT,SUSHIUSDT,1INCHUSDT,LDOUSDT,PENDLEUSDT,DYDXUSDT,RUNEUSDT,JUPUSDT,ENAUSDT,PYTHUSDT,DOGEUSDT,SHIB1000USDT,1000PEPEUSDT,1000FLOKIUSDT,1000BONKUSDT,WIFUSDT,MEMEUSDT,AXSUSDT,SANDUSDT,MANAUSDT,ENJUSDT,GALAUSDT,BEAMUSDT,RONUSDT,PIXELUSDT,FETUSDT,RNDRUSDT,TAOUSDT,WLDUSDT,GRTUSDT,API3USDT,LINKUSDT,BANDUSDT,UMAUSDT,TRBUSDT,ZECUSDT,DASHUSDT,ROSEUSDT,ONDOUSDT,BLURUSDT,CHZUSDT,APEUSDT,GMTUSDT,CAKEUSDT,YFIUSDT'
    ).split(','),
} as const;
