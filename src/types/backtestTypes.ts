// ═══════════════════════════════════════════════════════════
// Backtest Types — All interfaces for the backtesting system
// ═══════════════════════════════════════════════════════════

// ──────────── Configuration ────────────

export interface BacktestConfig {
    // Período
    startDate: string;   // ISO date e.g. "2023-01-01"
    endDate: string;     // ISO date e.g. "2024-12-31"

    // Ativos
    symbols: string[];   // e.g. ["BTCUSDT", "ETHUSDT"] ou todos
    timeframe: BacktestTimeframe;

    // Capital
    initialCapital: number;
    currency: string;    // "USDT"

    // Execução
    execution: ExecutionConfig;

    // Filtros de sinal
    signal: SignalFilterConfig;

    // Gestão de risco
    risk: RiskConfig;
}

export type BacktestTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface ExecutionConfig {
    spread: number;          // % de spread (ex: 0.02)
    slippage: number;        // % de slippage (ex: 0.05)
    makerFee: number;        // % taxa maker (ex: 0.02)
    takerFee: number;        // % taxa taker (ex: 0.05)
    useMarketOrders: boolean;
}

export interface SignalFilterConfig {
    minScore: number;                  // score mínimo para entrar (ex: 70)
    maxSimultaneousPositions: number;  // máximo posições abertas (ex: 5)
    maxCapitalPerPosition: number;     // % máximo por posição (ex: 20)
    allowLong: boolean;
    allowShort: boolean;
}

export interface RiskConfig {
    useProfilePerSymbol: boolean;   // usa perfil individual por moeda
    maxDailyDrawdown: number;       // % máximo de perda por dia
    maxTotalDrawdown: number;       // % máximo de perda total
    stopTradingOnMaxDrawdown: boolean;
}

// ──────────── Trade Result ────────────

export interface BacktestTrade {
    id: string;
    symbol: string;
    type: 'long' | 'short';

    // ML Features (Added for training)
    mlFeatures?: Record<string, number>;
    entryTime: number;         // timestamp
    exitTime: number;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    leverage: number;

    // PnL
    grossPnl: number;
    fees: number;
    fundingPaid: number;
    netPnl: number;
    pnlPercent: number;        // % do capital no momento da entrada

    // Saída
    exitReason: 'tp1' | 'tp2' | 'tp3' | 'sl' | 'trailing_sl' | 'signal_flip' | 'drawdown_limit' | 'end_of_data';

    // Sinal
    signalScore: number;
    signalConfidence: number;
    signalIndicators: string[];
    riskScore: number;

    // Intra-trade
    maxFavorableExcursion: number;   // Maior ganho não realizado (%)
    maxAdverseExcursion: number;     // Maior perda não realizada (%)
    duration: number;                // ms
}

// ──────────── Equity Point ────────────

export interface EquityPoint {
    timestamp: number;
    equity: number;
    drawdown: number;           // % do pico
    drawdownValue: number;      // valor absoluto
    openPositions: number;
}

// ──────────── Métricas ────────────

export interface BacktestMetrics {
    main: MainMetrics;
    risk: RiskMetrics;
    time: TimeMetrics;
    signal: SignalMetrics;
}

export interface MainMetrics {
    initialCapital: number;
    finalCapital: number;
    totalPnL: number;
    totalPnLPercent: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;              // 0-100
    winRateLong: number;
    winRateShort: number;
    totalLongTrades: number;
    totalShortTrades: number;
    avgWin: number;
    avgLoss: number;
    avgWinPercent: number;
    avgLossPercent: number;
    largestWin: number;
    largestLoss: number;
    expectancy: number;           // Ganho esperado por trade
    totalFees: number;
    totalFundingPaid: number;
}

export interface RiskMetrics {
    maxDrawdown: number;          // valor
    maxDrawdownPercent: number;   // %
    maxDrawdownStart: number;     // timestamp
    maxDrawdownEnd: number;       // timestamp
    maxDrawdownDuration: number;  // ms
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    profitFactor: number;
    recoveryFactor: number;
    avgRiskReward: number;
}

export interface TimeMetrics {
    avgWinDuration: number;       // ms
    avgLossDuration: number;
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
    bestMonth: MonthlyPerformance;
    worstMonth: MonthlyPerformance;
    monthlyPerformance: MonthlyPerformance[];
    dayOfWeekPerformance: DayPerformance[];
    hourOfDayPerformance: HourPerformance[];
}

export interface MonthlyPerformance {
    year: number;
    month: number;
    pnl: number;
    pnlPercent: number;
    trades: number;
    winRate: number;
}

export interface DayPerformance {
    day: number;          // 0=Sunday, 6=Saturday
    dayName: string;
    pnl: number;
    trades: number;
    winRate: number;
}

export interface HourPerformance {
    hour: number;         // 0-23
    pnl: number;
    trades: number;
    winRate: number;
}

