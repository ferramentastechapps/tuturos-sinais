import { Link } from 'react-router-dom';
import { Wallet, TrendingUp, TrendingDown, Bell, ArrowUpRight, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PortfolioSummary } from '@/types/portfolio';
import { TradeWithMetrics } from '@/types/trades';
import { PriceAlert } from '@/types/priceAlerts';

interface DashboardOverviewProps {
  portfolioSummary: PortfolioSummary;
  recentTrades: TradeWithMetrics[];
  activeAlerts: PriceAlert[];
}

export const DashboardOverview = ({
  portfolioSummary,
  recentTrades,
  activeAlerts,
}: DashboardOverviewProps) => {
  const formatCurrency = (value: number) => {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {/* Portfolio Value Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 sm:col-span-2 lg:col-span-1">
        <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="flex items-center justify-between text-xs sm:text-sm font-medium">
            <span className="flex items-center gap-1.5 sm:gap-2">
              <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              Valor do Portfolio
            </span>
            <Link to="/portfolio">
              <Button variant="ghost" size="sm" className="h-5 sm:h-6 px-1.5 sm:px-2 text-[10px] sm:text-xs">
                Ver tudo <ArrowUpRight className="ml-0.5 sm:ml-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
              </Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="space-y-1.5 sm:space-y-2">
            <p className="text-xl sm:text-2xl font-bold text-foreground">
              ${formatCurrency(portfolioSummary.totalValue)}
            </p>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <div className={`flex items-center gap-0.5 sm:gap-1 ${portfolioSummary.totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                {portfolioSummary.totalPnL >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
                <span className="text-sm sm:text-base font-medium">
                  {portfolioSummary.totalPnL >= 0 ? '+' : ''}${formatCurrency(portfolioSummary.totalPnL)}
                </span>
              </div>
              <span className={`text-xs sm:text-sm ${portfolioSummary.totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                ({portfolioSummary.totalPnLPercentage >= 0 ? '+' : ''}{portfolioSummary.totalPnLPercentage.toFixed(2)}%)
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {portfolioSummary.assets.length} ativo{portfolioSummary.assets.length !== 1 ? 's' : ''}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recent Trades Card */}
      <Card>
        <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="flex items-center justify-between text-xs sm:text-sm font-medium">
            <span className="flex items-center gap-1.5 sm:gap-2">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <span className="hidden xs:inline">Operações Recentes</span>
              <span className="xs:hidden">Operações</span>
            </span>
            <Link to="/trades">
              <Button variant="ghost" size="sm" className="h-5 sm:h-6 px-1.5 sm:px-2 text-[10px] sm:text-xs">
                Ver tudo <ArrowUpRight className="ml-0.5 sm:ml-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
              </Button>
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          {recentTrades.length === 0 ? (
            <p className="text-xs sm:text-sm text-muted-foreground py-3 sm:py-4 text-center">
              Nenhuma operação registrada
            </p>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {recentTrades.slice(0, 3).map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between py-1 sm:py-1.5 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Badge
                      variant={trade.type === 'buy' ? 'default' : 'destructive'}
                      className="text-[10px] sm:text-xs px-1 sm:px-1.5 py-0"
                    >
                      {trade.type === 'buy' ? 'C' : 'V'}
                    </Badge>
                    <span className="text-xs sm:text-sm font-medium">{trade.symbol}</span>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs sm:text-sm font-mono ${trade.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {trade.pnl >= 0 ? '+' : ''}${formatCurrency(trade.pnl)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Alerts Card */}
      <Card>
        <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="flex items-center justify-between text-xs sm:text-sm font-medium">
            <span className="flex items-center gap-1.5 sm:gap-2">
              <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              Alertas Ativos
            </span>
            {activeAlerts.length > 0 && (
              <Badge variant="secondary" className="text-[10px] sm:text-xs">
                {activeAlerts.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          {activeAlerts.length === 0 ? (
            <p className="text-xs sm:text-sm text-muted-foreground py-3 sm:py-4 text-center">
              Nenhum alerta ativo
            </p>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {activeAlerts.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between py-1 sm:py-1.5 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-xs sm:text-sm">
                      {alert.condition === 'above' ? '📈' : '📉'}
                    </span>
                    <span className="text-xs sm:text-sm font-medium">{alert.symbol}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs sm:text-sm font-mono text-muted-foreground">
                      {alert.condition === 'above' ? '>' : '<'} ${alert.targetPrice.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {activeAlerts.length > 3 && (
                <p className="text-[10px] sm:text-xs text-muted-foreground text-center pt-1">
                  +{activeAlerts.length - 3} mais
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
