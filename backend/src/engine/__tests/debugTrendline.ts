import { detectTrendlineTouch, findSwingPoints } from '../structureEngine.js';
import type { OHLCPoint } from '../../types/trading.js';

const ohlc: OHLCPoint[] = Array.from({ length: 25 }, (_, i) => ({
    timestamp: i * 60000,
    open: 80,
    high: 85,
    low: (i === 4) ? 50 : (i === 14) ? 60 : 75,
    close: 78,
    volume: 100
}));

ohlc[24] = { timestamp: 24 * 60000, open: 72, high: 76, low: 69.9, close: 73, volume: 100 };

const swings = findSwingPoints(ohlc, 3);
console.log('Swings detected:', swings);
const result = detectTrendlineTouch(ohlc, 1.0);
console.log('Result:', result);
