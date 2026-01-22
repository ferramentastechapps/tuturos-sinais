import { useQuery } from '@tanstack/react-query';
import { useCryptoPrices } from './useCryptoPrices';
import { generateAdvancedSignal } from '@/services/advancedSignalGenerator';
import { TradeSignal } from '@/types/trading';
import { fetchOHLCData } from '@/services/coingeckoOHLC';

interface UseRealTimeSignalsOptions {
  symbol?: string; // Optional: generate signals for specific symbol
  limit?: number; // Optional: limit number of pairs to analyze
}

export const useRealTimeSignals = (options: UseRealTimeSignalsOptions = {}) => {
  const { symbol, limit = 5 } = options;
  const { data: prices } = useCryptoPrices();

  return useQuery<TradeSignal[], Error>({
    queryKey: ['real-time-signals', symbol, prices],
    queryFn: async () => {
      if (!prices || prices.length === 0) {
        return [];
      }

      const signals: TradeSignal[] = [];

      // If specific symbol requested, analyze only that one
      const pairsToAnalyze = symbol 
        ? prices.filter(p => p.symbol === symbol)
        : prices.filter(p => p.isFavorite).slice(0, limit);

      for (const pair of pairsToAnalyze) {
        try {
          // Fetch OHLC data for pattern detection
          let ohlcData;
          try {
            ohlcData = await fetchOHLCData(pair.symbol, '7d'); // 7 days for patterns
          } catch (error) {
            console.warn(`Could not fetch OHLC data for ${pair.symbol}:`, error);
          }

          // Fetch historical data for indicators
          const { fetchHistoricalPrices } = await import('@/services/coingeckoChart');
          const { 
            calculateRSI, 
            calculateMACD, 
            calculateEMA,
            calculateVWAP,
            getIndicatorSignal 
          } = await import('@/utils/technicalIndicators');

          const historicalData = await fetchHistoricalPrices(pair.symbol, '30d');
          const priceData = historicalData.prices;

          if (priceData.length < 50) continue;

          // Calculate indicators
          const rsi = calculateRSI(priceData, 14);
          const macd = calculateMACD(priceData);
          const ema20 = calculateEMA(priceData, 20);
          const ema50 = calculateEMA(priceData, 50);
          const ema200 = calculateEMA(priceData, 200);
          const vwap = calculateVWAP(priceData);

          const indicators = [
            {
              name: 'RSI (14)',
              value: rsi[rsi.length - 1]?.value || 50,
              signal: getIndicatorSignal('rsi', rsi[rsi.length - 1]?.value || 50),
            },
            {
              name: 'MACD',
              value: macd[macd.length - 1]?.histogram || 0,
              signal: getIndicatorSignal('macd', macd[macd.length - 1]?.histogram || 0, macd[macd.length - 2]?.histogram),
            },
            {
              name: 'EMA 20',
              value: ema20[ema20.length - 1]?.value || pair.price,
              signal: pair.price > (ema20[ema20.length - 1]?.value || pair.price) ? 'bullish' : 'bearish',
            },
            {
              name: 'EMA 50',
              value: ema50[ema50.length - 1]?.value || pair.price,
              signal: pair.price > (ema50[ema50.length - 1]?.value || pair.price) ? 'bullish' : 'bearish',
            },
            {
              name: 'EMA 200',
              value: ema200[ema200.length - 1]?.value || pair.price,
              signal: pair.price > (ema200[ema200.length - 1]?.value || pair.price) ? 'bullish' : 'bearish',
            },
            {
              name: 'VWAP',
              value: vwap[vwap.length - 1]?.value || pair.price,
              signal: pair.price > (vwap[vwap.length - 1]?.value || pair.price) ? 'bullish' : 'bearish',
            },
          ] as any;

          // Generate advanced signal
          const generatedSignal = generateAdvancedSignal({
            symbol: pair.symbol,
            currentPrice: pair.price,
            indicators,
            high24h: pair.high24h,
            low24h: pair.low24h,
            ohlcData,
            volume24h: pair.volume24h,
          });

          if (generatedSignal) {
            // Only include signals with quality score >= 50
            if (generatedSignal.quality.score >= 50) {
              signals.push({
                id: `${pair.symbol}-${Date.now()}`,
                pair: pair.symbol,
                type: generatedSignal.type,
                entry: generatedSignal.entry,
                takeProfit: generatedSignal.takeProfit,
                stopLoss: generatedSignal.stopLoss,
                riskReward: generatedSignal.riskReward,
                timeframe: generatedSignal.timeframe,
                status: 'active',
                confidence: generatedSignal.confidence,
                createdAt: new Date(),
                indicators: [
                  ...generatedSignal.indicators,
                  `Qualidade: ${generatedSignal.quality.score}/100`,
                  ...generatedSignal.quality.factors.slice(0, 2), // Top 2 factors
                ],
              });
            }
          }
        } catch (error) {
          console.error(`Error generating signal for ${pair.symbol}:`, error);
        }
      }

      // Sort by quality (confidence) descending
      return signals.sort((a, b) => b.confidence - a.confidence);
    },
    refetchInterval: 600000, // Refresh every 10 minutes
    staleTime: 300000, // Consider stale after 5 minutes
    retry: 1,
    enabled: !!prices && prices.length > 0,
  });
};
