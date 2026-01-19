import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, BarChart3, Target } from 'lucide-react';
import { TradesSummary } from '@/types/trades';

interface TradesSummaryCardProps {
  summary: TradesSummary;
}

export const TradesSummaryCard = ({ summary }: TradesSummaryCardProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <BarChart3 className="h-4 w-4" />
            Total de Operações
          </div>
          <div className="text-2xl font-bold mt-1">{summary.totalTrades}</div>
          <div className="text-xs text-muted-foreground">
            {summary.openTrades} abertas · {summary.closedTrades} fechadas
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            {summary.totalPnL >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            P&L Total
          </div>
          <div className={`text-2xl font-bold mt-1 ${summary.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {summary.totalPnL >= 0 ? '+' : ''}${summary.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Target className="h-4 w-4" />
            Taxa de Acerto
          </div>
          <div className="text-2xl font-bold mt-1">
            {summary.winRate.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">
            Operações vencedoras
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            Operações Abertas
          </div>
          <div className="text-2xl font-bold mt-1">{summary.openTrades}</div>
          <div className="text-xs text-muted-foreground">
            Posições ativas
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
