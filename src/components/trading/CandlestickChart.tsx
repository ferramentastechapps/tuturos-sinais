import { useState, useMemo } from 'react';
import { useOHLCData } from '@/hooks/useOHLCData';
import { OHLCTimeRange } from '@/services/coingeckoOHLC';
import { detectPatterns, CandlestickPattern, getPatternEmoji } from '@/utils/candlestickPatterns';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
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

const formatDate = (timestamp: number, range: OHLCTimeRange) => {
  const date = new Date(timestamp);
  if (range === '1d') {
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

// Custom candlestick shape
const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  
  if (!payload) return null;
  
  const { open, close, high, low } = payload;
  const isBullish = close >= open;
  const color = isBullish ? 'hsl(var(--success))' : 'hsl(var(--destructive))';
  
  const candleWidth = Math.max(width * 0.6, 2);
  const wickWidth = 1;
  
  // Calculate positions
  const bodyTop = Math.min(open, close);
  const bodyBottom = Math.max(open, close);
  const bodyHeight = Math.abs(close - open);
  
  // Y scale factor (height represents the range)
  const range = high - low;
  const yScale = range > 0 ? Math.abs(height) / range : 0;
  
  // Center x position
  const centerX = x + width / 2;
  
  // Calculate Y positions (inverted because SVG y increases downward)
  const highY = y;
  const lowY = y + Math.abs(height);
  const bodyTopY = y + (high - bodyBottom) * yScale;
  const bodyBottomY = y + (high - bodyTop) * yScale;
  const bodyHeightPx = Math.max(bodyBottomY - bodyTopY, 1);
  
  return (
    <g>
      {/* Upper wick */}
      <line
        x1={centerX}
        y1={highY}
        x2={centerX}
        y2={bodyTopY}
        stroke={color}
        strokeWidth={wickWidth}
      />
      {/* Body */}
      <rect
        x={centerX - candleWidth / 2}
        y={bodyTopY}
        width={candleWidth}
        height={bodyHeightPx}
        fill={isBullish ? color : color}
        stroke={color}
        strokeWidth={1}
      />
      {/* Lower wick */}
      <line
        x1={centerX}
        y1={bodyBottomY}
        x2={centerX}
        y2={lowY}
        stroke={color}
        strokeWidth={wickWidth}
      />
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
  const [range, setRange] = useState<OHLCTimeRange>('7d');
  const { data: ohlcData, isLoading, error } = useOHLCData(symbol, range);
  const [selectedPattern, setSelectedPattern] = useState<CandlestickPattern | null>(null);

  // Detect patterns
  const patterns = useMemo(() => {
    if (!ohlcData || ohlcData.length < 3) return [];
    return detectPatterns(ohlcData);
  }, [ohlcData]);

  // Prepare chart data with patterns
  const chartData = useMemo(() => {
    if (!ohlcData) return [];
    
    return ohlcData.map((candle, index) => {
      const pattern = patterns.find(p => p.index === index);
      return {
        ...candle,
        range: candle.high - candle.low,
        pattern,
      };
    });
  }, [ohlcData, patterns]);

  // Calculate price domain
  const priceDomain = useMemo(() => {
    if (!ohlcData || ohlcData.length === 0) return [0, 100];
    const highs = ohlcData.map(d => d.high);
    const lows = ohlcData.map(d => d.low);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding];
  }, [ohlcData]);

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
        <Tabs value={range} onValueChange={(v) => setRange(v as OHLCTimeRange)}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="1d" className="text-xs px-3">1D</TabsTrigger>
            <TabsTrigger value="7d" className="text-xs px-3">7D</TabsTrigger>
            <TabsTrigger value="14d" className="text-xs px-3">14D</TabsTrigger>
            <TabsTrigger value="30d" className="text-xs px-3">30D</TabsTrigger>
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

          {/* Candlestick Chart */}
          <div className="h-[250px] mb-4">
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
                
                {/* Candlesticks using Bar with custom shape */}
                <Bar
                  dataKey="range"
                  shape={<CandlestickShape />}
                  isAnimationActive={false}
                />
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
