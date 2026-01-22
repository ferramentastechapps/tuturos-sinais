import { useQuery } from '@tanstack/react-query';
import { fetchHistoricalPrices } from '@/services/coingeckoChart';
import { 
  calculateRSI, 
  calculateMACD, 
  calculateEMA, 
  calculateBollingerBands,
  calculateVWAP,
  getIndicatorSignal 
} from '@/utils/technicalIndicators';
import { TechnicalIndicator } from '@/types/trading';

export const useTechnicalIndicators = (symbol: string) => {
  return useQuery<TechnicalIndicator[], Error>({
    queryKey: ['technical-indicators', symbol],
    queryFn: async () => {
      // Fetch 30 days of historical data for calculations
      const historicalData = await fetchHistoricalPrices(symbol, '30d');
      const prices = historicalData.prices;

      if (prices.length < 50) {
        throw new Error('Insufficient data for technical analysis');
      }

      const indicators: TechnicalIndicator[] = [];

      // RSI (14)
      const rsi = calculateRSI(prices, 14);
      const latestRSI = rsi[rsi.length - 1];
      if (latestRSI) {
        indicators.push({
          name: 'RSI (14)',
          value: parseFloat(latestRSI.value.toFixed(2)),
          signal: getIndicatorSignal('rsi', latestRSI.value),
          description: 'Relative Strength Index',
        });
      }

      // MACD
      const macd = calculateMACD(prices);
      const latestMACD = macd[macd.length - 1];
      const previousMACD = macd[macd.length - 2];
      if (latestMACD) {
        indicators.push({
          name: 'MACD',
          value: parseFloat(latestMACD.histogram.toFixed(2)),
          signal: getIndicatorSignal('macd', latestMACD.histogram, previousMACD?.histogram),
          description: 'Moving Average Convergence Divergence',
        });
      }

      // EMA 20
      const ema20 = calculateEMA(prices, 20);
      const latestEMA20 = ema20[ema20.length - 1];
      const currentPrice = prices[prices.length - 1].price;
      if (latestEMA20) {
        indicators.push({
          name: 'EMA 20',
          value: parseFloat(latestEMA20.value.toFixed(2)),
          signal: currentPrice > latestEMA20.value ? 'bullish' : 'bearish',
          description: 'Exponential Moving Average',
        });
      }

      // EMA 50
      const ema50 = calculateEMA(prices, 50);
      const latestEMA50 = ema50[ema50.length - 1];
      if (latestEMA50) {
        indicators.push({
          name: 'EMA 50',
          value: parseFloat(latestEMA50.value.toFixed(2)),
          signal: currentPrice > latestEMA50.value ? 'bullish' : 'bearish',
          description: 'Exponential Moving Average',
        });
      }

      // EMA 200
      const ema200 = calculateEMA(prices, 200);
      const latestEMA200 = ema200[ema200.length - 1];
      if (latestEMA200) {
        indicators.push({
          name: 'EMA 200',
          value: parseFloat(latestEMA200.value.toFixed(2)),
          signal: currentPrice > latestEMA200.value ? 'bullish' : 'bearish',
          description: 'Exponential Moving Average',
        });
      }

      // VWAP
      const vwap = calculateVWAP(prices);
      const latestVWAP = vwap[vwap.length - 1];
      if (latestVWAP) {
        indicators.push({
          name: 'VWAP',
          value: parseFloat(latestVWAP.value.toFixed(2)),
          signal: currentPrice > latestVWAP.value ? 'bullish' : 'bearish',
          description: 'Volume Weighted Average Price',
        });
      }

      // Bollinger Bands
      const bollinger = calculateBollingerBands(prices, 20, 2);
      const latestBollinger = bollinger[bollinger.length - 1];
      if (latestBollinger) {
        const distanceToUpper = latestBollinger.upper - currentPrice;
        const distanceToLower = currentPrice - latestBollinger.lower;
        let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        
        if (currentPrice > latestBollinger.upper) signal = 'bearish'; // Overbought
        else if (currentPrice < latestBollinger.lower) signal = 'bullish'; // Oversold
        else if (distanceToLower < distanceToUpper) signal = 'bullish';
        else if (distanceToUpper < distanceToLower) signal = 'bearish';

        indicators.push({
          name: 'Bollinger Upper',
          value: parseFloat(latestBollinger.upper.toFixed(2)),
          signal,
          description: 'Bollinger Bands',
        });
      }

      return indicators;
    },
    refetchInterval: 300000, // Refresh every 5 minutes
    staleTime: 180000, // Consider stale after 3 minutes
    retry: 2,
    enabled: !!symbol,
  });
};
