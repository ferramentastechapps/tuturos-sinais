// Volatility Tracker — Filtra volatilidade anormalmente alta por símbolo

import { logger } from '../lib/logger.js';

interface VolatilitySnapshot {
    atr_pct: number;
    volatility_24h: number;
    timestamp: number;
}

class VolatilityTracker {
    private history = new Map<string, VolatilitySnapshot[]>();
    private readonly WINDOW_SIZE = 20;

    record(symbol: string, atr_pct: number, volatility_24h: number): void {
        if (!this.history.has(symbol)) {
            this.history.set(symbol, []);
        }

        const snapshots = this.history.get(symbol)!;
        snapshots.push({ atr_pct, volatility_24h, timestamp: Date.now() });

        // Manter apenas os últimos 20
        if (snapshots.length > this.WINDOW_SIZE) {
            snapshots.shift();
        }
    }

    isHighVolatility(
        symbol: string,
        currentATR: number,
        currentVol24h: number,
        multiplier: number
    ): { isHigh: boolean; reason: string } {
        const snapshots = this.history.get(symbol);

        // Benefício da dúvida se histórico insuficiente
        if (!snapshots || snapshots.length < 3) {
            return { isHigh: false, reason: 'Histórico insuficiente' };
        }

        // Calcular médias
        const avgATR = snapshots.reduce((sum, s) => sum + s.atr_pct, 0) / snapshots.length;
        const avgVol24h = snapshots.reduce((sum, s) => sum + s.volatility_24h, 0) / snapshots.length;

        // Vetar se AMBOS estão acima do threshold
        const atrHigh = currentATR > avgATR * multiplier;
        const vol24hHigh = currentVol24h > avgVol24h * multiplier;

        if (atrHigh && vol24hHigh) {
            return {
                isHigh: true,
                reason: `ATR ${currentATR.toFixed(2)}% > ${(avgATR * multiplier).toFixed(2)}% E Vol24h ${currentVol24h.toFixed(2)}% > ${(avgVol24h * multiplier).toFixed(2)}%`,
            };
        }

        return { isHigh: false, reason: 'Volatilidade normal' };
    }
}

export const volatilityTracker = new VolatilityTracker();
