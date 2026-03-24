import { AdvancedSignal, AdvancedSignalInput } from '../advancedSignalGenerator';
import { MLFeatureVector } from '@/types/mlTypes';
import { MarketContext } from './marketContextService';

/**
 * Cria um ID numérico simples a partir do nome do símbolo (ex: BTCUSDT -> 1832039)
 * Mantém paridade com o algoritmo de hash do backend.
 */
export function getSymbolId(symbol: string): number {
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
        hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; // Convert to 32bit int
    }
    return Math.abs(hash); // Garantir sempre positivo
}

/**
 * Extrai um vetor de características numéricas de um sinal para treinamento/inferência de ML.
 */
export const extractFeatures = (
    signal: AdvancedSignal,
    input: AdvancedSignalInput,
    marketContext?: MarketContext
): MLFeatureVector => {
    const { symbol, indicators, currentPrice, high24h, low24h, volume24h, ohlcData, futuresData } = input as any;

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
    const fundingRate = futuresData?.fundingRate?.fundingRate || 0;
    const openInterestVar = futuresData?.openInterest?.openInterest || 0;
    const longShortRatio = (futuresData as any)?.longShortRatio ? (futuresData as any).longShortRatio.value : 1;

    // 4. Time Context
    // Extract timestamp from the signal if it exists (usually added at generation),
    // otherwise fallback to current time. In backtesting, this must be the synthetic signal time.
    const signalTime = (signal as any).createdAt ? new Date((signal as any).createdAt) : new Date();
    const hour = signalTime.getUTCHours();
    const day = signalTime.getUTCDay();

    // 5. Signal Properties
    const isLong = signal.type === 'long' ? 1 : 0;
    const stopLossPercent = ((Math.abs(currentPrice - signal.stopLoss)) / currentPrice) * 100;
    const takeProfitPercent = ((Math.abs((signal.takeProfit1 || signal.takeProfit) - currentPrice)) / currentPrice) * 100;

    return {
        // --- Identity ---
        symbol_id: getSymbolId(symbol),

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

        // Real market context if injected, otherwise 0/neutral defaults
        btc_trend: marketContext?.btcTrend ?? 0,
        dominance_btc: marketContext?.dominanceBtc ?? 50,
        fear_greed: marketContext?.fearGreed ?? 50,
    };
};
