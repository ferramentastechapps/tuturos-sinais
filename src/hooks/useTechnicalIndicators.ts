import { useQuery } from '@tanstack/react-query';
import { fetchHistoricalPrices } from '@/services/coingeckoChart';
import { 
  calculateRSI, 
  calculateMACD, 
  calculateEMA, 
  calculateBollingerBands,
  calculateVWAP,
  calculateStochastic,
  calculateIchimoku,
  calculateATR,
  calculateADX,
  calculateWilliamsR,
  calculateOBV,
  getIndicatorSignal 
} from '@/utils/technicalIndicators';
import { TechnicalIndicator } from '@/types/trading';

export const useTechnicalIndicators = (symbol: string) => {
  return useQuery<TechnicalIndicator[], Error>({
    queryKey: ['technical-indicators', symbol],
    queryFn: async () => {
      // Fetch 90 days of historical data for Ichimoku (needs 52 periods)
      const historicalData = await fetchHistoricalPrices(symbol, '90d');
      const prices = historicalData.prices;

      if (prices.length < 52) {
        throw new Error('Insufficient data for technical analysis');
      }

      const indicators: TechnicalIndicator[] = [];
      const currentPrice = prices[prices.length - 1].price;

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

      // Stochastic Oscillator
      const stochastic = calculateStochastic(prices, 14, 3);
      const latestStoch = stochastic[stochastic.length - 1];
      if (latestStoch) {
        indicators.push({
          name: 'Stochastic %K',
          value: parseFloat(latestStoch.k.toFixed(2)),
          signal: getIndicatorSignal('stochastic', latestStoch.k),
          description: 'Oscilador Estocástico',
        });
        indicators.push({
          name: 'Stochastic %D',
          value: parseFloat(latestStoch.d.toFixed(2)),
          signal: getIndicatorSignal('stochastic', latestStoch.d),
          description: 'Linha de Sinal do Estocástico',
        });
      }

      // Bollinger Bands
      const bollinger = calculateBollingerBands(prices, 20, 2);
      const latestBollinger = bollinger[bollinger.length - 1];
      if (latestBollinger) {
        const distanceToUpper = latestBollinger.upper - currentPrice;
        const distanceToLower = currentPrice - latestBollinger.lower;
        let bbSignal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        
        if (currentPrice > latestBollinger.upper) bbSignal = 'bearish';
        else if (currentPrice < latestBollinger.lower) bbSignal = 'bullish';
        else if (distanceToLower < distanceToUpper) bbSignal = 'bullish';
        else if (distanceToUpper < distanceToLower) bbSignal = 'bearish';

        indicators.push({
          name: 'BB Superior',
          value: parseFloat(latestBollinger.upper.toFixed(2)),
          signal: bbSignal,
          description: 'Banda Superior de Bollinger',
        });
        indicators.push({
          name: 'BB Inferior',
          value: parseFloat(latestBollinger.lower.toFixed(2)),
          signal: bbSignal,
          description: 'Banda Inferior de Bollinger',
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

      // Ichimoku Cloud
      const ichimoku = calculateIchimoku(prices);
      const latestIchimoku = ichimoku[ichimoku.length - 1];
      if (latestIchimoku) {
        // Tenkan-Sen vs Kijun-Sen cross
        const tenkanKijunSignal = latestIchimoku.tenkanSen > latestIchimoku.kijunSen ? 'bullish' : 'bearish';
        
        indicators.push({
          name: 'Tenkan-Sen',
          value: parseFloat(latestIchimoku.tenkanSen.toFixed(2)),
          signal: tenkanKijunSignal,
          description: 'Linha de Conversão (9)',
        });
        indicators.push({
          name: 'Kijun-Sen',
          value: parseFloat(latestIchimoku.kijunSen.toFixed(2)),
          signal: tenkanKijunSignal,
          description: 'Linha Base (26)',
        });

        // Cloud analysis
        const cloudTop = Math.max(latestIchimoku.senkouSpanA, latestIchimoku.senkouSpanB);
        const cloudBottom = Math.min(latestIchimoku.senkouSpanA, latestIchimoku.senkouSpanB);
        let cloudSignal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        
        if (currentPrice > cloudTop) cloudSignal = 'bullish';
        else if (currentPrice < cloudBottom) cloudSignal = 'bearish';

        indicators.push({
          name: 'Nuvem Ichimoku',
          value: parseFloat(((cloudTop + cloudBottom) / 2).toFixed(2)),
          signal: cloudSignal,
          description: currentPrice > cloudTop ? 'Preço acima da nuvem' : currentPrice < cloudBottom ? 'Preço abaixo da nuvem' : 'Preço dentro da nuvem',
        });
      }

      // ATR (14)
      const atr = calculateATR(prices, 14);
      const latestATR = atr[atr.length - 1];
      if (latestATR) {
        // ATR as percentage of price for easier interpretation
        const atrPercent = (latestATR.atr / currentPrice) * 100;
        let atrSignal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        
        // High volatility > 3%, low volatility < 1%
        if (atrPercent > 3) atrSignal = 'bearish'; // High volatility = caution
        else if (atrPercent < 1) atrSignal = 'bullish'; // Low volatility = accumulation
        
        indicators.push({
          name: 'ATR (14)',
          value: parseFloat(latestATR.atr.toFixed(2)),
          signal: atrSignal,
          description: `Volatilidade: ${atrPercent.toFixed(2)}%`,
        });
      }

      // ADX (14)
      const adx = calculateADX(prices, 14);
      const latestADX = adx[adx.length - 1];
      if (latestADX) {
        // Determine trend direction based on +DI and -DI
        let adxSignal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        
        if (latestADX.adx > 25) {
          // Strong trend
          adxSignal = latestADX.plusDI > latestADX.minusDI ? 'bullish' : 'bearish';
        }
        
        indicators.push({
          name: 'ADX (14)',
          value: parseFloat(latestADX.adx.toFixed(2)),
          signal: adxSignal,
          description: latestADX.adx > 25 ? 'Tendência Forte' : latestADX.adx > 20 ? 'Tendência Moderada' : 'Tendência Fraca',
        });
        
        indicators.push({
          name: '+DI / -DI',
          value: parseFloat(latestADX.plusDI.toFixed(2)),
          signal: latestADX.plusDI > latestADX.minusDI ? 'bullish' : 'bearish',
          description: `+DI: ${latestADX.plusDI.toFixed(1)} | -DI: ${latestADX.minusDI.toFixed(1)}`,
        });
      }

      // Williams %R (14)
      const williamsR = calculateWilliamsR(prices, 14);
      const latestWR = williamsR[williamsR.length - 1];
      if (latestWR) {
        let wrSignal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        if (latestWR.value > -20) wrSignal = 'bearish'; // Overbought
        else if (latestWR.value < -80) wrSignal = 'bullish'; // Oversold

        indicators.push({
          name: 'Williams %R (14)',
          value: parseFloat(latestWR.value.toFixed(2)),
          signal: wrSignal,
          description: latestWR.value > -20 ? 'Sobrecomprado' : latestWR.value < -80 ? 'Sobrevendido' : 'Zona Neutra',
        });
      }

      // OBV (On-Balance Volume)
      const obv = calculateOBV(prices);
      if (obv.length >= 10) {
        const latestOBV = obv[obv.length - 1].obv;
        const prevOBV = obv[obv.length - 10].obv;
        let obvSignal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        if (latestOBV > prevOBV) obvSignal = 'bullish';
        else if (latestOBV < prevOBV) obvSignal = 'bearish';

        indicators.push({
          name: 'OBV',
          value: parseFloat(latestOBV.toFixed(0)),
          signal: obvSignal,
          description: latestOBV > prevOBV ? 'Volume confirmando alta' : latestOBV < prevOBV ? 'Volume confirmando queda' : 'Volume neutro',
        });
      }

      return indicators;
    },
    refetchInterval: 300000,
    staleTime: 180000,
    retry: 2,
    enabled: !!symbol,
  });
};
