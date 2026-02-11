import { generateAdvancedSignal, AdvancedSignalInput } from '@/services/advancedSignalGenerator';
import { TechnicalIndicator } from '@/types/trading';

// Mock data generator
const generateMockInput = (symbol: string, i: number): AdvancedSignalInput => ({
    symbol,
    currentPrice: 1000 + Math.random() * 100,
    indicators: [
        { name: 'RSI', value: 30 + Math.random() * 40, signal: 'neutral' } as TechnicalIndicator,
        { name: 'MACD', value: Math.random() - 0.5, signal: Math.random() > 0.5 ? 'bullish' : 'bearish' } as TechnicalIndicator,
        { name: 'EMA 20', value: 1000 + Math.random() * 50, signal: 'neutral' } as TechnicalIndicator,
        { name: 'EMA 50', value: 1000 + Math.random() * 50, signal: 'neutral' } as TechnicalIndicator,
        { name: 'EMA 200', value: 1000 + Math.random() * 50, signal: 'neutral' } as TechnicalIndicator,
    ],
    high24h: 1100,
    low24h: 900,
    volume24h: 1000000 + Math.random() * 500000,
    change24h: (Math.random() - 0.5) * 5
});

describe('System Stress Test', () => {
    it('should handle 50 concurrent signal generations without crashing', async () => {
        const signalsToGenerate = 50;
        const promises = [];

        console.time('StressTest');

        for (let i = 0; i < signalsToGenerate; i++) {
            const input = generateMockInput(`COIN${i}`, i);
            promises.push(
                new Promise(resolve => {
                    const signal = generateAdvancedSignal(input);
                    resolve(signal);
                })
            );
        }

        const results = await Promise.all(promises);
        console.timeEnd('StressTest');

        expect(results.length).toBe(signalsToGenerate);
        results.forEach(signal => {
            if (signal) {
                expect(signal).toHaveProperty('type');
                expect(signal).toHaveProperty('quality');
            }
        });
    });

    it('should maintain performance under load', async () => {
        const start = performance.now();
        const input = generateMockInput('PERF_TEST', 1);

        // Run 100 sequential generations
        for (let i = 0; i < 100; i++) {
            generateAdvancedSignal(input);
        }

        const end = performance.now();
        const avgTime = (end - start) / 100;

        console.log(`Average Signal Generation Time: ${avgTime.toFixed(4)}ms`);
        expect(avgTime).toBeLessThan(10); // Expect < 10ms per signal logic
    });
});
