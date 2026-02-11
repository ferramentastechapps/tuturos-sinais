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
  calculateVWAP,
} from '@/utils/technicalIndicators';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { RSIChart, MACDChart, StochasticChart } from './SubCharts';
import { TradeSignal } from '@/types/trading';

interface AdvancedChartProps {
  symbol: string;
  name: string;
  activeSignal?: TradeSignal;
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

export const AdvancedChart = ({ symbol, name, activeSignal }: AdvancedChartProps) => {
  const [range, setRange] = useState<TimeRange>('90d');
  const { data, isLoading, error } = useHistoricalPrices(symbol, range);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Indicator toggles
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showEMA20, setShowEMA20] = useState(false);
  const [showVWAP, setShowVWAP] = useState(false);
  const [showBollinger, setShowBollinger] = useState(true);
  const [showIchimoku, setShowIchimoku] = useState(false);

  // Sub-chart toggles
  const [showRSI, setShowRSI] = useState(true);
  const [showMACD, setShowMACD] = useState(true);
  const [showStochastic, setShowStochastic] = useState(false);

  const isPositive = (data?.priceChangePercent || 0) >= 0;

  // Calculate all indicators
  const chartData = useMemo(() => {
    if (!data?.prices || data.prices.length < 52) return [];

    const prices = data.prices;
    const volumes = data.totalVolumes;

    const sma20 = calculateSMA(prices, 20);
    const sma50 = calculateSMA(prices, 50);
    const ema20 = calculateEMA(prices, 20);
    const bollinger = calculateBollingerBands(prices, 20, 2);
    const rsi = calculateRSI(prices, 14);
    const macd = calculateMACD(prices, 12, 26, 9);
    const stochastic = calculateStochastic(prices, 14, 3);
    const ichimoku = calculateIchimoku(prices);
    const vwap = calculateVWAP(prices, volumes);

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
      const vwapPoint = vwap.find((v) => v.timestamp === point.timestamp);

      return {
        date: point.timestamp,
        price: point.price,
        sma20: sma20Point?.value,
        sma50: sma50Point?.value,
        ema20: ema20Point?.value,
        vwap: vwapPoint?.value,
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
      vwap: latest.vwap,
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
          <span>Configurar Indicadores ({[showSMA20, showSMA50, showEMA20, showBollinger, showRSI, showMACD, showVWAP].filter(Boolean).length})</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 p-3 bg-muted/30 rounded-lg mb-4">
            <div className="flex items-center gap-2"><Switch id="sma20" checked={showSMA20} onCheckedChange={setShowSMA20} /><Label htmlFor="sma20" className="text-xs text-nowrap">SMA 20</Label></div>
            <div className="flex items-center gap-2"><Switch id="sma50" checked={showSMA50} onCheckedChange={setShowSMA50} /><Label htmlFor="sma50" className="text-xs text-nowrap">SMA 50</Label></div>
            <div className="flex items-center gap-2"><Switch id="ema20" checked={showEMA20} onCheckedChange={setShowEMA20} /><Label htmlFor="ema20" className="text-xs text-nowrap">EMA 20</Label></div>
            <div className="flex items-center gap-2"><Switch id="vwap" checked={showVWAP} onCheckedChange={setShowVWAP} /><Label htmlFor="vwap" className="text-xs text-nowrap">VWAP</Label></div>
            <div className="flex items-center gap-2"><Switch id="bollinger" checked={showBollinger} onCheckedChange={setShowBollinger} /><Label htmlFor="bollinger" className="text-xs text-nowrap">Bollinger</Label></div>
            <div className="flex items-center gap-2"><Switch id="ichimoku" checked={showIchimoku} onCheckedChange={setShowIchimoku} /><Label htmlFor="ichimoku" className="text-xs text-nowrap">Ichimoku</Label></div>
            <div className="flex items-center gap-2"><Switch id="rsi" checked={showRSI} onCheckedChange={setShowRSI} /><Label htmlFor="rsi" className="text-xs text-nowrap">RSI (14)</Label></div>
            <div className="flex items-center gap-2"><Switch id="macd" checked={showMACD} onCheckedChange={setShowMACD} /><Label htmlFor="macd" className="text-xs text-nowrap">MACD</Label></div>
            <div className="flex items-center gap-2"><Switch id="stoch" checked={showStochastic} onCheckedChange={setShowStochastic} /><Label htmlFor="stoch" className="text-xs text-nowrap">Stoch</Label></div>
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
          {currentValues && settingsOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 animate-fade-up">
              <div className="p-2 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground">Preço</p>
                <p className="text-sm font-mono font-semibold">{formatPrice(currentValues.price)}</p>
              </div>
              {showVWAP && currentValues.vwap && (
                <div className="p-2 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">VWAP</p>
                  <p className="text-sm font-mono font-semibold" style={{ color: '#FF00FF' }}>{formatPrice(currentValues.vwap)}</p>
                </div>
              )}
            </div>
          )}

          {/* Price Change Summary */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className={cn('flex items-center gap-1 text-sm font-medium', isPositive ? 'text-success' : 'text-destructive')}>
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {isPositive ? '+' : ''}{data?.priceChangePercent.toFixed(2)}%
              </div>
              <span className="text-sm text-muted-foreground">
                {formatPrice(data?.priceChange || 0)} em {range === '7d' ? '7 dias' : range === '30d' ? '30 dias' : '90 dias'}
              </span>
            </div>
          </div>

          {/* Maine Chart Area */}
          <div className="h-[320px] mb-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} stopOpacity={0} />
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
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  formatter={(value: number, name: string) => {
                    if (typeof value !== 'number') return [value, name];
                    return [formatPrice(value), name];
                  }}
                />

                {/* Signal Markers */}
                {activeSignal && (
                  <>
                    <ReferenceLine y={activeSignal.entry} stroke="hsl(var(--primary))" strokeDasharray="3 3" label={{ position: 'right', value: 'ENTRY', fill: 'hsl(var(--primary))', fontSize: 10 }} />
                    <ReferenceLine y={activeSignal.takeProfit} stroke="hsl(var(--success))" strokeDasharray="3 3" label={{ position: 'right', value: 'TP', fill: 'hsl(var(--success))', fontSize: 10 }} />
                    <ReferenceLine y={activeSignal.stopLoss} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ position: 'right', value: 'SL', fill: 'hsl(var(--destructive))', fontSize: 10 }} />
                  </>
                )}

                {/* Ichimoku */}
                {showIchimoku && (
                  <>
                    <defs>
                      <linearGradient id={`ichimoku-cloud-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="senkouSpanA" stroke="hsl(var(--success))" strokeWidth={1} fill={`url(#ichimoku-cloud-${symbol})`} dot={false} opacity={0.7} />
                    <Area type="monotone" dataKey="senkouSpanB" stroke="hsl(var(--destructive))" strokeWidth={1} fill="none" dot={false} opacity={0.7} />
                    <Line type="monotone" dataKey="tenkanSen" stroke="hsl(142, 76%, 36%)" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="kijunSen" stroke="hsl(0, 84%, 60%)" strokeWidth={1.5} dot={false} />
                  </>
                )}

                {/* Bollinger */}
                {showBollinger && (
                  <>
                    <Area type="monotone" dataKey="bollingerUpper" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} />
                    <Area type="monotone" dataKey="bollingerLower" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} />
                  </>
                )}

                {/* Price */}
                <Area type="monotone" dataKey="price" stroke={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} strokeWidth={2} fill={`url(#gradient-${symbol})`} dot={false} />

                {/* MA Lines */}
                {showSMA20 && <Line type="monotone" dataKey="sma20" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />}
                {showSMA50 && <Line type="monotone" dataKey="sma50" stroke="hsl(var(--warning))" strokeWidth={1.5} dot={false} />}
                {showEMA20 && <Line type="monotone" dataKey="ema20" stroke="hsl(var(--accent-foreground))" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />}
                {showVWAP && <Line type="monotone" dataKey="vwap" stroke="#FF00FF" strokeWidth={1.5} dot={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Modular Sub-Charts */}
          <div className="space-y-[2px]">
            {showRSI && <RSIChart data={chartData} />}
            {showMACD && <MACDChart data={chartData} />}
            {showStochastic && <StochasticChart data={chartData} />}
          </div>
        </>
      )}
    </div>
  );
};

