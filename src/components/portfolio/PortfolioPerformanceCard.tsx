import { TrendingUp, TrendingDown, Award, AlertTriangle, BarChart3, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PortfolioAssetWithMetrics } from '@/types/portfolio';

interface PortfolioPerformanceCardProps {
  assets: PortfolioAssetWithMetrics[];
}

export const PortfolioPerformanceCard = ({ assets }: PortfolioPerformanceCardProps) => {
  if (assets.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Métricas de Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-muted-foreground text-sm">Adicione ativos para ver métricas</p>
        </CardContent>
      </Card>
    );
  }

  // Best and worst performers by P&L percentage
  const sortedByPnL = [...assets].sort((a, b) => b.pnlPercentage - a.pnlPercentage);
  const bestPerformer = sortedByPnL[0];
  const worstPerformer = sortedByPnL[sortedByPnL.length - 1];

  // 24h movers
  const sortedBy24h = [...assets].sort((a, b) => b.change24h - a.change24h);
  const best24h = sortedBy24h[0];
  const worst24h = sortedBy24h[sortedBy24h.length - 1];

  // Diversification score (based on allocation spread - higher is more diversified)
  const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0);
  const allocations = assets.map(a => totalValue > 0 ? a.currentValue / totalValue : 0);
  
  // Herfindahl-Hirschman Index for diversification (inverted and normalized to 0-100)
  const hhi = allocations.reduce((sum, alloc) => sum + Math.pow(alloc, 2), 0);
  const diversificationScore = Math.round((1 - hhi) * 100);

  // Winners vs Losers count
  const winners = assets.filter(a => a.pnl > 0).length;
  const losers = assets.filter(a => a.pnl < 0).length;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Métricas de Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Best/Worst Performers */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-center gap-2 mb-1">
              <Award className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Melhor P&L</span>
            </div>
            <p className="font-semibold text-foreground">{bestPerformer.symbol.toUpperCase()}</p>
            <p className="text-sm font-mono text-success">
              {bestPerformer.pnlPercentage >= 0 ? '+' : ''}{bestPerformer.pnlPercentage.toFixed(2)}%
            </p>
          </div>

          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Pior P&L</span>
            </div>
            <p className="font-semibold text-foreground">{worstPerformer.symbol.toUpperCase()}</p>
            <p className="text-sm font-mono text-destructive">
              {worstPerformer.pnlPercentage >= 0 ? '+' : ''}{worstPerformer.pnlPercentage.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* 24h Movers */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">24h Alta</span>
            </div>
            <p className="font-semibold text-foreground">{best24h.symbol.toUpperCase()}</p>
            <p className={`text-sm font-mono ${best24h.change24h >= 0 ? 'text-success' : 'text-destructive'}`}>
              {best24h.change24h >= 0 ? '+' : ''}{best24h.change24h.toFixed(2)}%
            </p>
          </div>

          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">24h Baixa</span>
            </div>
            <p className="font-semibold text-foreground">{worst24h.symbol.toUpperCase()}</p>
            <p className={`text-sm font-mono ${worst24h.change24h >= 0 ? 'text-success' : 'text-destructive'}`}>
              {worst24h.change24h >= 0 ? '+' : ''}{worst24h.change24h.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Diversification & Win Rate */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Diversificação</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${diversificationScore}%` }}
                />
              </div>
              <span className="text-sm font-mono text-foreground">{diversificationScore}%</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Win/Loss</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-success font-mono font-semibold">{winners}W</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-destructive font-mono font-semibold">{losers}L</span>
              {assets.length > 0 && (
                <span className="text-xs text-muted-foreground ml-auto">
                  ({((winners / assets.length) * 100).toFixed(0)}% taxa)
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
