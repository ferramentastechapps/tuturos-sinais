// ═══════════════════════════════════════════════════════════
// Symbol Configuration — Calibração por Moeda
// ENGINE é universal; PARÂMETROS são específicos por ativo
// ═══════════════════════════════════════════════════════════

export interface SymbolConfig {
    /** Timeframe principal de análise (Bybit interval format: '1', '5', '15', '60', '240', 'D') */
    timeframe: string;
    /** Número de candles para lookback no cálculo de níveis de S/R */
    lookback: number;
    /** RVOL mínimo para confirmar volume no sinal */
    minVolumeRatio: number;
    /** Espaçamento mínimo entre níveis de S/R (em % do preço) */
    levelSpacing: number;
    /** Candles de confirmação após teste de nível */
    confirmationCandles: number;
    /** Distância mínima entre dois níveis válidos (em % do preço) */
    minLevelsDistance: number;
    /** Timeframe de suporte para MTF em minutos (para override do fetch principal) */
    primaryIntervalMinutes: number;
}

// ──── Configurações por Símbolo ────

export const symbolConfigs: Record<string, SymbolConfig> = {

    // ── MOEDAS GRANDES — Layer 1 / Top 10 ──────────────────────
    // Alta liquidez: usa timeframes maiores, mais confirmação, mais volume relativo

    BTCUSDT: {
        timeframe: '240',          // 4H
        primaryIntervalMinutes: 240,
        lookback: 100,
        minVolumeRatio: 1.2,
        levelSpacing: 0.02,        // 2%
        confirmationCandles: 3,
        minLevelsDistance: 1.0,
    },

    ETHUSDT: {
        timeframe: '60',           // 1H
        primaryIntervalMinutes: 60,
        lookback: 50,
        minVolumeRatio: 1.3,
        levelSpacing: 0.015,       // 1.5%
        confirmationCandles: 2,
        minLevelsDistance: 0.8,
    },

    SOLUSDT: {
        timeframe: '60',
        primaryIntervalMinutes: 60,
        lookback: 40,
        minVolumeRatio: 1.4,
        levelSpacing: 0.01,        // 1%
        confirmationCandles: 2,
        minLevelsDistance: 0.6,
    },

    BNBUSDT: {
        timeframe: '60',
        primaryIntervalMinutes: 60,
        lookback: 45,
        minVolumeRatio: 1.3,
        levelSpacing: 0.012,
        confirmationCandles: 2,
        minLevelsDistance: 0.7,
    },

    XRPUSDT: {
        timeframe: '60',
        primaryIntervalMinutes: 60,
        lookback: 45,
        minVolumeRatio: 1.3,
        levelSpacing: 0.01,
        confirmationCandles: 2,
        minLevelsDistance: 0.6,
    },

    ADAUSDT: {
        timeframe: '60',
        primaryIntervalMinutes: 60,
        lookback: 40,
        minVolumeRatio: 1.4,
        levelSpacing: 0.008,
        confirmationCandles: 2,
        minLevelsDistance: 0.5,
    },

    TRXUSDT: {
        timeframe: '60',
        primaryIntervalMinutes: 60,
        lookback: 40,
        minVolumeRatio: 1.4,
        levelSpacing: 0.008,
        confirmationCandles: 2,
        minLevelsDistance: 0.5,
    },

    LTCUSDT: {
        timeframe: '60',
        primaryIntervalMinutes: 60,
        lookback: 40,
        minVolumeRatio: 1.4,
        levelSpacing: 0.01,
        confirmationCandles: 2,
        minLevelsDistance: 0.6,
    },

    ATOMUSDT: {
        timeframe: '60',
        primaryIntervalMinutes: 60,
        lookback: 35,
        minVolumeRatio: 1.5,
        levelSpacing: 0.012,
        confirmationCandles: 2,
        minLevelsDistance: 0.6,
    },

    MATICUSDT: {
        timeframe: '60',
        primaryIntervalMinutes: 60,
        lookback: 35,
        minVolumeRatio: 1.5,
        levelSpacing: 0.01,
        confirmationCandles: 2,
        minLevelsDistance: 0.5,
    },

    // ── MOEDAS MÉDIAS — Mid Cap ─────────────────────────────────
    // Liquidez moderada: timeframes menores, mais exigência de volume

    LINKUSDT: {
        timeframe: '60',
        primaryIntervalMinutes: 60,
        lookback: 35,
        minVolumeRatio: 1.5,
        levelSpacing: 0.015,
        confirmationCandles: 2,
        minLevelsDistance: 0.6,
    },

    AVAXUSDT: {
        timeframe: '15',           // 15M
        primaryIntervalMinutes: 15,
        lookback: 30,
        minVolumeRatio: 1.6,
        levelSpacing: 0.01,
        confirmationCandles: 2,
        minLevelsDistance: 0.5,
    },

    DOTUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 30,
        minVolumeRatio: 1.6,
        levelSpacing: 0.012,
        confirmationCandles: 2,
        minLevelsDistance: 0.5,
    },

    APTUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 30,
        minVolumeRatio: 1.6,
        levelSpacing: 0.012,
        confirmationCandles: 2,
        minLevelsDistance: 0.5,
    },

    ARBUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 30,
        minVolumeRatio: 1.7,
        levelSpacing: 0.012,
        confirmationCandles: 2,
        minLevelsDistance: 0.5,
    },

    OPUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 30,
        minVolumeRatio: 1.7,
        levelSpacing: 0.012,
        confirmationCandles: 2,
        minLevelsDistance: 0.5,
    },

    UNIUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 30,
        minVolumeRatio: 1.6,
        levelSpacing: 0.012,
        confirmationCandles: 2,
        minLevelsDistance: 0.5,
    },

    AAVEUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 30,
        minVolumeRatio: 1.6,
        levelSpacing: 0.015,
        confirmationCandles: 2,
        minLevelsDistance: 0.5,
    },

    INJUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 28,
        minVolumeRatio: 1.7,
        levelSpacing: 0.012,
        confirmationCandles: 2,
        minLevelsDistance: 0.5,
    },

    SUIUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 28,
        minVolumeRatio: 1.7,
        levelSpacing: 0.01,
        confirmationCandles: 2,
        minLevelsDistance: 0.45,
    },

    NEARUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 28,
        minVolumeRatio: 1.7,
        levelSpacing: 0.012,
        confirmationCandles: 2,
        minLevelsDistance: 0.5,
    },

    JUPUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 28,
        minVolumeRatio: 1.8,
        levelSpacing: 0.01,
        confirmationCandles: 2,
        minLevelsDistance: 0.4,
    },

    RENDERUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 28,
        minVolumeRatio: 1.8,
        levelSpacing: 0.01,
        confirmationCandles: 2,
        minLevelsDistance: 0.4,
    },

    IMXUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 25,
        minVolumeRatio: 1.8,
        levelSpacing: 0.01,
        confirmationCandles: 2,
        minLevelsDistance: 0.4,
    },

    FTMUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 28,
        minVolumeRatio: 1.8,
        levelSpacing: 0.01,
        confirmationCandles: 2,
        minLevelsDistance: 0.45,
    },

    FILUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 28,
        minVolumeRatio: 1.7,
        levelSpacing: 0.012,
        confirmationCandles: 2,
        minLevelsDistance: 0.5,
    },

    // ── MOEDAS PEQUENAS — Small Cap ─────────────────────────────
    // Menor liquidez: timeframes curtos, exigência de volume MAIOR

    THETAUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 25,
        minVolumeRatio: 1.8,
        levelSpacing: 0.008,
        confirmationCandles: 1,
        minLevelsDistance: 0.4,
    },

    STXUSDT: {
        timeframe: '15',
        primaryIntervalMinutes: 15,
        lookback: 25,
        minVolumeRatio: 2.0,
        levelSpacing: 0.006,
        confirmationCandles: 1,
        minLevelsDistance: 0.3,
    },

    // ── MEMECOINS — Alta Volatilidade ───────────────────────────
    // Movimentos rápidos: timeframes mínimos, exigência de volume MUITO ALTA

    DOGEUSDT: {
        timeframe: '5',            // 5M
        primaryIntervalMinutes: 5,
        lookback: 20,
        minVolumeRatio: 2.5,
        levelSpacing: 0.005,
        confirmationCandles: 1,
        minLevelsDistance: 0.2,
    },

    SHIBUSDT: {
        timeframe: '5',
        primaryIntervalMinutes: 5,
        lookback: 20,
        minVolumeRatio: 3.0,
        levelSpacing: 0.003,
        confirmationCandles: 1,
        minLevelsDistance: 0.15,
    },
};

