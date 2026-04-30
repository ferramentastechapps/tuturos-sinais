// ═══════════════════════════════════════════════════════════
// Strategy Types — Interface comum para estratégias plugáveis
// Integra com BacktestEngine sem alterar sua estrutura
// ═══════════════════════════════════════════════════════════

import { OHLCPoint } from '../types/trading.js';

export interface StrategySignal {
    direction: 'long' | 'short' | 'none';
    stopLoss: number;
    takeProfit: number;
    confidence?: number;  // 0–100
    indicators?: string[];
}

export interface IStrategy {
    readonly name: string;
    readonly description: string;
    readonly recommendedTimeframes: string[];
    generate(candles: OHLCPoint[]): StrategySignal;
}
