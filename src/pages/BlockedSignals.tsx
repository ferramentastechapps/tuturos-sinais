import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TradeSignal } from '@/types/trading';
import { SignalCard } from '@/components/dashboard/SignalCard';
import { ExecuteTradeModal } from '@/components/trading/ExecuteTradeModal';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Ban, 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  History,
  Activity,
  ArrowUpRight,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useBlockedSignals } from '@/hooks/useBlockedSignals';
import { formatCurrency, formatPercentage } from '@/utils/formatters';
import { cn } from '@/lib/utils';

export default function BlockedSignals() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useBlockedSignals(page, limit);
  const [selectedSignal, setSelectedSignal] = useState<TradeSignal | null>(null);
  const [executeSignal, setExecuteSignal] = useState<TradeSignal | null>(null);
  const [executeModalOpen, setExecuteModalOpen] = useState(false);

  const getRR = (signal: TradeSignal) => {
    const risk = Math.abs(signal.entry - signal.stopLoss);
    const reward = Math.abs(signal.takeProfit - signal.entry);
    return risk > 0 ? (reward / risk).toFixed(2) : '0';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-signal-buy mr-1" />;
      case 'worsening':
        return <TrendingDown className="w-4 h-4 text-signal-sell mr-1" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground mr-1" />;
    }
  };

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'Melhorando';
      case 'worsening':
        return 'Piorando';
      default:
        return 'Estável';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'text-signal-buy bg-signal-buy/10';
      case 'worsening':
        return 'text-signal-sell bg-signal-sell/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusBadge = (coin: any) => {
    if (coin.recentWinRate >= 30) {
      return (
        <Badge className="bg-signal-buy text-white border-transparent gap-1 font-semibold animate-pulse">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Pronta para Promoção
        </Badge>
      );
    } else if (coin.recentWinRate > 20) {
      return (
        <Badge variant="outline" className="text-warning border-warning/30 bg-warning/5 gap-1 font-medium">
          <TrendingUp className="w-3.5 h-3.5" />
          Recuperando
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="text-muted-foreground bg-muted border-transparent gap-1">
          <Ban className="w-3.5 h-3.5" />
          Quarentena
        </Badge>
      );
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center border border-destructive/20 shadow-inner">
              <Ban className="w-6 h-6 text-destructive" />
            </div>
            Sinais em Quarentena
          </h1>
          <p className="text-muted-foreground mt-1.5 max-w-3xl">
            Moedas com Win Rate abaixo de 20% que foram temporariamente silenciadas no Telegram. O motor continua operando e avaliando-as em simulação interna. Quando o WR nos últimos 10 sinais atingir 30%, elas serão promovidas e voltarão a enviar alertas normalmente.
          </p>
        </div>
      </div>

      {/* Grid of Quarantined Coins Statistics */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Moedas Sob Análise ({data?.coins?.length || 0})
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="border-border/40 bg-card/40 animate-pulse h-44">
                <CardContent className="h-full flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : data?.coins?.length === 0 ? (
          <Card className="border border-border/50 bg-card/40 backdrop-blur-sm p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-signal-buy mx-auto mb-3 opacity-60" />
            <h3 className="text-lg font-bold text-foreground">Excelente! Nenhuma moeda bloqueada</h3>
            <p className="text-muted-foreground text-sm mt-1">Todos os pares monitorados estão operando com Win Rate saudável acima de 20%.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data?.coins.map((coin) => (
              <Card key={coin.pair} className="border border-border/50 bg-card/50 hover:bg-card/75 transition-all shadow-sm hover:shadow relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-destructive/5 blur-2xl rounded-full" />
                
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg font-bold font-mono tracking-tight text-foreground">{coin.pair.replace('USDT', '/USDT')}</CardTitle>
                      <CardDescription className="text-xs font-mono">Último sinal: {new Date(coin.lastSignal.createdAt).toLocaleDateString()}</CardDescription>
                    </div>
                    {getStatusBadge(coin)}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3.5">
                  {/* Win Rates Table */}
                  <div className="grid grid-cols-2 gap-3 text-xs bg-muted/20 p-2 rounded-lg border border-border/30">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground">WR Histórico</span>
                      <div className="font-semibold text-sm font-mono text-foreground">{coin.winRate}%</div>
                      <div className="text-[10px] text-muted-foreground">{coin.wins}W - {coin.losses}L</div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground">WR Recente (10)</span>
                      <div className="font-semibold text-sm font-mono text-foreground flex items-center">
                        {coin.recentWinRate}%
                      </div>
                      <div className="text-[10px] flex items-center">
                        {getTrendIcon(coin.trend)}
                        <span className={cn("text-[9px] px-1 py-0.5 rounded font-medium", getTrendColor(coin.trend))}>
                          {getTrendLabel(coin.trend)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress to release (Promotion Progress) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-muted-foreground">Progresso de Recuperação</span>
                      <span className="font-mono text-foreground">{coin.promotionProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          coin.recentWinRate >= 30 ? "bg-signal-buy" : coin.recentWinRate > 20 ? "bg-warning" : "bg-destructive"
                        )}
                        style={{ width: `${coin.promotionProgress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">Precisa de WR ≥ 30% nos últimos 10 sinais para ser promovida</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Grid of Blocked Signals */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico de Sinais em Quarentena ({data?.stats?.total || 0})
          </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="border-border/40 bg-card/40 animate-pulse h-60" />
            ))}
          </div>
        ) : data?.signals?.length === 0 ? (
          <Card className="border border-border/50 bg-card/40 p-8 text-center text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>Nenhum sinal gerado em quarentena até o momento.</p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {data?.signals.map((signal) => (
                <SignalCard 
                  key={signal.id}
                  signal={signal}
                  onAnalyze={() => setSelectedSignal(signal)}
                  onExecute={() => { setExecuteSignal(signal); setExecuteModalOpen(true); }}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {data?.pagination && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium text-muted-foreground font-mono">
                  Página {page} de {data.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={page === data.pagination.totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Signal Detail Modal */}
      <Dialog open={!!selectedSignal} onOpenChange={(open) => !open && setSelectedSignal(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl font-bold font-mono text-foreground">{selectedSignal?.pair}</span>
              <Badge
                variant={selectedSignal?.type === 'LONG' ? 'default' : 'destructive'}
                className={cn(
                  selectedSignal?.type === 'LONG' ? "bg-signal-buy hover:bg-signal-buy/90" : "bg-signal-sell hover:bg-signal-sell/90"
                )}
              >
                {selectedSignal?.type}
              </Badge>
              <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/5 font-semibold font-mono text-[9px] uppercase">
                Em Quarentena
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Detalhes do sinal gerado sob quarentena em {selectedSignal && new Date(selectedSignal.createdAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {selectedSignal && (
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Context Narrative */}
              {selectedSignal.indicators.some(i => i.includes('Moeda Ruim')) && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold leading-relaxed">
                  <AlertTriangle className="w-4.5 h-4.5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    Sinal bloqueado para Telegram devido a histórico ruim neste par. 
                    Calculando performance em ambiente simulado para futura reabilitação.
                  </div>
                </div>
              )}

              {/* Entry / TPs / SL */}
              <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-medium">Entrada</span>
                  <span className="text-lg font-mono font-bold text-foreground">
                    {formatCurrency(selectedSignal.entry)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-signal-buy font-medium">🎯 Alvo 1 (TP1)</span>
                  <div className="text-right">
                    <span className="text-base font-mono font-bold text-signal-buy">
                      {formatCurrency(selectedSignal.takeProfit1 || selectedSignal.takeProfit)}
                    </span>
                    <span className="text-xs text-signal-buy/80 ml-2">
                      +{formatPercentage(Math.abs(((selectedSignal.takeProfit1 || selectedSignal.takeProfit) - selectedSignal.entry) / selectedSignal.entry) * 100)}
                    </span>
                  </div>
                </div>
                {selectedSignal.takeProfit2 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-signal-buy/80 font-medium">🎯 Alvo 2 (TP2)</span>
                    <div className="text-right">
                      <span className="text-base font-mono font-semibold text-signal-buy/80">
                        {formatCurrency(selectedSignal.takeProfit2)}
                      </span>
                      <span className="text-xs text-signal-buy/60 ml-2">
                        +{formatPercentage(Math.abs((selectedSignal.takeProfit2 - selectedSignal.entry) / selectedSignal.entry) * 100)}
                      </span>
                    </div>
                  </div>
                )}
                {selectedSignal.takeProfit3 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-amber-400 font-medium font-mono">🚀 Alvo 3 / Trailing</span>
                    <div className="text-right">
                      <span className="text-base font-mono font-semibold text-amber-400">
                        {formatCurrency(selectedSignal.takeProfit3)}
                      </span>
                      <span className="text-xs text-amber-400/60 ml-2">
                        +{formatPercentage(Math.abs((selectedSignal.takeProfit3 - selectedSignal.entry) / selectedSignal.entry) * 100)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
                  <span className="text-sm text-signal-sell font-medium">🛡️ Stop Loss</span>
                  <div className="text-right">
                    <span className="text-base font-mono font-bold text-signal-sell">
                      {formatCurrency(selectedSignal.stopLoss)}
                    </span>
                    <span className="text-xs text-signal-sell/80 ml-2">
                      -{formatPercentage(Math.abs((selectedSignal.entry - selectedSignal.stopLoss) / selectedSignal.entry) * 100)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Technical Confluences */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Confluências Técnicas
                </h4>
                <div className="bg-card p-3 rounded-lg border border-border text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Relação Risco/Retorno:</span>
                    <span className="font-mono">1:{getRR(selectedSignal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Score do Sinal:</span>
                    <span className={cn(
                      "font-bold",
                      (selectedSignal.quality?.score || 0) >= 80 ? "text-signal-buy" : "text-warning"
                    )}>{selectedSignal.quality?.score || 0}/100</span>
                  </div>
                </div>
                {selectedSignal.indicators && selectedSignal.indicators.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedSignal.indicators.map((ind, i) => (
                      <span key={i} className="text-[10px] px-2.5 py-0.5 rounded-full border bg-primary/10 border-primary/20 text-primary font-medium">
                        {ind}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline" onClick={() => setSelectedSignal(null)}>Fechar</Button>
                <Button
                  className={cn(
                    "w-full sm:w-auto text-white",
                    selectedSignal.type === 'LONG' ? "bg-signal-buy hover:bg-signal-buy/90" : "bg-signal-sell hover:bg-signal-sell/90"
                  )}
                  onClick={() => {
                    setExecuteSignal(selectedSignal);
                    setExecuteModalOpen(true);
                    setSelectedSignal(null);
                  }}
                >
                  Executar Manualmente (Paper)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Execute Trade Modal */}
      <ExecuteTradeModal
        open={executeModalOpen}
        onClose={() => { setExecuteModalOpen(false); setExecuteSignal(null); }}
        signal={executeSignal ? {
          id: executeSignal.id,
          symbol: executeSignal.symbol || executeSignal.pair,
          direction: executeSignal.type.toLowerCase() as 'long' | 'short',
          currentPrice: (executeSignal as any).currentPrice || executeSignal.entry,
          entryZone: {
            min: (executeSignal as any).entryZone?.low ?? (executeSignal.entry * 0.998),
            max: (executeSignal as any).entryZone?.high ?? (executeSignal.entry * 1.002),
          },
          stopLoss: {
            price: executeSignal.stopLoss,
            percent: (executeSignal as any).stopLossPercent ?? Math.abs((executeSignal.stopLoss - executeSignal.entry) / executeSignal.entry * 100),
          },
          takeProfits: [
            { level: 1, price: executeSignal.takeProfit1 || executeSignal.takeProfit, percent: Math.abs(((executeSignal.takeProfit1 || executeSignal.takeProfit) - executeSignal.entry) / executeSignal.entry * 100) },
            ...(executeSignal.takeProfit2 ? [{ level: 2, price: executeSignal.takeProfit2, percent: Math.abs((executeSignal.takeProfit2 - executeSignal.entry) / executeSignal.entry * 100) }] : []),
          ],
          leverage: executeSignal.leverage || 5,
          riskPercent: executeSignal.riskPercent || 2,
          riskReward: parseFloat(getRR(executeSignal)),
          quality: executeSignal.quality,
          confidence: executeSignal.confidence || 0,
        } : null}
      />
    </div>
  );
}
