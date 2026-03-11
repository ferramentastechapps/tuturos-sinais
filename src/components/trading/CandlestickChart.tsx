import { useState, useMemo, useCallback } from 'react';
import { useOHLCData } from '@/hooks/useOHLCData';
import { BybitInterval, BYBIT_TIMEFRAMES } from '@/services/bybitOHLC';
import { detectPatterns, CandlestickPattern, getPatternEmoji } from '@/utils/candlestickPatterns';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Customized,
  ReferenceLine,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CandlestickChart as CandlestickIcon, TrendingUp, TrendingDown, Minus, Info, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

const formatDate = (timestamp: number, interval: BybitInterval) => {
  const date = new Date(timestamp);
  // Intraday intervals show time
  if (['1', '3', '5', '15', '30', '60', '120', '240', '360', '720'].includes(interval)) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const formatPrice = (price: number) => {
  if (price >= 1000) {
    return `$${price.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  }
  return `$${price.toFixed(4)}`;
};

// Render all candlesticks via Customized for proper Y-axis mapping
const CandlesticksLayer = (props: any) => {
  const { xAxisMap, yAxisMap, formattedGraphicalItems } = props;
  if (!xAxisMap || !yAxisMap) return null;

  const xAxis = Object.values(xAxisMap)[0] as any;
  const yAxis = Object.values(yAxisMap)[0] as any;
  if (!xAxis?.scale || !yAxis?.scale) return null;

  // Get data from the first graphical item (hidden Bar)
  const items = formattedGraphicalItems?.[0]?.props?.data || [];
  const bandWidth = xAxis.bandSize || (xAxis.width / Math.max(items.length, 1));
  const candleWidth = Math.max(bandWidth * 0.8, 6);

  return (
    <g>
      {items.map((entry: any, index: number) => {
        const d = entry?.payload;
        if (!d || d.open == null) return null;

        const { open, close, high, low } = d;
        const isBullish = close >= open;
        const bullColor = '#22c55e';
        const bearColor = '#ef4444';
        const color = isBullish ? bullColor : bearColor;

        const cx = xAxis.scale(d.timestamp) + bandWidth / 2;
        const yHigh = yAxis.scale(high);
        const yLow = yAxis.scale(low);
        const yOpen = yAxis.scale(open);
        const yClose = yAxis.scale(close);

        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(Math.abs(yOpen - yClose), 2.5);

        return (
          <g key={index}>
            {/* Wick (shadow) */}
            <line
              x1={cx} y1={yHigh} x2={cx} y2={yLow}
              stroke={color} strokeWidth={1.5}
            />
            {/* Body */}
            <rect
              x={cx - candleWidth / 2}
              y={bodyTop}
              width={candleWidth}
              height={bodyHeight}
              fill={isBullish ? bullColor : bearColor}
              stroke={color}
              strokeWidth={0.5}
              rx={0.5}
            />
          </g>
        );
      })}
    </g>
  );
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload[0]) return null;
  
  const data = payload[0].payload;
  const isBullish = data.close >= data.open;
  
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-muted-foreground mb-2">
        {new Date(data.timestamp).toLocaleString('pt-BR')}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Abertura:</span>
          <span className="ml-1 font-mono">{formatPrice(data.open)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Fechamento:</span>
          <span className={cn("ml-1 font-mono", isBullish ? "text-success" : "text-destructive")}>
            {formatPrice(data.close)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Máxima:</span>
          <span className="ml-1 font-mono text-success">{formatPrice(data.high)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Mínima:</span>
          <span className="ml-1 font-mono text-destructive">{formatPrice(data.low)}</span>
        </div>
      </div>
      {data.pattern && (
        <div className="mt-2 pt-2 border-t border-border">
          <Badge variant={data.pattern.signal === 'bullish' ? 'default' : data.pattern.signal === 'bearish' ? 'destructive' : 'secondary'}>
            {getPatternEmoji(data.pattern.type)} {data.pattern.name}
          </Badge>
        </div>
      )}
    </div>
  );
};

export const CandlestickChart = ({ symbol, name }: CandlestickChartProps) => {
  const [interval, setInterval] = useState<BybitInterval>('60');
  const { data: ohlcData, isLoading, error } = useOHLCData(symbol, interval);
  const [selectedPattern, setSelectedPattern] = useState<CandlestickPattern | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = show all data

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.5, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.5, 1));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(1);
  }, []);

  // Detect patterns
  const patterns = useMemo(() => {
    if (!ohlcData || ohlcData.length < 3) return [];
    return detectPatterns(ohlcData);
  }, [ohlcData]);

  // Prepare chart data with patterns, apply zoom (show last N candles)
  const chartData = useMemo(() => {
    if (!ohlcData) return [];
    
    const allData = ohlcData.map((candle, index) => {
      const pattern = patterns.find(p => p.index === index);
      return {
        ...candle,
        range: candle.high - candle.low,
        pattern,
      };
    });

    if (zoomLevel <= 1) return allData;

    // Zoom = show fewer candles (last portion)
    const visibleCount = Math.max(Math.floor(allData.length / zoomLevel), 10);
    return allData.slice(-visibleCount);
  }, [ohlcData, patterns, zoomLevel]);

  // Calculate price domain from visible data
  const priceDomain = useMemo(() => {
    if (!chartData || chartData.length === 0) return [0, 100];
    const highs = chartData.map(d => d.high);
    const lows = chartData.map(d => d.low);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding];
  }, [chartData]);

  // Pattern summary
  const patternSummary = useMemo(() => {
    const bullish = patterns.filter(p => p.signal === 'bullish').length;
    const bearish = patterns.filter(p => p.signal === 'bearish').length;
    const neutral = patterns.filter(p => p.signal === 'neutral').length;
    return { bullish, bearish, neutral };
  }, [patterns]);

  return (
    <div className="trading-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CandlestickIcon className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Gráfico de Velas</h3>
            <p className="text-sm text-muted-foreground">{name}</p>
          </div>
        </div>
        <Tabs value={interval} onValueChange={(v) => { setInterval(v as BybitInterval); setZoomLevel(1); }}>
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
        <div className="h-[350px] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="h-[350px] flex items-center justify-center text-muted-foreground">
          Falha ao carregar dados OHLC
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-[350px] flex items-center justify-center text-muted-foreground">
          Dados indisponíveis
        </div>
      ) : (
        <>
          {/* Pattern Summary */}
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

          {/* Zoom Controls */}
          <div className="flex items-center justify-end gap-1 mb-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 5}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleResetZoom}
              disabled={zoomLevel === 1}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            {zoomLevel > 1 && (
              <span className="text-xs text-muted-foreground ml-1">{zoomLevel.toFixed(1)}x</span>
            )}
          </div>

          {/* Candlestick Chart */}
          <div className="h-[400px] mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(val) => formatDate(val, range)}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis
                  domain={priceDomain}
                  tickFormatter={formatPrice}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={65}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Pattern markers */}
                {patterns.map((pattern, idx) => (
                  <ReferenceLine
                    key={`pattern-${idx}`}
                    x={pattern.timestamp}
                    stroke={
                      pattern.signal === 'bullish'
                        ? 'hsl(var(--success))'
                        : pattern.signal === 'bearish'
                        ? 'hsl(var(--destructive))'
                        : 'hsl(var(--muted-foreground))'
                    }
                    strokeDasharray="3 3"
                    strokeOpacity={0.5}
                  />
                ))}
                
                {/* Hidden bar to feed data, candles drawn by Customized */}
                <Bar dataKey="range" fill="transparent" isAnimationActive={false} />
                <Customized component={CandlesticksLayer} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Detected Patterns List */}
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
                              <p className="text-sm font-medium text-foreground truncate">
                                {pattern.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(pattern.timestamp).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                            <Badge
                              variant={
                                pattern.signal === 'bullish'
                                  ? 'default'
                                  : pattern.signal === 'bearish'
                                  ? 'destructive'
                                  : 'secondary'
                              }
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

          {patterns.length === 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum padrão significativo detectado no período selecionado
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
