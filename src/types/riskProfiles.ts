// Risk Profiles — Tipos centrais para gestão de risco individualizada por ativo

import { AssetCategory } from './trading';

// ──────────── Perfis de Risco ────────────

export type RiskProfileType = 'conservative' | 'moderate' | 'aggressive' | 'speculative';

export interface RiskProfileBase {
    type: RiskProfileType;
    label: string;
    description: string;
    maxLeverage: number;
    stopLoss: { min: number; max: number };
    takeProfit: { tp1: number; tp2: number; tp3: number };
    maxRiskPerTrade: number;   // % do capital
    maxPositionSize: number;   // % do capital
}

// ──────────── Configuração Individual por Moeda ────────────

export interface LeverageConfig {
    min: number;
    max: number;
    suggested: number;
    autoAdjust: boolean;
}

export interface StopLossConfig {
    min: number;           // % mínimo
    max: number;           // % máximo
    atrMultiplier: number; // stop baseado em ATR
    useTrailingStop: boolean;
    trailingDistance: number; // % de distância do trailing
}

export interface TakeProfitLevel {
    percent: number;
    closePercent: number;  // % da posição a fechar neste nível
}

export interface TakeProfitConfig {
    tp1: TakeProfitLevel;
    tp2: TakeProfitLevel;
    tp3: TakeProfitLevel;
    useFibonacci: boolean;
}

export interface PositionConfig {
    maxRiskPercent: number;      // % máximo do capital em risco
    maxPositionPercent: number;  // % máximo do capital na posição
    minRiskReward: number;       // RR mínimo para abrir operação
}

export type LiquidityLevel = 'low' | 'medium' | 'high';

export interface FilterConfig {
    minVolume24h: number;        // volume mínimo em USD para operar
    minLiquidity: LiquidityLevel;
    avoidHighFunding: boolean;   // evita entrar quando funding > maxFundingRate
    maxFundingRate: number;      // % (ex: 0.1 = 0.1%)
    tradingHours: 'all' | string; // 'all' ou horários específicos
}

export interface AssetRiskConfig {
    symbol: string;
    name: string;
    category: AssetCategory;
    riskProfile: RiskProfileType;
    enabled: boolean;

    leverage: LeverageConfig;
    stopLoss: StopLossConfig;
    takeProfit: TakeProfitConfig;
    position: PositionConfig;
    filters: FilterConfig;
}

// ──────────── Limites Globais ────────────

export interface CategoryLimit {
    category: AssetCategory;
    maxPositions: number;
}

export interface GlobalRiskLimits {
    maxOpenPositions: number;          // máximo de posições abertas simultâneas
    maxCapitalAllocated: number;       // % máximo do capital alocado ao mesmo tempo
    maxPositionsPerCategory: CategoryLimit[];
    portfolioCapital: number;          // capital total do portfólio em USD
    maxDailyDrawdown: number;          // % máximo de drawdown diário
    maxWeeklyDrawdown: number;         // % máximo de drawdown semanal
    maxConsecutiveLosses: number;      // número máximo de perdas consecutivas
}

// ──────────── Ajustes Dinâmicos ────────────

export type AdjustmentAction = 'increase_stop' | 'decrease_stop' | 'reduce_leverage' | 'maintain' | 'block';

export interface RiskAdjustment {
    symbol: string;
    timestamp: number;
    action: AdjustmentAction;
    field: string;            // campo ajustado
    oldValue: number;
    newValue: number;
    reason: string;
    conditions: string[];     // condições que geraram o ajuste
}

export interface AdjustedRiskConfig extends AssetRiskConfig {
    adjustments: RiskAdjustment[];
    isBlocked: boolean;
    blockReasons: string[];
}

// ──────────── Logs ────────────

export type RiskLogType = 'adjustment' | 'alert' | 'block' | 'trade' | 'report';

export interface RiskLogEntry {
    id: string;
    timestamp: number;
    type: RiskLogType;
    symbol?: string;
    message: string;
    details?: Record<string, unknown>;
    severity: 'info' | 'warning' | 'critical';
}

export interface DailyReport {
    date: string;              // YYYY-MM-DD
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;           // %
    totalRiskUsed: number;     // % do capital
    dailyDrawdown: number;     // %
    weeklyDrawdown: number;    // %
    topTradedAssets: Array<{ symbol: string; trades: number; pnl: number }>;
    adjustmentsMade: number;
    alertsTriggered: number;
    blockedOperations: number;
}