export interface SignalMetrics {
    topWinningSignals: SignalContribution[];
    topLosingSignals: SignalContribution[];
    avgScoreWinners: number;
    avgScoreLosers: number;
    avgConfidenceWinners: number;
    avgConfidenceLosers: number;
    bestCombinations: SignalCombination[];
}

export interface SignalContribution {
    signal: string;
    appearances: number;
    totalPnl: number;
    winRate: number;
}

export interface SignalCombination {
    signals: string[];
    trades: number;
    winRate: number;
    avgPnl: number;
    totalPnl: number;
}

// ──────────── Backtest Result ────────────

export interface BacktestResult {
    id: string;
    config: BacktestConfig;
    metrics: BacktestMetrics;
    trades: BacktestTrade[];
    equityCurve: EquityPoint[];
    buyAndHoldComparison: BuyAndHoldComparison;
    timestamp: number;            // quando o backtest foi executado
    durationMs: number;           // tempo de execução
}

export interface BuyAndHoldComparison {
    symbol: string;               // Primeiro símbolo ou BTC
    startPrice: number;
    endPrice: number;
    returnPercent: number;
    equityCurve: EquityPoint[];
}

// ──────────── Otimização ────────────

export interface OptimizationConfig {
    baseConfig: BacktestConfig;
    parameters: OptimizableParam[];
    rankBy: 'profit' | 'sharpe' | 'drawdown' | 'riskAdjusted';
    maxCombinations?: number;     // Limite de combinações
}

export interface OptimizableParam {
    name: string;
    field: string;                // path no config (ex: "signal.minScore")
    values: number[];             // valores a testar
}

export interface OptimizationResult {
    id: string;
    totalCombinations: number;
    completedCombinations: number;
    results: OptimizationEntry[];
    bestByProfit: OptimizationEntry;
    bestBySharpe: OptimizationEntry;
    bestByDrawdown: OptimizationEntry;
    bestByRiskAdjusted: OptimizationEntry;
    overfittingWarnings: string[];
    timestamp: number;
}

export interface OptimizationEntry {
    rank: number;
    params: Record<string, number>;
    totalPnL: number;
    totalPnLPercent: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdownPercent: number;
    profitFactor: number;
    totalTrades: number;
}

// ──────────── Walk Forward ────────────

export interface WalkForwardConfig {
    baseConfig: BacktestConfig;
    optimizationConfig: OptimizationConfig;
    windowMonths: number;          // Tamanho da janela (ex: 6)
    inSampleRatio: number;        // Proporção in-sample (ex: 0.6 = 60%)
}

export interface WalkForwardResult {
    id: string;
    windows: WalkForwardWindow[];
    overallEfficiency: number;     // OOS profit / IS profit ratio
    isConsistent: boolean;         // Se >50% das janelas OOS foram lucrativas
    summary: string;
    timestamp: number;
}

export interface WalkForwardWindow {
    windowIndex: number;
    inSampleStart: number;
    inSampleEnd: number;
    outOfSampleStart: number;
    outOfSampleEnd: number;
    bestParams: Record<string, number>;
    inSamplePnL: number;
    inSamplePnLPercent: number;
    outOfSamplePnL: number;
    outOfSamplePnLPercent: number;
    inSampleWinRate: number;
    outOfSampleWinRate: number;
    efficiency: number;            // OOS / IS ratio
}

// ──────────── Progresso ────────────

export interface BacktestProgress {
    phase: 'fetching_data' | 'warming_up' | 'simulating' | 'analyzing' | 'optimizing' | 'walk_forward' | 'complete' | 'error';
    currentSymbol?: string;
    currentBar?: number;
    totalBars?: number;
    percentComplete: number;       // 0-100
    message: string;
    estimatedTimeRemaining?: number; // ms
}

// ──────────── Alertas de Divergência ────────────

export interface BacktestAlert {
    id: string;
    type: 'win_rate_drift' | 'drawdown_exceeded' | 'market_regime_change' | 'revalidation_needed';
    severity: 'info' | 'warning' | 'critical';
    message: string;
    backtestValue: number;
    realValue: number;
    deviation: number;            // %
    timestamp: number;
    dismissed: boolean;
}

// ──────────── Cache ────────────

export interface OHLCCacheEntry {
    symbol: string;
    timeframe: BacktestTimeframe;
    data: import('@/services/coingeckoOHLC').OHLCPoint[];
    fetchedAt: number;
    startTimestamp: number;
    endTimestamp: number;
}

// ──────────── Defaults ────────────

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    symbols: ['BTCUSDT'],
    timeframe: '1h',
    initialCapital: 10000,
    currency: 'USDT',
    execution: {
        spread: 0.02,
        slippage: 0.05,
        makerFee: 0.02,
        takerFee: 0.05,
        useMarketOrders: true,
    },
    signal: {
        minScore: 70,
        maxSimultaneousPositions: 5,
        maxCapitalPerPosition: 20,
        allowLong: true,
        allowShort: true,
    },
    risk: {
        useProfilePerSymbol: true,
        maxDailyDrawdown: 5,
        maxTotalDrawdown: 20,
        stopTradingOnMaxDrawdown: true,
    },
};
