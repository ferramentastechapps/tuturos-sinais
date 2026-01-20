import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PeriodPerformance } from '@/types/analytics';
import { Calendar, TrendingUp, TrendingDown } from 'lucide-react';

interface PeriodPerformanceCardProps {
  periods: PeriodPerformance[];
}

export const PeriodPerformanceCard = ({ periods }: PeriodPerformanceCardProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getPeriodLabel = (period: string) => {
    const labels: Record<string, string> = {
      daily: 'Hoje',
      weekly: 'Últimos 7 dias',
      monthly: 'Este mês',
      yearly: 'Este ano',
      all: 'Total',
    };
    return labels[period] || period;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Performance por Período
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {periods.map((period) => (
            <div key={period.period} className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div className="space-y-1">
                <p className="font-semibold">{getPeriodLabel(period.period)}</p>
                <p className="text-sm text-muted-foreground">
                  {period.trades} trades • {period.winRate.toFixed(0)}% win rate
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className={`text-lg font-bold ${period.return >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(period.return)}
                </p>
                <p className={`text-sm flex items-center gap-1 justify-end ${period.returnPercentage >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {period.returnPercentage >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {formatPercent(period.returnPercentage)}
                </p>
              </div>
            </div>
          ))}
          {periods.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhum trade fechado ainda
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
