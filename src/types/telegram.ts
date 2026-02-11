// Telegram Integration Types

import { AssetCategory } from './trading';

// ──────────── Notification Types ────────────

export type TelegramNotificationType =
    | 'new_signal'
    | 'take_profit'
    | 'stop_loss'
    | 'risk_alert'
    | 'daily_summary'
    | 'market_alert'
    | 'funding_rate';

// ──────────── Configuration ────────────

export interface TelegramDestination {
    id: string;
    chatId: string;
    name: string;
    minScore: number;
    enabledTypes: TelegramNotificationType[];
    enabled: boolean;
}

export interface NotificationFilters {
    minScore: number;
    categories: AssetCategory[];
    directions: ('long' | 'short')[];
    silentHoursStart: number; // 0-23
    silentHoursEnd: number;   // 0-23
    silentHoursEnabled: boolean;
    maxPerHourPerCoin: number;
    minRiskReward: number;
}

export interface TelegramConfig {
    enabled: boolean;
    paused: boolean;
    destinations: TelegramDestination[];
    filters: NotificationFilters;
    enabledTypes: Record<TelegramNotificationType, boolean>;
}

// ──────────── Message Log ────────────

export interface TelegramMessageLog {
    id: string;
    timestamp: number;
    type: TelegramNotificationType;
    chatId: string;
    symbol?: string;
    preview: string;
    success: boolean;
    error?: string;
}

// ──────────── Service Types ────────────

export interface TelegramSendResult {
    success: boolean;
    messageId?: number;
    error?: string;
}

// ──────────── Daily Summary Data ────────────

export interface DailySummaryData {
    date: string;
    signalsGenerated: number;
    winners: number;
    losers: number;
    pnlPercent: number;
    bestTrade?: { symbol: string; pnlPercent: number };
    worstTrade?: { symbol: string; pnlPercent: number };
    topSignals: Array<{ symbol: string; type: 'long' | 'short'; score: number }>;
    alerts: string[];
}

// ──────────── Market Alert Data ────────────

export interface MarketAlertData {
    symbol: string;
    description: string;
    changePercent: number;
    period: string;
    liquidations?: number;
    recommendation: string;
}

export interface FundingRateAlertData {
    symbol: string;
    fundingRate: number;
    bias: 'long' | 'short';
    recommendation: string;
}

// ──────────── Signal Notification Data ────────────

export interface SignalNotificationData {
    type: 'long' | 'short';
    symbol: string;
    score: number;
    scoreLabel: string;
    timeframe: string;
    currentPrice: number;
    entryZone: { min: number; max: number };
    stopLoss: { price: number; percent: number };
    takeProfits: Array<{
        level: number;
        price: number;
        percent: number;
        closePercent: number;
    }>;
    riskReward: number;
    confluences: Array<{ name: string; confirmed: boolean }>;
    leverage: number;
    positionSizePercent: number;
    riskPercent: number;
    timestamp: string;
}

export interface TakeProfitNotificationData {
    symbol: string;
    tpLevel: number;
    price: number;
    percent: number;
    duration: string;
    remainingPercent: number;
    nextTarget?: { level: number; price: number };
}

export interface StopLossNotificationData {
    symbol: string;
    price: number;
    percent: number;
    duration: string;
    dailyWinRate: number;
    dailyWins: number;
    dailyLosses: number;
}

export interface RiskAlertNotificationData {
    alertType: string;
    currentValue: number;
    limit: number;
    recommendation: string;
    timestamp: string;
}

// ──────────── Defaults ────────────

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
    enabled: false,
    paused: false,
    destinations: [],
    filters: {
        minScore: 70,
        categories: [],
        directions: ['long', 'short'],
        silentHoursStart: 0,
        silentHoursEnd: 7,
        silentHoursEnabled: false,
        maxPerHourPerCoin: 1,
        minRiskReward: 1.5,
    },
    enabledTypes: {
        new_signal: true,
        take_profit: true,
        stop_loss: true,
        risk_alert: true,
        daily_summary: true,
        market_alert: true,
        funding_rate: true,
    },
};
