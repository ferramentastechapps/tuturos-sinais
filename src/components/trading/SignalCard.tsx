import { TradeSignal } from '@/types/trading';
import { ArrowUpRight, ArrowDownRight, Target, ShieldX, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SignalCardProps {
  signal: TradeSignal;
}

export const SignalCard = ({ signal }: SignalCardProps) => {
  const isLong = signal.type === 'long';
  const isActive = signal.status === 'active';

  const getStatusBadge = () => {
    switch (signal.status) {
      case 'active':
        return <Badge className="bg-primary/20 text-primary border-primary/30">Ativo</Badge>;
      case 'hit_tp':
        return <Badge className="bg-success/20 text-success border-success/30">TP Atingido</Badge>;
      case 'hit_sl':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">SL Atingido</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelado</Badge>;
    }
  };

  return (
    <div
      className={cn(
        'trading-card transition-all duration-200',
        isActive && (isLong ? 'border-success/30 glow-bullish' : 'border-destructive/30 glow-bearish')
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              isLong ? 'bg-success/20' : 'bg-destructive/20'
            )}
          >
            {isLong ? (
              <ArrowUpRight className="w-6 h-6 text-success" />
            ) : (
              <ArrowDownRight className="w-6 h-6 text-destructive" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-foreground">{signal.pair}</h3>
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-bold',
                  isLong ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                )}
              >
                {signal.type.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{signal.timeframe}</span>
            </div>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Price Levels */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="p-2 rounded-lg bg-secondary/50">
          <p className="text-xs text-muted-foreground mb-1">Entrada</p>
          <p className="text-sm font-mono font-semibold text-foreground">
            ${signal.entry.toLocaleString()}
          </p>
        </div>
        <div className="p-2 rounded-lg bg-success/10">
          <div className="flex items-center gap-1 mb-1">
            <Target className="w-3 h-3 text-success" />
            <p className="text-xs text-success">Take Profit</p>
          </div>
          <p className="text-sm font-mono font-semibold text-success">
            ${signal.takeProfit.toLocaleString()}
          </p>
        </div>
        <div className="p-2 rounded-lg bg-destructive/10">
          <div className="flex items-center gap-1 mb-1">
            <ShieldX className="w-3 h-3 text-destructive" />
            <p className="text-xs text-destructive">Stop Loss</p>
          </div>
          <p className="text-sm font-mono font-semibold text-destructive">
            ${signal.stopLoss.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Risk Reward */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 mb-3">
        <span className="text-sm text-muted-foreground">Risco/Retorno</span>
        <span className="text-sm font-bold text-primary">1:{signal.riskReward.toFixed(2)}</span>
      </div>

      {/* Confidence Score */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-warning" />
            <span className="text-xs text-muted-foreground">Confiança IA</span>
          </div>
          <span className="text-sm font-bold text-foreground">{signal.confidence}%</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              signal.confidence >= 70 ? 'bg-success' : signal.confidence >= 50 ? 'bg-warning' : 'bg-destructive'
            )}
            style={{ width: `${signal.confidence}%` }}
          />
        </div>
      </div>

      {/* Indicators */}
      <div className="flex flex-wrap gap-1">
        {signal.indicators.map((indicator, index) => (
          <span
            key={index}
            className="px-2 py-0.5 rounded text-xs bg-secondary text-secondary-foreground"
          >
            {indicator}
          </span>
        ))}
      </div>
    </div>
  );
};