// ──── Configuração Padrão (Fallback) ────────────────────────
// Usada para qualquer símbolo não listado acima

export const DEFAULT_SYMBOL_CONFIG: SymbolConfig = {
    timeframe: '60',
    primaryIntervalMinutes: 60,
    lookback: 50,
    minVolumeRatio: 1.5,
    levelSpacing: 0.015,
    confirmationCandles: 2,
    minLevelsDistance: 0.6,
};

// ──── Helpers ────────────────────────────────────────────────

/**
 * Retorna a configuração calibrada para um símbolo.
 * Se não existir config específica, usa o DEFAULT.
 */
export function getSymbolConfig(symbol: string): SymbolConfig {
    return symbolConfigs[symbol] ?? DEFAULT_SYMBOL_CONFIG;
}

/**
 * Ajusta dinamicamente os parâmetros baseado na volatilidade real atual.
 * Chame com os últimos 20 candles para calcular a volatilidade média.
 *
 * @param symbol   Par de moedas (ex: 'BTCUSDT')
 * @param closes   Array de preços de fechamento (mínimo 20 candles)
 * @returns        Config ajustada dinamicamente
 */
export function getDynamicSymbolConfig(symbol: string, closes: number[]): SymbolConfig {
    const base = getSymbolConfig(symbol);

    if (closes.length < 20) return base;

    // Calcula volatilidade como desvio padrão % dos últimos 20 fechamentos
    const slice = closes.slice(-20);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, v) => a + Math.pow((v - mean) / mean, 2), 0) / slice.length;
    const volatilityPct = Math.sqrt(variance) * 100; // em %

    return {
        ...base,
        // Se muito volátil (>5%), exige mais confirmações
        confirmationCandles: volatilityPct > 5
            ? Math.min(base.confirmationCandles + 1, 3)
            : base.confirmationCandles,
        // Se volume muito baixo (volatilidade <1%), exige mais volume relativo
        minVolumeRatio: volatilityPct < 1
            ? base.minVolumeRatio * 1.5
            : base.minVolumeRatio,
    };
}
