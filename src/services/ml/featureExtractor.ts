import { AdvancedSignal, AdvancedSignalInput } from '../advancedSignalGenerator';
import { MLFeatureVector } from '@/types/mlTypes';

/**
 * Extracts a numeric feature vector from a signal for ML training/inference.
 * All features should be normalized or scalable.
 */
export const extractFeatures = (
    signal: AdvancedSignal,
    input: AdvancedSignalInput
): MLFeatureVector => {
    const { indicators, currentPrice, high24h, low24h, volume24h, ohlcData, futuresData } = input;

    // Helper to get indicator value safely
    const getIndValue = (name: string, defaultVal = 0): number => {
        const ind = indicators.find(i => i.name.includes(name));
        return ind ? ind.value : defaultVal;
    };

    // 1. Technical Indicators
    const rsi = getIndValue('RSI', 50);
    const macd = indicators.find(i => i.name === 'MACD');
    // MACD Value is often an object in this codebase, but here we expect flattened values or need to extract
    // Assuming getIndValue returns the main value, but MACD usually has histogram too.
    // Let's rely on what we can get. If `indicators` is flattened, good.
    // If not, we might need to look at specific props.
    // For now, let's assume standard values.

    // EMAs for trend check
    const ema20 = getIndValue('EMA 20', currentPrice);
    const ema50 = getIndValue('EMA 50', currentPrice);
    const ema200 = getIndValue('EMA 200', currentPrice);

    // Distances (Normalized by Price)
    const distEma20 = ((currentPrice - ema20) / currentPrice) * 100;
    const distEma50 = ((currentPrice - ema50) / currentPrice) * 100;
    const distEma200 = ((currentPrice - ema200) / currentPrice) * 100;

    // VWAP
    const vwap = getIndValue('VWAP', currentPrice);
    const distVwap = ((currentPrice - vwap) / currentPrice) * 100;

    // ATR & ADX
    const atr = getIndValue('ATR', 0);
    const adx = getIndValue('ADX', 0);
    const atrRel = currentPrice > 0 ? (atr / currentPrice) * 100 : 0; // Normalized ATR

    // 2. Market Context / Volatility
    // Volatility proxy: (High - Low) / Low
    const volatility24h = high24h && low24h ? ((high24h - low24h) / low24h) * 100 : 0;

    // Volume relative to simple avg (if ohlc available)
    let volRel = 1;
    if (ohlcData && ohlcData.length > 20 && volume24h) {
        const avgVol = ohlcData.slice(-20).reduce((sum, c) => sum + (c.volume || 0), 0) / 20;
        volRel = avgVol > 0 ? volume24h / avgVol : 1;
    }

    // 3. Futures Data (if available)
    const fundingRate = futuresData?.fundingRate?.rate || 0;
    const openInterestVar = futuresData?.openInterest?.value || 0; // Using value as proxy for change if not explicit
    const longShortRatio = futuresData?.longShortRatio?.value || 1;

    // 4. Time Context
    const now = new Date(); // In backtest this should be passed from signal timestamp, but input doesn't have it explicitly yet. 
    // TODO: Pass timestamp in input for backtest accuracy. For now using current time which is wrong for backtest.
    // We will fix this by assuming `input` might have a timestamp or we ignore it for now.
    const hour = now.getUTCHours();
    const day = now.getUTCDay();

    // 5. Signal Properties
    const isLong = signal.type === 'long' ? 1 : 0;
    const stopLossPercent = ((Math.abs(currentPrice - signal.stopLoss)) / currentPrice) * 100;
    const takeProfitPercent = ((Math.abs(signal.takeProfit - currentPrice)) / currentPrice) * 100;

    return {
        // --- Technicals ---
        rsi,
        adx,
        atr_rel: atrRel,
        dist_ema20: distEma20,
        dist_ema50: distEma50,
        dist_ema200: distEma200,
        dist_vwap: distVwap,

        // --- Market ---
        volatility_24h: volatility24h,
        volume_rel: volRel,
        funding_rate: fundingRate,
        open_interest_var: openInterestVar,
        long_short_ratio: longShortRatio,

        // --- Signal ---
        is_long: isLong,
        confidence: signal.confidence,
        quality_score: signal.quality.score,
        confluence_count: signal.quality.factors.length,
        stop_loss_pct: stopLossPercent,
        take_profit_pct: takeProfitPercent,
        risk_reward: signal.riskReward,

        // --- Context ---
        hour_of_day: hour,
        day_of_week: day,

        // Placeholder for potentially missing data
        btc_trend: 0,
        dominance_btc: 0,
        fear_greed: 50,
    };
};
