// ═══════════════════════════════════════════════════════════
// Diagnóstico de Direção do Backtest
// Verifica por que todos os sinais são SHORT
// ═══════════════════════════════════════════════════════════

import type { OHLCPoint } from '../src/types/trading.js';

// Fetch OHLC data from Bybit
async function fetchOHLC(symbol: string, interval: string, startMs: number, endMs: number): Promise<OHLCPoint[]> {
    const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&start=${startMs}&end=${endMs}&limit=1000`;
    const response = await fetch(url);
    const json = await response.json() as any;
    
    if (json.retCode !== 0) {
        console.error(`Bybit API error for ${symbol}:`, json.retMsg);
        return [];
    }
    
    return (json.result?.list ?? []).reverse().map((k: any) => ({
        timestamp: parseInt(k[0]),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
    }));
}

function calculateEMA(data: number[], period: number): number[] {
    if (data.length === 0) return [];
    const k = 2 / (period + 1);
    const result: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) {
        result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    return result;
}

async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('DIAGNÓSTICO DE DIREÇÃO - BACKTEST');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const startMs = new Date('2026-01-31').getTime();
    const endMs = new Date('2026-05-01').getTime();
    const symbol = 'BTCUSDT';
    
    console.log(`Período: 31/01/2026 - 01/05/2026`);
    console.log(`Símbolo: ${symbol}\n`);
    
    // Fetch 1H data
    console.log('📊 Buscando dados 1H...');
    const ohlc1h = await fetchOHLC(symbol, '60', startMs, endMs);
    console.log(`  ✓ ${ohlc1h.length} candles 1H\n`);
    
    // Fetch 4H data
    console.log('📊 Buscando dados 4H...');
    const ohlc4h = await fetchOHLC(symbol, '240', startMs, endMs);
    console.log(`  ✓ ${ohlc4h.length} candles 4H\n`);
    
    if (ohlc1h.length < 200 || ohlc4h.length < 200) {
        console.error('❌ Dados insuficientes');
        return;
    }
    
    // Analyze trend at different points
    console.log('═══════════════════════════════════════════════════════');
    console.log('ANÁLISE DE TENDÊNCIA');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const checkPoints = [
        { date: '2026-02-01', index: 24 },   // 1 dia depois
        { date: '2026-02-15', index: 360 },  // 15 dias depois
        { date: '2026-03-01', index: 720 },  // 1 mês depois
        { date: '2026-04-01', index: 1440 }, // 2 meses depois
        { date: '2026-04-30', index: 2160 }, // Final
    ];
    
    for (const cp of checkPoints) {
        if (cp.index >= ohlc1h.length) continue;
        
        const slice1h = ohlc1h.slice(0, cp.index + 1);
        const closes1h = slice1h.map(c => c.close);
        const ema20_1h = calculateEMA(closes1h, 20).pop() || 0;
        const ema50_1h = calculateEMA(closes1h, 50).pop() || 0;
        const ema200_1h = calculateEMA(closes1h, 200).pop() || 0;
        const currentPrice1h = closes1h[closes1h.length - 1];
        
        // Find corresponding 4H candle
        const timestamp1h = slice1h[slice1h.length - 1].timestamp;
        const idx4h = ohlc4h.findIndex(c => c.timestamp >= timestamp1h);
        
        if (idx4h === -1 || idx4h < 200) continue;
        
        const slice4h = ohlc4h.slice(0, idx4h + 1);
        const closes4h = slice4h.map(c => c.close);
        const ema20_4h = calculateEMA(closes4h, 20).pop() || 0;
        const ema50_4h = calculateEMA(closes4h, 50).pop() || 0;
        const ema200_4h = calculateEMA(closes4h, 200).pop() || 0;
        const currentPrice4h = closes4h[closes4h.length - 1];
        
        // Determine trends
        const type1h = ema20_1h > ema50_1h ? 'LONG' : 'SHORT';
        const trend4hMacro = currentPrice4h > ema200_4h ? 'LONG' : 'SHORT';
        const trend4h = (currentPrice4h > ema20_4h && currentPrice4h > ema50_4h) ? 'LONG'
                      : (currentPrice4h < ema20_4h && currentPrice4h < ema50_4h) ? 'SHORT'
                      : 'NEUTRAL';
        
        // Check if signal would be blocked
        let blocked = false;
        let reason = '';
        
        if (type1h === 'LONG' && trend4hMacro !== 'LONG') {
            blocked = true;
            reason = 'LONG bloqueado - preço < EMA200 4H';
        }
        if (type1h === 'SHORT' && trend4hMacro !== 'SHORT') {
            blocked = true;
            reason = 'SHORT bloqueado - preço > EMA200 4H';
        }
        
        console.log(`📅 ${cp.date}`);
        console.log(`─────────────────────────────────────────────────────`);
        console.log(`Preço: $${currentPrice1h.toFixed(2)}`);
        console.log(``);
        console.log(`1H:`);
        console.log(`  EMA20:  $${ema20_1h.toFixed(2)}`);
        console.log(`  EMA50:  $${ema50_1h.toFixed(2)}`);
        console.log(`  EMA200: $${ema200_1h.toFixed(2)}`);
        console.log(`  → Direção: ${type1h} (EMA20 ${ema20_1h > ema50_1h ? '>' : '<'} EMA50)`);
        console.log(``);
        console.log(`4H:`);
        console.log(`  EMA20:  $${ema20_4h.toFixed(2)}`);
        console.log(`  EMA50:  $${ema50_4h.toFixed(2)}`);
        console.log(`  EMA200: $${ema200_4h.toFixed(2)}`);
        console.log(`  → Tendência: ${trend4h}`);
        console.log(`  → Macro (EMA200): ${trend4hMacro} (preço ${currentPrice4h > ema200_4h ? '>' : '<'} EMA200)`);
        console.log(``);
        console.log(`Resultado:`);
        if (blocked) {
            console.log(`  ❌ ${reason}`);
        } else {
            console.log(`  ✅ Sinal ${type1h} permitido`);
        }
        console.log(``);
    }
    
    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('RESUMO');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Count how many candles would generate LONG vs SHORT
    let longCount = 0;
    let shortCount = 0;
    let longBlockedCount = 0;
    let shortBlockedCount = 0;
    
    for (let i = 200; i < ohlc1h.length; i += 24) { // Sample every 24h
        const slice1h = ohlc1h.slice(0, i + 1);
        const closes1h = slice1h.map(c => c.close);
        const ema20_1h = calculateEMA(closes1h, 20).pop() || 0;
        const ema50_1h = calculateEMA(closes1h, 50).pop() || 0;
        
        const timestamp1h = slice1h[slice1h.length - 1].timestamp;
        const idx4h = ohlc4h.findIndex(c => c.timestamp >= timestamp1h);
        
        if (idx4h === -1 || idx4h < 200) continue;
        
        const slice4h = ohlc4h.slice(0, idx4h + 1);
        const closes4h = slice4h.map(c => c.close);
        const ema200_4h = calculateEMA(closes4h, 200).pop() || 0;
        const currentPrice4h = closes4h[closes4h.length - 1];
        
        const type1h = ema20_1h > ema50_1h ? 'long' : 'short';
        const trend4hMacro = currentPrice4h > ema200_4h ? 'long' : 'short';
        
        if (type1h === 'long') {
            if (trend4hMacro === 'long') {
                longCount++;
            } else {
                longBlockedCount++;
            }
        } else {
            if (trend4hMacro === 'short') {
                shortCount++;
            } else {
                shortBlockedCount++;
            }
        }
    }
    
    const total = longCount + shortCount + longBlockedCount + shortBlockedCount;
    
    console.log(`Amostragem: ${total} pontos (1 por dia)\n`);
    console.log(`LONGs permitidos:  ${longCount} (${((longCount/total)*100).toFixed(1)}%)`);
    console.log(`LONGs bloqueados:  ${longBlockedCount} (${((longBlockedCount/total)*100).toFixed(1)}%)`);
    console.log(`SHORTs permitidos: ${shortCount} (${((shortCount/total)*100).toFixed(1)}%)`);
    console.log(`SHORTs bloqueados: ${shortBlockedCount} (${((shortBlockedCount/total)*100).toFixed(1)}%)`);
    console.log(``);
    console.log(`Total permitidos:  ${longCount + shortCount} (${(((longCount + shortCount)/total)*100).toFixed(1)}%)`);
    console.log(`Total bloqueados:  ${longBlockedCount + shortBlockedCount} (${(((longBlockedCount + shortBlockedCount)/total)*100).toFixed(1)}%)`);
    console.log(``);
    
    if (shortCount > longCount * 2) {
        console.log(`⚠️  ATENÇÃO: Período com viés SHORT forte!`);
        console.log(`   Isso explica por que o backtest gerou mais SHORTs.`);
    } else if (longCount > shortCount * 2) {
        console.log(`⚠️  ATENÇÃO: Período com viés LONG forte!`);
        console.log(`   Backtest deveria gerar mais LONGs.`);
    } else {
        console.log(`✓ Período balanceado entre LONGs e SHORTs`);
    }
    
    console.log(``);
    console.log('═══════════════════════════════════════════════════════');
}

main().catch(error => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
});
