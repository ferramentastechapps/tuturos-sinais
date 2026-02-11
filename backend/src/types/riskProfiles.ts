// Risk Profiles — Direct port from frontend

import { AssetCategory } from './trading.js';

export type RiskProfileType = 'conservative' | 'moderate' | 'aggressive' | 'speculative';

export interface RiskProfileBase {
    type: RiskProfileType;
    label: string;
    description: string;
    maxLeverage: number;
    stopLoss: { min: number; max: number };
    takeProfit: { tp1: number; tp2: number; tp3: number };
    maxRiskPerTrade: number;
    maxPositionSize: number;
}

export interface LeverageConfig {
    min: number;
    max: number;
    suggested: number;
    autoAdjust: boolean;
}

export interface StopLossConfig {
    min: number;
    max: number;
    atrMultiplier: number;
    useTrailingStop: boolean;
    trailingDistance: number;
}

export interface TakeProfitLevel {
    percent: number;
    closePercent: number;
}

export interface TakeProfitConfig {
    tp1: TakeProfitLevel;
    tp2: TakeProfitLevel;
    tp3: TakeProfitLevel;
    useFibonacci: boolean;
}

export interface PositionConfig {
    maxRiskPercent: number;
    maxPositionPercent: number;
    minRiskReward: number;
}

export type LiquidityLevel = 'low' | 'medium' | 'high';

export interface FilterConfig {
    minVolume24h: number;
    minLiquidity: LiquidityLevel;
    avoidHighFunding: boolean;
    maxFundingRate: number;
    tradingHours: 'all' | string;
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

export interface CategoryLimit {
    category: AssetCategory;
    maxPositions: number;
}

export interface GlobalRiskLimits {
    maxOpenPositions: number;
    maxCapitalAllocated: number;
    maxPositionsPerCategory: CategoryLimit[];
    portfolioCapital: number;
    maxDailyDrawdown: number;
    maxWeeklyDrawdown: number;
    maxConsecutiveLosses: number;
}

export type AdjustmentAction = 'increase_stop' | 'decrease_stop' | 'reduce_leverage' | 'maintain' | 'block';

export interface RiskAdjustment {
    symbol: string;
    timestamp: number;
    action: AdjustmentAction;
    field: string;
    oldValue: number;
    newValue: number;
    reason: string;
    conditions: string[];
}

export interface AdjustedRiskConfig extends AssetRiskConfig {
    adjustments: RiskAdjustment[];
    isBlocked: boolean;
    blockReasons: string[];
}

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
