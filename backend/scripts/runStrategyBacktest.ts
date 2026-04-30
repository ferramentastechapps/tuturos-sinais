// ═══════════════════════════════════════════════════════════
// Script: Backtesting de Estratégias Plugáveis
// Uso: npx ts-node --esm backend/scripts/runStrategyBacktest.ts
// ═══════════════════════════════════════════════════════════

import { getStrategy, listStrategies } from '../src/strategies/registry.js';
import type { OHLCPoint } from '../src/types/trading.js';
import type { StrategySignal } from '../src/strategies/types.js';

// ── Mini engine de simulação para estratégias ──

interface Trade {
    entry: number;
    sl: number;
    tp: number;
    direction: 'long' | 'short';
    exitPrice: number;
    pnlPct: number;
    win: boolean;
}

function runStrategyOnCandles(
    strategyName: string,
    candles: OHLCPoint[],
    initialCapital = 10000,
    riskPct = 1.0,
): void {
    const strategy = getStrategy(strategyName);
    if (!strategy) {
        console.error(`❌ Estratégia '${strategyName}' não encontrada.`);
        console.log('Disponíveis:', listStrategies().map(s => s.name).join(', '));
        return;
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔬 Backtest: ${strategy.name}`);
    console.log(`   ${strategy.description}`);
    console.log(`   Timeframes recomendados: ${strategy.recommendedTimeframes.join(', ')}`);
    console.log(`   Candles: ${candles.length} | Capital: $${initialCapital}`);
    console.log('═'.repeat(60));

    const trades: Trade[] = [];
    let capital = initialCapital;
    let inPosition = false;
    let openTrade: Omit<Trade, 'exitPrice' | 'pnlPct' | 'win'> | null = null;

    for (let i = 50; i < candles.length; i++) {
        const window = candles.slice(0, i + 1);
        const current = candles[i];

        // Verificar se posição aberta foi fechada por SL ou TP
        if (inPosition && openTrade) {
            const { direction, entry, sl, tp } = openTrade;
            let exited = false;
            let exitPrice = 0;

            if (direction === 'long') {
                if (current.low <= sl)   { exitPrice = sl; exited = true; }
                if (current.high >= tp)  { exitPrice = tp; exited = true; }
            } else {
                if (current.high >= sl)  { exitPrice = sl; exited = true; }
                if (current.low <= tp)   { exitPrice = tp; exited = true; }
            }

            if (exited) {
                const pnlPct = direction === 'long'
                    ? (exitPrice - entry) / entry * 100
                    : (entry - exitPrice) / entry * 100;
                const pnl = capital * (riskPct / 100) * (pnlPct / ((Math.abs(entry - sl) / entry) * 100));
                capital += pnl;
                trades.push({ ...openTrade, exitPrice, pnlPct, win: pnlPct > 0 });
                inPosition = false;
                openTrade = null;
            }
        }

        // Gerar sinal se livre
        if (!inPosition) {
            const signal: StrategySignal = strategy.generate(window);
            if (signal.direction !== 'none' && signal.stopLoss > 0 && signal.takeProfit > 0) {
                openTrade = {
                    entry: current.close,
                    sl: signal.stopLoss,
                    tp: signal.takeProfit,
                    direction: signal.direction,
                };
                inPosition = true;
            }
        }
    }

    // Resultados
    const wins      = trades.filter(t => t.win).length;
    const winRate   = trades.length > 0 ? (wins / trades.length) * 100 : 0;
    const totalPnl  = capital - initialCapital;
    const totalPct  = (totalPnl / initialCapital) * 100;
    const avgWin    = trades.filter(t => t.win).map(t => t.pnlPct).reduce((a,b)=>a+b,0) / Math.max(wins, 1);
    const avgLoss   = trades.filter(t => !t.win).map(t => t.pnlPct).reduce((a,b)=>a+b,0) / Math.max(trades.length - wins, 1);

    console.log(`\n📊 RESULTADOS`);
    console.log(`   Trades:      ${trades.length}`);
    console.log(`   Win Rate:    ${winRate.toFixed(1)}%`);
    console.log(`   PnL Total:   ${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(2)}% ($${totalPnl.toFixed(2)})`);
    console.log(`   Avg Win:     +${avgWin.toFixed(2)}%`);
    console.log(`   Avg Loss:    ${avgLoss.toFixed(2)}%`);
    console.log(`   Capital Final: $${capital.toFixed(2)}`);
}

// ── Execução via interface web de backtesting ──
// As estratégias são acessíveis em POST /api/backtest/run via campo config.strategy

console.log('\n📋 ESTRATÉGIAS DISPONÍVEIS:\n');
listStrategies().forEach(s => {
    console.log(`  • ${s.name}`);
    console.log(`    ${s.description}`);
    console.log(`    Timeframes: ${s.timeframes.join(', ')}\n`);
});

console.log(`
${'─'.repeat(60)}
COMO USAR NO BACKTESTING:

1. Via API (POST /api/backtest/run):
   Adicione "strategy": "EMA_CROSS_VOLUME" no campo config

2. Exemplo de payload:
   {
     "config": {
       "strategy": "EMA_CROSS_VOLUME",
       "symbols": ["BTCUSDT"],
       "timeframe": "15m",
       "startDate": "2026-01-01",
       "endDate": "2026-04-30",
       "signal": { "minScore": 60 }
     },
     "ohlcData": { "BTCUSDT": [...candles] }
   }

3. Estratégias disponíveis:
   - EMA_CROSS_VOLUME   → 15m
   - RSI_DIVERGENCE     → 15m, 1h
   - BOLLINGER_SQUEEZE  → 15m, 1h
   - VWAP_REVERSION     → 1m, 5m
${'─'.repeat(60)}
`);
