import { BacktestEngine } from './backend/src/engine/backtest/backtestEngine.js';
import { DEFAULT_BACKTEST_CONFIG } from './src/types/backtestTypes.js';

async function test() {
    console.log("Fetching BTCUSDT 1h klines...");
    const res = await fetch('https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=60&limit=1000');
    const data = await res.json();
    
    const ohlc = data.result.list.map((k: any) => ({
        timestamp: parseInt(k[0]),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
    })).reverse();
    
    console.log(`Fetched ${ohlc.length} candles.`);
    
    const engine = new BacktestEngine(DEFAULT_BACKTEST_CONFIG);
    console.log("Config signal score:", DEFAULT_BACKTEST_CONFIG.signal.minScore);
    const result = await engine.runSymbol('BTCUSDT', ohlc);
    
    console.log(`Generated ${result.trades.length} trades.`);
    if (result.trades.length > 0) {
        console.log("First trade:", result.trades[0]);
    }
}

test().catch(console.error);
