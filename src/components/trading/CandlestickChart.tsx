import { useState, useMemo, useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, SeriesMarker, Time, CrosshairMode } from 'lightweight-charts';
import { useOHLCData } from '@/hooks/useOHLCData';
import { BybitInterval, BYBIT_TIMEFRAMES } from '@/services/bybitOHLC';
import { detectPatterns, CandlestickPattern, getPatternEmoji } from '@/utils/candlestickPatterns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CandlestickChart as CandlestickIcon, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CandlestickChartProps {
  symbol: string;
  name: string;
}

export const CandlestickChart = ({ symbol, name }: CandlestickChartProps) => {
  const [interval, setInterval] = useState<BybitInterval>('60');
  const { data: ohlcData, isLoading, error } = useOHLCData(symbol, interval);
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<{
    candleSeries?: ISeriesApi<"Candlestick">;
    volumeSeries?: ISeriesApi<"Histogram">;
    ema9Series?: ISeriesApi<"Line">;
    ema21Series?: ISeriesApi<"Line">;
    sma50Series?: ISeriesApi<"Line">;
    bbUpperSeries?: ISeriesApi<"Line">;
    bbLowerSeries?: ISeriesApi<"Line">;
    bbMiddleSeries?: ISeriesApi<"Line">;
  }>({});

  const patterns = useMemo(() => {
    if (!ohlcData || ohlcData.length < 3) return [];
    return detectPatterns(ohlcData);
  }, [ohlcData]);

  const patternSummary = useMemo(() => {
    const bullish = patterns.filter(p => p.signal === 'bullish').length;
    const bearish = patterns.filter(p => p.signal === 'bearish').length;
    const neutral = patterns.filter(p => p.signal === 'neutral').length;
    return { bullish, bearish, neutral };
  }, [patterns]);

  useEffect(() => {
    if (!chartContainerRef.current || !ohlcData || ohlcData.length === 0) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { width: 1, color: 'rgba(255, 255, 255, 0.2)', style: 3 },
        horzLine: { width: 1, color: 'rgba(255, 255, 255, 0.2)', style: 3 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      autoSize: true,
    });
    chartRef.current = chart;

    // Series Setup
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '', // set as an overlay by setting a blank priceScaleId
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const ema9Series = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, crosshairMarkerVisible: false });
    const ema21Series = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, crosshairMarkerVisible: false });
    const sma50Series = chart.addLineSeries({ color: '#a855f7', lineWidth: 1, crosshairMarkerVisible: false });
    const bbUpperSeries = chart.addLineSeries({ color: 'rgba(5b, 130, 246, 0.5)', lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false });
    const bbMiddleSeries = chart.addLineSeries({ color: 'rgba(5b, 130, 246, 0.3)', lineWidth: 1, crosshairMarkerVisible: false });
    const bbLowerSeries = chart.addLineSeries({ color: 'rgba(5b, 130, 246, 0.5)', lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false });

    seriesRefs.current = { candleSeries, volumeSeries, ema9Series, ema21Series, sma50Series, bbUpperSeries, bbMiddleSeries, bbLowerSeries };

    // Calculate Indicators
    const closes = ohlcData.map(c => c.close);
    
    const calcSMA = (data: number[], period: number, idx: number) => {
      if (idx < period - 1) return undefined;
      let sum = 0;
      for (let i = idx - period + 1; i <= idx; i++) sum += data[i];
      return sum / period;
    };
    
    const calcEMA = (data: number[], period: number) => {
      const result: (number | undefined)[] = new Array(data.length).fill(undefined);
      if (data.length < period) return result;
      let sum = 0;
      for (let i = 0; i < period; i++) sum += data[i];
      result[period - 1] = sum / period;
      const k = 2 / (period + 1);
      for (let i = period; i < data.length; i++) {
        result[i] = data[i] * k + (result[i - 1] as number) * (1 - k);
      }
      return result;
    };

    const ema9 = calcEMA(closes, 9);
    const ema21 = calcEMA(closes, 21);
    
    const bbPeriod = 20;
    const bbStdDev = 2;

    const candleData: any[] = [];
    const volumeData: any[] = [];
    const ema9Data: any[] = [];
    const ema21Data: any[] = [];
    const sma50Data: any[] = [];
    const bbUpperData: any[] = [];
    const bbMiddleData: any[] = [];
    const bbLowerData: any[] = [];
    const markers: SeriesMarker<Time>[] = [];

    ohlcData.forEach((candle, index) => {
      const time = (Math.floor(candle.timestamp / 1000)) as Time;
      
      candleData.push({ time, open: candle.open, high: candle.high, low: candle.low, close: candle.close });
      volumeData.push({ time, value: candle.volume, color: candle.close >= candle.open ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)' });
      
      if (ema9[index] !== undefined) ema9Data.push({ time, value: ema9[index] });
      if (ema21[index] !== undefined) ema21Data.push({ time, value: ema21[index] });
      
      const sma50val = calcSMA(closes, 50, index);
      if (sma50val !== undefined) sma50Data.push({ time, value: sma50val });

      // Calculate BB
      if (index >= bbPeriod - 1) {
        let sum = 0;
        for (let i = index - bbPeriod + 1; i <= index; i++) sum += closes[i];
        const mean = sum / bbPeriod;
        let sqSum = 0;
        for (let i = index - bbPeriod + 1; i <= index; i++) sqSum += (closes[i] - mean) ** 2;
        const std = Math.sqrt(sqSum / bbPeriod);
        bbMiddleData.push({ time, value: mean });
        bbUpperData.push({ time, value: mean + bbStdDev * std });
        bbLowerData.push({ time, value: mean - bbStdDev * std });
      }

      // Add Markers for patterns
      const pattern = patterns.find(p => p.index === index);
      if (pattern) {
        markers.push({
          time,
          position: pattern.signal === 'bullish' ? 'belowBar' : pattern.signal === 'bearish' ? 'aboveBar' : 'inBar',
          color: pattern.signal === 'bullish' ? '#26a69a' : pattern.signal === 'bearish' ? '#ef5350' : '#888',
          shape: pattern.signal === 'bullish' ? 'arrowUp' : pattern.signal === 'bearish' ? 'arrowDown' : 'circle',
          text: getPatternEmoji(pattern.type),
        });
      }
    });

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    ema9Series.setData(ema9Data);
    ema21Series.setData(ema21Data);
    sma50Series.setData(sma50Data);
    bbUpperSeries.setData(bbUpperData);
    bbMiddleSeries.setData(bbMiddleData);
    bbLowerSeries.setData(bbLowerData);
    
    if (markers.length > 0) {
      candleSeries.setMarkers(markers);
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
    };
  }, [ohlcData, patterns]);

  return (
    <div className="trading-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CandlestickIcon className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Gráfico de Velas</h3>
            <p className="text-sm text-muted-foreground">{name}</p>
          </div>
        </div>
        <Tabs value={interval} onValueChange={(v) => setInterval(v as BybitInterval)}>
          <TabsList className="bg-muted/50 flex-wrap h-auto gap-0.5 p-1">
            {BYBIT_TIMEFRAMES.map((tf) => (
              <TabsTrigger key={tf.interval} value={tf.interval} className="text-xs px-2 py-1">
                {tf.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="h-[430px] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="h-[430px] flex items-center justify-center text-muted-foreground">
          Falha ao carregar dados OHLC
        </div>
      ) : ohlcData && ohlcData.length === 0 ? (
        <div className="h-[430px] flex items-center justify-center text-muted-foreground">
          Dados indisponíveis
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-success/10">
              <TrendingUp className="w-4 h-4 text-success" />
              <div>
                <p className="text-lg font-bold text-success">{patternSummary.bullish}</p>
                <p className="text-xs text-success/80">Padrões Altistas</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
              <Minus className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold text-muted-foreground">{patternSummary.neutral}</p>
                <p className="text-xs text-muted-foreground">Neutros</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10">
              <TrendingDown className="w-4 h-4 text-destructive" />
              <div>
                <p className="text-lg font-bold text-destructive">{patternSummary.bearish}</p>
                <p className="text-xs text-destructive/80">Padrões Baixistas</p>
              </div>
            </div>
          </div>

          <div className="h-[400px] mb-4 relative" ref={chartContainerRef} />

          <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }} /><span>EMA 9</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3b82f6' }} /><span>EMA 21</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#a855f7' }} /><span>SMA 50</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgba(5b,130,246,0.5)' }} /><span>Bollinger</span></div>
          </div>

          {patterns.length > 0 && (
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">Padrões Detectados</h4>
                <Badge variant="outline" className="ml-auto">{patterns.length}</Badge>
              </div>
              <ScrollArea className="h-[120px]">
                <div className="space-y-2 pr-4">
                  {patterns.slice().reverse().map((pattern, idx) => (
                    <TooltipProvider key={idx}>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                              pattern.signal === 'bullish' && "bg-success/5 hover:bg-success/10",
                              pattern.signal === 'bearish' && "bg-destructive/5 hover:bg-destructive/10",
                              pattern.signal === 'neutral' && "bg-muted/50 hover:bg-muted"
                            )}
                          >
                            <span className="text-lg">{getPatternEmoji(pattern.type)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{pattern.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(pattern.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <Badge
                              variant={pattern.signal === 'bullish' ? 'default' : pattern.signal === 'bearish' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {pattern.signal === 'bullish' ? 'ALTA' : pattern.signal === 'bearish' ? 'BAIXA' : 'NEUTRO'}
                            </Badge>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[200px]">
                          <p>{pattern.description}</p>
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </>
      )}
    </div>
  );
};
