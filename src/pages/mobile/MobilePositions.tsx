import { useMobileDashboard } from '@/hooks/useMobileDashboard';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { useSignalHistory } from '@/hooks/useSignalHistory';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { formatCurrency } from '@/utils/formatters';
import { TrendingUp, TrendingDown, DollarSign, Activity, Target, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';

const MobilePositions = () => {
  const { portfolioSummary } = useMobileDashboard();
  const { data: cryptoPairs = [] } = useCryptoPrices();

  // Fetch active signals (the real "open positions" from the bot)
  const { data: activeData, isLoading } = useSignalHistory({
    page: 1,
    limit: 50,
    status: 'ACTIVE',
  });

  const activeSignals = activeData?.signals ?? [];

  const pnlPositive = portfolioSummary.totalPnL >= 0;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader />
      <div className="flex flex-col gap-4 px-3 pt-3 pb-24">

        {/* PnL Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border/40 rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <DollarSign className="w-3.5 h-3.5" />
              Patrimônio simulado
            </div>
            <p className="text-xl font-bold font-mono text-foreground">
              ${portfolioSummary.totalValue.toFixed(2)}
            </p>
          </div>

          <div className={cn(
            "border rounded-xl p-4 space-y-1",
            pnlPositive ? "bg-signal-buy/10 border-signal-buy/30" : "bg-signal-sell/10 border-signal-sell/30"
          )}>
            <div className={cn("flex items-center gap-1.5 text-xs", pnlPositive ? "text-signal-buy" : "text-signal-sell")}>
              {pnlPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              PnL Total
            </div>
            <p className={cn("text-xl font-bold font-mono", pnlPositive ? "text-signal-buy" : "text-signal-sell")}>
              {pnlPositive ? '+' : ''}${portfolioSummary.totalPnL.toFixed(2)}
            </p>
            <p className={cn("text-xs font-medium", pnlPositive ? "text-signal-buy/70" : "text-signal-sell/70")}>
              {pnlPositive ? '+' : ''}{portfolioSummary.totalPnLPercent.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Today's PnL */}
        <div className="bg-card border border-border/40 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="w-4 h-4" />
            <span className="text-sm">PnL Hoje</span>
          </div>
          <span className={cn(
            "font-bold font-mono text-base",
            portfolioSummary.pnlToday >= 0 ? "text-signal-buy" : "text-signal-sell"
          )}>
            {portfolioSummary.pnlToday >= 0 ? '+' : ''}${portfolioSummary.pnlToday.toFixed(2)}
          </span>
        </div>

        {/* Active Signal Positions */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary" />
            Sinais Ativos ({activeSignals.length})
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm">Carregando posições...</span>
            </div>
          ) : activeSignals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground bg-card border border-border/40 rounded-xl">
              <Target className="w-10 h-10 opacity-20" />
              <p className="text-sm">Nenhum sinal ativo no momento</p>
              <p className="text-xs text-muted-foreground/60">Os sinais abertos aparecerão aqui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSignals.map(signal => {
                const isLong = (signal.type as string).toUpperCase() === 'LONG';
                const currentPair = cryptoPairs.find(p => p.symbol === signal.pair);
                const currentPrice = currentPair?.price ?? signal.entry;
                const tp = signal.takeProfit1 ?? signal.takeProfit;
                const sl = signal.stopLoss;
                const range = Math.abs(tp - sl);
                const rawPct = range > 0 ? ((currentPrice - sl) / range) * 100 : 50;
                const pct = Math.min(100, Math.max(0, rawPct));
                const entryPct = range > 0 ? Math.min(100, Math.max(0, ((signal.entry - sl) / range) * 100)) : 50;

                // Unrealized PnL direction
                const inProfit = isLong ? currentPrice > signal.entry : currentPrice < signal.entry;
                const pnlPct = ((currentPrice - signal.entry) / signal.entry * 100) * (isLong ? 1 : -1);

                return (
                  <div
                    key={signal.id}
                    className={cn(
                      "bg-card border border-border/40 border-l-4 rounded-xl p-4 space-y-3 shadow-sm",
                      isLong ? "border-l-signal-buy" : "border-l-signal-sell"
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground">{signal.pair}</span>
                        <Badge className={cn(
                          "text-[10px] font-bold",
                          isLong ? "bg-signal-buy text-white" : "bg-signal-sell text-white"
                        )}>
                          {isLong ? '▲ LONG' : '▼ SHORT'}
                        </Badge>
                      </div>
                      <span className={cn(
                        "text-sm font-bold font-mono",
                        inProfit ? "text-signal-buy" : "text-signal-sell"
                      )}>
                        {inProfit ? '+' : ''}{pnlPct.toFixed(2)}%
                      </span>
                    </div>

                    {/* Price grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center bg-muted/30 rounded-lg p-2">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Entrada</p>
                        <p className="text-xs font-mono font-bold text-foreground">{formatCurrency(signal.entry)}</p>
                      </div>
                      <div className="text-center bg-muted/20 rounded-lg p-2">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Atual</p>
                        <p className={cn("text-xs font-mono font-bold", inProfit ? "text-signal-buy" : "text-signal-sell")}>
                          {formatCurrency(currentPrice)}
                        </p>
                      </div>
                      <div className="text-center bg-signal-sell/10 rounded-lg p-2">
                        <p className="text-[9px] text-signal-sell uppercase tracking-wide mb-0.5">SL</p>
                        <p className="text-xs font-mono font-bold text-signal-sell">{formatCurrency(sl)}</p>
                      </div>
                    </div>

                    {/* Progress bar SL → TP */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="text-signal-sell font-medium">SL</span>
                        <span className="font-mono">{formatCurrency(currentPrice)}</span>
                        <span className={cn("font-medium", isLong ? "text-signal-buy" : "text-signal-sell")}>TP</span>
                      </div>
                      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                        {/* Entry marker */}
                        <div className="absolute top-0 h-full w-0.5 bg-primary/70 z-10" style={{ left: `${entryPct}%` }} />
                        {/* Progress fill */}
                        <div
                          className={cn("h-full rounded-full transition-all duration-500",
                            pct > entryPct
                              ? (isLong ? "bg-signal-buy/70" : "bg-signal-sell/70")
                              : "bg-muted-foreground/40"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                        {/* Current dot */}
                        <div
                          className={cn("absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ring-2 ring-card -translate-x-1/2",
                            isLong ? "bg-signal-buy" : "bg-signal-sell"
                          )}
                          style={{ left: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* TP + Score footer */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="text-signal-buy font-mono font-medium">TP {formatCurrency(tp)}</span>
                      {signal.quality?.score != null && (
                        <span className={cn("font-bold", signal.quality.score >= 80 ? "text-signal-buy" : "text-warning")}>
                          ⚡ {signal.quality.score}/100
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobilePositions;
