import { useState, useMemo } from 'react';
import { useHistoricalPrices } from '@/hooks/useHistoricalPrices';
import { TimeRange } from '@/services/coingeckoChart';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  Bar,
  ReferenceLine,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, TrendingUp, TrendingDown, Activity, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateStochastic,
  calculateIchimoku,
} from '@/utils/technicalIndicators';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface AdvancedChartProps {
  symbol: string;
  name: string;
}

const formatDate = (timestamp: number, range: TimeRange) => {
  const date = new Date(timestamp);
  if (range === '7d') {
    return date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
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

export const AdvancedChart = ({ symbol, name }: AdvancedChartProps) => {
  const [range, setRange] = useState<TimeRange>('90d');
  const { data, isLoading, error } = useHistoricalPrices(symbol, range);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Indicator toggles
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showEMA20, setShowEMA20] = useState(false);
  const [showBollinger, setShowBollinger] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [showMACD, setShowMACD] = useState(true);
  const [showStochastic, setShowStochastic] = useState(true);
  const [showIchimoku, setShowIchimoku] = useState(false);

  const isPositive = (data?.priceChangePercent || 0) >= 0;

  // Calculate all indicators
  const chartData = useMemo(() => {
    if (!data?.prices || data.prices.length < 52) return [];

    const prices = data.prices;
    const sma20 = calculateSMA(prices, 20);
    const sma50 = calculateSMA(prices, 50);
    const ema20 = calculateEMA(prices, 20);
    const bollinger = calculateBollingerBands(prices, 20, 2);
    const rsi = calculateRSI(prices, 14);
    const macd = calculateMACD(prices, 12, 26, 9);
    const stochastic = calculateStochastic(prices, 14, 3);
    const ichimoku = calculateIchimoku(prices);

    // Sample data for performance
    const sampledPrices = prices.filter(
      (_, i) => i % Math.max(1, Math.floor(prices.length / 100)) === 0
    );

    return sampledPrices.map((point) => {
      const sma20Point = sma20.find((s) => s.timestamp === point.timestamp);
      const sma50Point = sma50.find((s) => s.timestamp === point.timestamp);
      const ema20Point = ema20.find((s) => s.timestamp === point.timestamp);
      const bollingerPoint = bollinger.find((b) => b.timestamp === point.timestamp);
      const rsiPoint = rsi.find((r) => r.timestamp === point.timestamp);
      const macdPoint = macd.find((m) => m.timestamp === point.timestamp);
      const stochPoint = stochastic.find((s) => s.timestamp === point.timestamp);
      const ichimokuPoint = ichimoku.find((i) => i.timestamp === point.timestamp);

      return {
        date: point.timestamp,
        price: point.price,
        sma20: sma20Point?.value,
        sma50: sma50Point?.value,
        ema20: ema20Point?.value,
        bollingerUpper: bollingerPoint?.upper,
        bollingerMiddle: bollingerPoint?.middle,
        bollingerLower: bollingerPoint?.lower,
        rsi: rsiPoint?.value,
        macd: macdPoint?.macd,
        macdSignal: macdPoint?.signal,
        macdHistogram: macdPoint?.histogram,
        stochK: stochPoint?.k,
        stochD: stochPoint?.d,
        tenkanSen: ichimokuPoint?.tenkanSen,
        kijunSen: ichimokuPoint?.kijunSen,
        senkouSpanA: ichimokuPoint?.senkouSpanA,
        senkouSpanB: ichimokuPoint?.senkouSpanB,
      };
    });
  }, [data]);

  // Get current indicator values
  const currentValues = useMemo(() => {
    if (chartData.length === 0) return null;
    const latest = chartData[chartData.length - 1];
    return {
      price: latest.price,
      sma20: latest.sma20,
      sma50: latest.sma50,
      ema20: latest.ema20,
      rsi: latest.rsi,
      macd: latest.macd,
      macdSignal: latest.macdSignal,
      stochK: latest.stochK,
      stochD: latest.stochD,
      tenkanSen: latest.tenkanSen,
      kijunSen: latest.kijunSen,
    };
  }, [chartData]);

  return (
    <div className="trading-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Gráfico Avançado</h3>
            <p className="text-sm text-muted-foreground">{name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={range} onValueChange={(v) => setRange(v as TimeRange)}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="7d" className="text-xs px-3">7D</TabsTrigger>
              <TabsTrigger value="30d" className="text-xs px-3">30D</TabsTrigger>
              <TabsTrigger value="90d" className="text-xs px-3">90D</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Indicator Settings */}
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
          <Settings2 className="w-4 h-4" />
          <span>Configurar Indicadores</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/30 rounded-lg mb-4">
            <div className="flex items-center gap-2">
              <Switch id="sma20" checked={showSMA20} onCheckedChange={setShowSMA20} />
              <Label htmlFor="sma20" className="text-xs">SMA 20</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="sma50" checked={showSMA50} onCheckedChange={setShowSMA50} />
              <Label htmlFor="sma50" className="text-xs">SMA 50</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="ema20" checked={showEMA20} onCheckedChange={setShowEMA20} />
              <Label htmlFor="ema20" className="text-xs">EMA 20</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="bollinger" checked={showBollinger} onCheckedChange={setShowBollinger} />
              <Label htmlFor="bollinger" className="text-xs">Bollinger</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="ichimoku" checked={showIchimoku} onCheckedChange={setShowIchimoku} />
              <Label htmlFor="ichimoku" className="text-xs">Ichimoku</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="rsi" checked={showRSI} onCheckedChange={setShowRSI} />
              <Label htmlFor="rsi" className="text-xs">RSI</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="macd" checked={showMACD} onCheckedChange={setShowMACD} />
              <Label htmlFor="macd" className="text-xs">MACD</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="stochastic" checked={showStochastic} onCheckedChange={setShowStochastic} />
              <Label htmlFor="stochastic" className="text-xs">Stochastic</Label>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {isLoading ? (
        <div className="h-[400px] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
          Falha ao carregar dados do gráfico
        </div>
      ) : chartData.length < 10 ? (
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
          Dados insuficientes para calcular indicadores
        </div>
      ) : (
        <>
          {/* Current Indicator Values */}
          {currentValues && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="p-2 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground">Preço</p>
                <p className="text-sm font-mono font-semibold">{formatPrice(currentValues.price)}</p>
              </div>
              {showRSI && currentValues.rsi && (
                <div className={cn(
                  "p-2 rounded-lg",
                  currentValues.rsi < 30 ? "bg-success/10" : currentValues.rsi > 70 ? "bg-destructive/10" : "bg-muted/30"
                )}>
                  <p className="text-xs text-muted-foreground">RSI (14)</p>
                  <p className={cn(
                    "text-sm font-mono font-semibold",
                    currentValues.rsi < 30 ? "text-success" : currentValues.rsi > 70 ? "text-destructive" : ""
                  )}>
                    {currentValues.rsi.toFixed(1)}
                    <span className="text-xs ml-1">
                      {currentValues.rsi < 30 ? "Sobrevendido" : currentValues.rsi > 70 ? "Sobrecomprado" : ""}
                    </span>
                  </p>
                </div>
              )}
              {showMACD && currentValues.macd !== undefined && (
                <div className={cn(
                  "p-2 rounded-lg",
                  currentValues.macd > 0 ? "bg-success/10" : "bg-destructive/10"
                )}>
                  <p className="text-xs text-muted-foreground">MACD</p>
                  <p className={cn(
                    "text-sm font-mono font-semibold",
                    currentValues.macd > 0 ? "text-success" : "text-destructive"
                  )}>
                    {currentValues.macd.toFixed(2)}
                  </p>
                </div>
              )}
              {(showSMA20 || showSMA50) && (
                <div className="p-2 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">SMA 20/50</p>
                  <p className="text-sm font-mono">
                    {currentValues.sma20 ? formatPrice(currentValues.sma20) : '-'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Price Change Summary */}
          <div className="flex items-center gap-4 mb-4">
            <div className={cn(
              'flex items-center gap-1 text-sm font-medium',
              isPositive ? 'text-success' : 'text-destructive'
            )}>
              {isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {isPositive ? '+' : ''}{data?.priceChangePercent.toFixed(2)}%
            </div>
            <span className="text-sm text-muted-foreground">
              {formatPrice(data?.priceChange || 0)} em {range === '7d' ? '7 dias' : range === '30d' ? '30 dias' : '90 dias'}
            </span>
          </div>

          {/* Main Price Chart with Overlays */}
          <div className="h-[250px] mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => formatDate(val, range)}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tickFormatter={formatPrice}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={65}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      price: 'Preço',
                      sma20: 'SMA 20',
                      sma50: 'SMA 50',
                      ema20: 'EMA 20',
                      bollingerUpper: 'BB Superior',
                      bollingerLower: 'BB Inferior',
                      tenkanSen: 'Tenkan-Sen',
                      kijunSen: 'Kijun-Sen',
                      senkouSpanA: 'Senkou A',
                      senkouSpanB: 'Senkou B',
                    };
                    return [formatPrice(value), labels[name] || name];
                  }}
                />

                {/* Ichimoku Cloud */}
                {showIchimoku && (
                  <>
                    <defs>
                      <linearGradient id={`ichimoku-cloud-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="senkouSpanA"
                      stroke="hsl(var(--success))"
                      strokeWidth={1}
                      fill={`url(#ichimoku-cloud-${symbol})`}
                      dot={false}
                      opacity={0.7}
                    />
                    <Area
                      type="monotone"
                      dataKey="senkouSpanB"
                      stroke="hsl(var(--destructive))"
                      strokeWidth={1}
                      fill="none"
                      dot={false}
                      opacity={0.7}
                    />
                    <Line
                      type="monotone"
                      dataKey="tenkanSen"
                      stroke="hsl(142, 76%, 36%)"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="kijunSen"
                      stroke="hsl(0, 84%, 60%)"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </>
                )}

                {/* Bollinger Bands */}
                {showBollinger && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="bollingerUpper"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      fill="none"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="bollingerLower"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      fill="none"
                      dot={false}
                    />
                  </>
                )}

                {/* Price Area */}
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                  strokeWidth={2}
                  fill={`url(#gradient-${symbol})`}
                  dot={false}
                />

                {/* Moving Averages */}
                {showSMA20 && (
                  <Line
                    type="monotone"
                    dataKey="sma20"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                )}
                {showSMA50 && (
                  <Line
                    type="monotone"
                    dataKey="sma50"
                    stroke="hsl(var(--warning))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                )}
                {showEMA20 && (
                  <Line
                    type="monotone"
                    dataKey="ema20"
                    stroke="hsl(var(--accent-foreground))"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* RSI Chart */}
          {showRSI && (
            <div className="h-[80px] mb-4">
              <p className="text-xs text-muted-foreground mb-1">RSI (14)</p>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <XAxis dataKey="date" hide />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[30, 50, 70]}
                    fontSize={9}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <ReferenceLine y={70} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={30} stroke="hsl(var(--success))" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.3} />
                  <Line
                    type="monotone"
                    dataKey="rsi"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* MACD Chart */}
          {showMACD && (
            <div className="h-[80px]">
              <p className="text-xs text-muted-foreground mb-1">MACD (12, 26, 9)</p>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <XAxis dataKey="date" hide />
                  <YAxis
                    fontSize={9}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                    width={30}
                    tickFormatter={(v) => v.toFixed(0)}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.3} />
                  <Bar
                    dataKey="macdHistogram"
                    fill="hsl(var(--primary))"
                    opacity={0.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="macd"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="macdSignal"
                    stroke="hsl(var(--warning))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Stochastic Chart */}
          {showStochastic && (
            <div className="h-[80px] mb-4">
              <p className="text-xs text-muted-foreground mb-1">Stochastic (14, 3)</p>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <XAxis dataKey="date" hide />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[20, 50, 80]}
                    fontSize={9}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <ReferenceLine y={80} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={20} stroke="hsl(var(--success))" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.3} />
                  <Line
                    type="monotone"
                    dataKey="stochK"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="stochD"
                    stroke="hsl(var(--warning))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-border text-xs">
            {showSMA20 && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-primary rounded" />
                <span className="text-muted-foreground">SMA 20</span>
              </div>
            )}
            {showSMA50 && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-warning rounded" />
                <span className="text-muted-foreground">SMA 50</span>
              </div>
            )}
            {showBollinger && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 border-t border-dashed border-muted-foreground" />
                <span className="text-muted-foreground">Bollinger</span>
              </div>
            )}
            {showIchimoku && (
              <>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 rounded" style={{ backgroundColor: 'hsl(142, 76%, 36%)' }} />
                  <span className="text-muted-foreground">Tenkan</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 rounded" style={{ backgroundColor: 'hsl(0, 84%, 60%)' }} />
                  <span className="text-muted-foreground">Kijun</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-2 rounded opacity-30 bg-gradient-to-b from-success to-destructive" />
                  <span className="text-muted-foreground">Cloud</span>
                </div>
              </>
            )}
            {showRSI && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">RSI: 30/70</span>
              </div>
            )}
            {showStochastic && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Stoch: 20/80</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
