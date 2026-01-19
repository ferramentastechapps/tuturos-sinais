import { useState } from 'react';
import { useHistoricalPrices } from '@/hooks/useHistoricalPrices';
import { TimeRange } from '@/services/coingeckoChart';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HistoricalChartProps {
  symbol: string;
  name: string;
}

const formatDate = (timestamp: number, range: TimeRange) => {
  const date = new Date(timestamp);
  if (range === '7d') {
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatPrice = (price: number) => {
  if (price >= 1000) {
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  }
  return `$${price.toFixed(4)}`;
};

export const HistoricalChart = ({ symbol, name }: HistoricalChartProps) => {
  const [range, setRange] = useState<TimeRange>('7d');
  const { data, isLoading, error } = useHistoricalPrices(symbol, range);

  const isPositive = (data?.priceChangePercent || 0) >= 0;

  // Sample data points for performance (max 100 points)
  const chartData = data?.prices
    ? data.prices
        .filter((_, i) => i % Math.max(1, Math.floor(data.prices.length / 100)) === 0)
        .map(point => ({
          date: point.timestamp,
          price: point.price,
        }))
    : [];

  return (
    <div className="trading-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Price History</h3>
          <p className="text-sm text-muted-foreground">{name}</p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as TimeRange)}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="7d" className="text-xs px-3">7D</TabsTrigger>
            <TabsTrigger value="30d" className="text-xs px-3">30D</TabsTrigger>
            <TabsTrigger value="90d" className="text-xs px-3">90D</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="h-[200px] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          Failed to load chart data
        </div>
      ) : (
        <>
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
              {formatPrice(data?.priceChange || 0)} in {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
            </span>
          </div>

          {/* Chart */}
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                      stopOpacity={0.3}
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
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  formatter={(value: number) => [formatPrice(value), 'Price']}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                  strokeWidth={2}
                  fill={`url(#gradient-${symbol})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Price Range */}
          <div className="flex justify-between mt-4 pt-4 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Period Low</p>
              <p className="text-sm font-mono text-destructive">{formatPrice(data?.minPrice || 0)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Period High</p>
              <p className="text-sm font-mono text-success">{formatPrice(data?.maxPrice || 0)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
