import { MarketContextService } from './src/engine/marketContext';

async function test() {
    const service = MarketContextService.getInstance();
    const ctx = await service.getGlobalContext();
    console.log("Global Context:");
    console.log("BTC Trend:", ctx.btc_trend);
    console.log("Fear & Greed:", ctx.fear_greed);
    console.log("UTC Time:", new Date().toISOString());
}

test().catch(console.error);
