import { bybitConnector } from '../src/exchange/bybitConnector.js';
import { generateSignalFromData } from '../src/engine/signalEngine.js';
import { generateScalpingSignal } from '../src/engine/scalpingEngine.js';
import { logger } from '../src/lib/logger.js';

logger.level = 'debug';

async function test() {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'WIFUSDT', 'PEPEUSDT'];
    for (const symbol of symbols) {
        console.log(`\n=================== Testando ${symbol} ===================`);
        try {
            const [ohlc5m, ohlc15m, ohlc1h, ohlc4h] = await Promise.all([
                bybitConnector.fetchKlines(symbol, '5', 100),
                bybitConnector.fetchKlines(symbol, '15', 50),
                bybitConnector.fetchKlines(symbol, '60', 100),
                bybitConnector.fetchKlines(symbol, '240', 100),
            ]);

            const currentPrice = ohlc5m[ohlc5m.length - 1].close;
            const high24h = Math.max(...ohlc1h.slice(-24).map(c => c.high));
            const low24h = Math.min(...ohlc1h.slice(-24).map(c => c.low));
            const fundingRate = 0.01;
            const volume24h = 1000000;

            console.log(`[+] Preço: ${currentPrice} | High: ${high24h} | Low: ${low24h}`);

            console.log(`\n---> Testando Scalping Engine (5m)`);
            const scalp = generateScalpingSignal(symbol, ohlc5m, ohlc15m, currentPrice, high24h, low24h, fundingRate, undefined, undefined, ohlc1h);
            if (scalp) {
                console.log(`🟢 Scalp Signal: ${scalp.type} | Score: ${scalp.confidence} | Status: ${scalp.status}`);
            } else {
                console.log(`🔴 Nenhum scalp signal gerado`);
            }

            console.log(`\n---> Testando Signal Engine (1h)`);
            const signal = generateSignalFromData(symbol, ohlc1h, currentPrice, high24h, low24h, volume24h, fundingRate, ohlc15m, ohlc4h, undefined, undefined, 1.0, 0, null, null, ohlc1h);
            if (signal) {
                console.log(`🟢 1h Signal: ${signal.type} | Score: ${signal.confidence} | Status: ${signal.status}`);
            } else {
                console.log(`🔴 Nenhum 1h signal gerado`);
            }
        } catch (e) {
            console.error(`Erro no ${symbol}:`, e);
        }
    }
    
    process.exit(0);
}

test().catch(console.error);
