import { TradeSignal } from '@/types/trading';
import { ArrowUpRight, ArrowDownRight, Target, ShieldX, Clock, Sparkles, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface SignalCardProps {
  signal: TradeSignal;
}

export const SignalCard = ({ signal }: SignalCardProps) => {
  const navigate = useNavigate();
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

      {/* Price Levels — Vertical rows to fit narrow panel */}
      <div className="space-y-1.5 mb-3 p-2.5 rounded-lg bg-secondary/30">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Entrada</span>
          <span className="text-sm font-mono font-semibold text-foreground">
            ${signal.entry.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Target className="w-3 h-3 text-success" />
            <span className="text-xs text-success">TP (Principal)</span>
          </div>
          <span className="text-sm font-mono font-semibold text-success">
            ${signal.takeProfit.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <ShieldX className="w-3 h-3 text-destructive" />
            <span className="text-xs text-destructive">Stop Loss</span>
          </div>
          <span className="text-sm font-mono font-semibold text-destructive">
            ${signal.stopLoss.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Multi-TP Levels — Vertical rows */}
      {signal.takeProfit1 && signal.takeProfit2 && signal.takeProfit3 && (
        <div className="space-y-1 mb-3 p-2 rounded-lg bg-success/5 border border-success/15">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-success/70 font-medium">TP1 (1.5R)</span>
            <span className="text-xs font-mono font-semibold text-success">${signal.takeProfit1.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-success font-medium">TP2 (2.5R)</span>
            <span className="text-xs font-mono font-bold text-success">${signal.takeProfit2.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-success/70 font-medium">TP3 (4R)</span>
            <span className="text-xs font-mono font-semibold text-success">${signal.takeProfit3.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Risk Reward */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 mb-3">
        <span className="text-sm text-muted-foreground">Risco/Retorno</span>
        <span className={cn(
          "text-sm font-bold",
          signal.riskReward >= 2.5 ? "text-success" : signal.riskReward >= 1.5 ? "text-primary" : "text-warning"
        )}>1:{signal.riskReward.toFixed(2)}</span>
      </div>

      {/* Quality Score & Confidence */}
      <div className="mb-3 space-y-2">
        {/* Quality Score */}
        {signal.quality && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Qualidade do Sinal</span>
              <span className={cn("text-xs font-bold",
                signal.quality.score >= 80 ? "text-success" :
                  signal.quality.score >= 60 ? "text-warning" : "text-muted-foreground"
              )}>{signal.quality.score}/100</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  signal.quality.score >= 80 ? 'bg-success' : signal.quality.score >= 60 ? 'bg-warning' : 'bg-muted-foreground'
                )}
                style={{ width: `${signal.quality.score}%` }}
              />
            </div>
          </div>
        )}

        {/* Confidence (Existing) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-xs text-muted-foreground">Confiança IA</span>
            </div>
            <span className="text-xs font-bold text-foreground">{signal.confidence}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                signal.confidence >= 70 ? 'bg-blue-500' : 'bg-blue-300'
              )}
              style={{ width: `${signal.confidence}%` }}
            />
          </div>
        </div>
      </div>

      {/* Smart Money Badges */}
      {signal.smartMoney && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {signal.smartMoney.orderBlocks.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/5">
              OB
            </Badge>
          )}
          {signal.smartMoney.fvgs.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-warning/40 text-warning bg-warning/5">
              FVG
            </Badge>
          )}
          {signal.smartMoney.liquidity.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-500 bg-purple-500/5">
              LIQ
            </Badge>
          )}
        </div>
      )}

      {/* Indicators/Factors Accordion */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Fatores de Confluência:</p>
        <div className="flex flex-wrap gap-1.5">
          {signal.quality?.factors.slice(0, 3).map((factor, index) => (
            <span
              key={index}
              className="px-2 py-0.5 rounded text-[10px] bg-secondary text-secondary-foreground border border-border/50"
            >
              {factor}
            </span>
          ))}
          {(signal.quality?.factors.length || 0) > 3 && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground">
              +{signal.quality!.factors.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Paper Trading CTA */}
      {isActive && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3 h-7 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          onClick={() => navigate('/paper-trading', { state: { signal } })}
        >
          <FileText className="h-3 w-3" />
          Simular Operação
        </Button>
      )}
    </div>
  );
};
