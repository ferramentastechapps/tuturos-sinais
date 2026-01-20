import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PerformanceMetrics } from '@/types/analytics';
import { TrendingUp, TrendingDown, Target, Award, Clock, BarChart3 } from 'lucide-react';

interface PerformanceMetricsCardProps {
  metrics: PerformanceMetrics;
}

export const PerformanceMetricsCard = ({ metrics }: PerformanceMetricsCardProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Métricas de Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Total Return */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Retorno Total</p>
            <p className={`text-xl font-bold ${metrics.totalReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(metrics.totalReturn)}
            </p>
            <p className={`text-sm ${metrics.totalReturnPercentage >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatPercent(metrics.totalReturnPercentage)}
            </p>
          </div>

          {/* Win Rate */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" />
              Taxa de Acerto
            </p>
            <p className="text-xl font-bold">{metrics.winRate.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">
              {metrics.winningTrades}W / {metrics.losingTrades}L
            </p>
          </div>

          {/* Profit Factor */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Award className="h-3 w-3" />
              Fator de Lucro
            </p>
            <p className="text-xl font-bold">
              {metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">
              {metrics.profitFactor >= 2 ? 'Excelente' : metrics.profitFactor >= 1.5 ? 'Bom' : 'Regular'}
            </p>
          </div>

          {/* Sharpe Ratio */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
            <p className="text-xl font-bold">{metrics.sharpeRatio.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">
              {metrics.sharpeRatio >= 2 ? 'Excelente' : metrics.sharpeRatio >= 1 ? 'Bom' : 'Regular'}
            </p>
          </div>

          {/* Max Drawdown */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Max Drawdown
            </p>
            <p className="text-xl font-bold text-destructive">
              {formatCurrency(metrics.maxDrawdown)}
            </p>
            <p className="text-sm text-destructive">
              {formatPercent(-metrics.maxDrawdownPercentage)}
            </p>
          </div>

          {/* Average Win */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Ganho Médio
            </p>
            <p className="text-xl font-bold text-success">
              {formatCurrency(metrics.averageWin)}
            </p>
          </div>

          {/* Average Loss */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Perda Média
            </p>
            <p className="text-xl font-bold text-destructive">
              {formatCurrency(metrics.averageLoss)}
            </p>
          </div>

          {/* Best Trade */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Melhor Trade</p>
            <p className="text-xl font-bold text-success">
              {formatCurrency(metrics.bestTrade)}
            </p>
          </div>

          {/* Worst Trade */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Pior Trade</p>
            <p className="text-xl font-bold text-destructive">
              {formatCurrency(metrics.worstTrade)}
            </p>
          </div>

          {/* Average Holding Time */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Tempo Médio
            </p>
            <p className="text-xl font-bold">
              {metrics.averageHoldingTime.toFixed(1)}
            </p>
            <p className="text-sm text-muted-foreground">dias</p>
          </div>

          {/* Total Trades */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total de Trades</p>
            <p className="text-xl font-bold">{metrics.totalTrades}</p>
            <p className="text-sm text-muted-foreground">fechados</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
