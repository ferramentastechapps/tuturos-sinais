import { TrendingUp, TrendingDown, Wallet, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PortfolioSummary } from '@/types/portfolio';

interface PortfolioSummaryCardProps {
  summary: PortfolioSummary;
}

export const PortfolioSummaryCard = ({ summary }: PortfolioSummaryCardProps) => {
  const isPositive = summary.totalPnL >= 0;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Resumo do Portfólio
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Valor Total</p>
            <p className="text-2xl font-bold font-mono text-foreground">
              ${summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Investido</p>
            <p className="text-xl font-semibold font-mono text-muted-foreground">
              ${summary.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">P&L Total</p>
            <div className="flex items-center gap-2">
              {isPositive ? (
                <TrendingUp className="h-5 w-5 text-success" />
              ) : (
                <TrendingDown className="h-5 w-5 text-destructive" />
              )}
              <p className={`text-xl font-bold font-mono ${isPositive ? 'text-success' : 'text-destructive'}`}>
                {isPositive ? '+' : ''}${summary.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Retorno</p>
            <p className={`text-xl font-bold font-mono ${isPositive ? 'text-success' : 'text-destructive'}`}>
              {isPositive ? '+' : ''}{summary.totalPnLPercentage.toFixed(2)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
