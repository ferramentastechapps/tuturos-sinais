import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EquityPoint } from '@/types/analytics';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface EquityCurveChartProps {
  data: EquityPoint[];
  initialCapital: number;
}

export const EquityCurveChart = ({ data, initialCapital }: EquityCurveChartProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const chartData = data.map(point => ({
    date: formatDate(point.date),
    value: point.value,
    pnl: point.pnl,
    pnlPercentage: point.pnlPercentage,
  }));

  const currentValue = data[data.length - 1]?.value || initialCapital;
  const totalReturn = currentValue - initialCapital;
  const totalReturnPercentage = ((currentValue - initialCapital) / initialCapital) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Curva de Equity
          </span>
          <div className="text-right">
            <p className={`text-lg font-bold ${totalReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(totalReturn)}
            </p>
            <p className={`text-sm ${totalReturnPercentage >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalReturnPercentage >= 0 ? '+' : ''}{totalReturnPercentage.toFixed(2)}%
            </p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={formatCurrency}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'value') return [formatCurrency(value), 'Capital'];
                if (name === 'pnl') return [formatCurrency(value), 'P&L'];
                if (name === 'pnlPercentage') return [`${value.toFixed(2)}%`, 'Retorno'];
                return [value, name];
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
