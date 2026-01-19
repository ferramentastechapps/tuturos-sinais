import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart } from 'lucide-react';
import { PortfolioSummary } from '@/types/portfolio';

interface PortfolioPnLChartProps {
  summary: PortfolioSummary;
}

export const PortfolioPnLChart = ({ summary }: PortfolioPnLChartProps) => {
  // Simulate historical P&L data based on current values
  // In a real app, this would come from stored historical snapshots
  const chartData = useMemo(() => {
    if (summary.assets.length === 0) return [];

    const days = 30;
    const data = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    
    // Use current P&L as end point, simulate path to it
    const currentPnL = summary.totalPnL;
    const volatility = summary.totalInvested * 0.02; // 2% daily volatility simulation
    
    let runningPnL = 0; // Start from 0
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now - i * dayMs);
      
      if (i === 0) {
        // Last point is actual current P&L
        runningPnL = currentPnL;
      } else {
        // Interpolate towards current P&L with some noise
        const progress = (days - i) / days;
        const targetPnL = currentPnL * progress;
        const noise = (Math.random() - 0.5) * volatility * (1 - progress * 0.5);
        runningPnL = targetPnL + noise;
      }
      
      data.push({
        date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        pnl: runningPnL,
        value: summary.totalInvested + runningPnL,
      });
    }
    
    return data;
  }, [summary]);

  if (chartData.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" />
            Evolução P&L (30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground text-sm">Adicione ativos para ver o gráfico</p>
        </CardContent>
      </Card>
    );
  }

  const isPositive = summary.totalPnL >= 0;
  const minPnL = Math.min(...chartData.map(d => d.pnl));
  const maxPnL = Math.max(...chartData.map(d => d.pnl));
  const padding = Math.max(Math.abs(maxPnL - minPnL) * 0.1, 100);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const pnl = payload[0].value;
      const isUp = pnl >= 0;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <p className={`font-mono font-semibold ${isUp ? 'text-success' : 'text-destructive'}`}>
            {isUp ? '+' : ''}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <LineChart className="h-5 w-5 text-primary" />
          Evolução P&L (30 dias)
          <span className="text-xs text-muted-foreground font-normal ml-2">(simulado)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="pnlGradientPositive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 72%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 72%, 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pnlGradientNegative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(215, 15%, 55%)', fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={[minPnL - padding, maxPnL + padding]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(215, 15%, 55%)', fontSize: 10 }}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                width={45}
              />
              <ReferenceLine 
                y={0} 
                stroke="hsl(220, 15%, 25%)" 
                strokeDasharray="3 3" 
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke={isPositive ? 'hsl(142, 72%, 45%)' : 'hsl(0, 72%, 55%)'}
                strokeWidth={2}
                fill={isPositive ? 'url(#pnlGradientPositive)' : 'url(#pnlGradientNegative)'}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
