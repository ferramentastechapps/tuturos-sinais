import { BacktestResult, BacktestTrade } from '@/types/backtestTypes';
import { MLTrainingSample, MLFeatureVector } from '@/types/mlTypes';
import { saveTrainingData } from './mlContentManager';

/**
 * Collects training samples from a completed backtest result.
 * reconstructs features at entry time and labels outcome.
 */
export const collectFromBacktest = async (result: BacktestResult): Promise<number> => {
    const samples: MLTrainingSample[] = [];
    const trades = result.trades;

    console.log(`[ML Collector] Processing ${trades.length} trades from backtest...`);

    for (const trade of trades) {
        // Skip if no features were captured
        if (!trade.mlFeatures) continue;

        // Determine label: 1 (Win) or 0 (Loss)
        // We can use PnL > 0, or PnL% > threshold
        const label = trade.netPnl > 0 ? 1 : 0;

        const sample: MLTrainingSample = {
            signalId: trade.id,
            symbol: trade.symbol,
            // Cast back to typed vector
            features: trade.mlFeatures as unknown as MLFeatureVector,
            label,
            pnl: trade.pnlPercent,
            timestamp: trade.entryTime,
        };

        samples.push(sample);
    }

    if (samples.length === 0) {
        console.warn('[ML Collector] No valid training samples found in backtest.');
        return 0;
    }

    // Upload in batches
    console.log(`[ML Collector] Uploading ${samples.length} samples to Supabase...`);
    const successCount = await saveTrainingData(samples);
    return successCount;
};
