
import { runBacktest } from '../src/services/backtestService';
import { TradeResult } from '../src/utils/backtestEngine';

async function main() {
    try {
        console.log('--- Verifying Backtest Engine ---');
        const summary = await runBacktest({
            symbol: 'BTCUSDT',
            timeRange: '30d',
            initialCapital: 10000,
            riskPerTrade: 0.02,
            minScore: 30, // Lower threshold for testing
            minConfidence: 40
        });

        console.log('\n--- Backtest Results ---');
        console.log(`Total Trades: ${summary.totalTrades}`);
        console.log(`Win Rate: ${summary.winRate.toFixed(2)}%`);
        console.log(`Profit Factor: ${summary.profitFactor.toFixed(2)}`);
        console.log(`Total PnL: $${summary.totalPnL.toFixed(2)}`);
        console.log(`Max Drawdown: ${summary.maxDrawdownPercent.toFixed(2)}%`);
        console.log(`Final Capital: $${summary.finalCapital.toFixed(2)}`);

        if (summary.totalTrades > 0) {
            console.log('\nLast 3 Trades:');
            summary.trades.slice(-3).forEach((t: TradeResult) => {
                console.log(`[${t.type.toUpperCase()}] Entry: ${t.entryPrice.toFixed(2)} | Exit: ${t.exitPrice.toFixed(2)} | PnL: ${t.pnl.toFixed(2)} (${t.pnlPercent.toFixed(2)}%)`);
            });
        }

    } catch (error) {
        console.error('Error running backtest:', error);
    }
}

main();
