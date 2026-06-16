import { describe, it, expect } from 'vitest';
import {
    detectInsideBar,
    detectDoublePattern,
    detectBrokenZonePullback,
    detectTrendlineTouch,
    StructureLevel
} from '../structureEngine.js';
import type { OHLCPoint } from '../../types/trading.js';

describe('Price Action Detection Tests', () => {

    it('should detect an Inside Bar pattern', () => {
        const ohlc: OHLCPoint[] = [
            { timestamp: 1, open: 95, high: 100, low: 90, close: 95, volume: 1000 },
            { timestamp: 2, open: 93, high: 95, low: 92, close: 94, volume: 1100 } // Inside mother bar (100-90)
        ];
        const result = detectInsideBar(ohlc);
        expect(result.isInside).toBe(true);
        expect(result.motherHigh).toBe(100);
        expect(result.motherLow).toBe(90);
    });

    it('should NOT detect Inside Bar if it breaks mother bounds', () => {
        const ohlc: OHLCPoint[] = [
            { timestamp: 1, open: 95, high: 100, low: 90, close: 95, volume: 1000 },
            { timestamp: 2, open: 93, high: 101, low: 92, close: 94, volume: 1100 } // High breaks 100
        ];
        const result = detectInsideBar(ohlc);
        expect(result.isInside).toBe(false);
    });

    it('should detect Double Bottom pattern', () => {
        // Mock a swing point structure: low at index 2 (price 50), low at index 12 (price 50.1)
        const ohlc: OHLCPoint[] = Array.from({ length: 20 }, (_, i) => ({
            timestamp: i * 60000,
            open: 60,
            high: 65,
            low: (i === 2) ? 50 : (i === 12) ? 50.1 : 55,
            close: 58,
            volume: 100
        }));
        // Current price at index 19 (closing at 52, above low 50.1)
        ohlc[19].close = 51.5;

        const result = detectDoublePattern(ohlc, 1.0);
        expect(result.doubleBottom).toBe(true);
        expect(result.doubleTop).toBe(false);
    });

    it('should detect Double Top pattern', () => {
        // Mock swing highs: high at index 3 (price 100), high at index 13 (price 99.9)
        const ohlc: OHLCPoint[] = Array.from({ length: 20 }, (_, i) => ({
            timestamp: i * 60000,
            open: 80,
            high: (i === 3) ? 100 : (i === 13) ? 99.9 : 85,
            low: 75,
            close: 78,
            volume: 100
        }));
        ohlc[19].close = 98.0; // Current price slightly below topo

        const result = detectDoublePattern(ohlc, 1.0);
        expect(result.doubleTop).toBe(true);
        expect(result.doubleBottom).toBe(false);
    });

    it('should detect Pullback to broken Resistance', () => {
        // Resistance level at 100
        const levels: StructureLevel[] = [
            { price: 100, touches: 2, kind: 'resistance', firstTouch: 0, lastTouch: 0 }
        ];
        
        // Setup candles:
        const ohlc: OHLCPoint[] = Array.from({ length: 15 }, (_, i) => ({
            timestamp: i * 60000,
            open: 95,
            high: 98,
            low: 92,
            close: 95,
            volume: 100
        }));

        // Breakout at index 5: closes at 105
        ohlc[5] = { timestamp: 5 * 60000, open: 98, high: 106, low: 97, close: 105, volume: 150 };
        // Pullback test at index 8: low touches 99.8, closes at 102
        ohlc[8] = { timestamp: 8 * 60000, open: 104, high: 104, low: 99.8, close: 102, volume: 120 };

        const result = detectBrokenZonePullback(ohlc, levels, 2.0, 12);
        expect(result.isConfirmedPullback).toBe(true);
        expect(result.direction).toBe('long'); // broken resistance = buy pullback
    });

    it('should detect Trendline Touch (LTA)', () => {
        // Pivot points for LTA: index 4 (low 50), index 14 (low 60)
        // Expected trendline equation: slope m = 1.0
        // Price at index 34 expected = 50 + 1 * (34 - 4) = 80
        const ohlc: OHLCPoint[] = Array.from({ length: 35 }, (_, i) => ({
            timestamp: i * 60000,
            open: 90,
            high: 95,
            low: (i === 4) ? 50 : (i === 14) ? 60 : 85,
            close: 88,
            volume: 100
        }));

        // Current candle at index 34: expected = 80
        // We set current low = 79.9, close = 83
        ohlc[34] = { timestamp: 34 * 60000, open: 82, high: 86, low: 79.9, close: 83, volume: 100 };

        const result = detectTrendlineTouch(ohlc, 1.0);
        expect(result.touched).toBe('lta');
    });

});
