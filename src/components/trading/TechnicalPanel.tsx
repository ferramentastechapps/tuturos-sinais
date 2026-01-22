import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTechnicalIndicators } from '@/hooks/useTechnicalIndicators';
import { Skeleton } from '@/components/ui/skeleton';

interface TechnicalPanelProps {
  symbol?: string;
}

export const TechnicalPanel = ({ symbol = 'BTCUSDT' }: TechnicalPanelProps) => {
  const { data: technicalIndicators, isLoading } = useTechnicalIndicators(symbol);

  if (isLoading || !technicalIndicators) {
    return (
      <div className="trading-card h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Análise Técnica</h2>
          </div>
          <span className="text-xs text-muted-foreground">{symbol}</span>
        </div>
        <div className="space-y-3">
          <Skeleton className="w-full h-20" />
          <Skeleton className="w-full h-12" />
          <Skeleton className="w-full h-32" />
        </div>
      </div>
    );
  }
  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case 'bullish':
        return <TrendingUp className="w-4 h-4 text-success" />;
      case 'bearish':
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-neutral" />;
    }
  };

  const getSignalBg = (signal: string) => {
    switch (signal) {
      case 'bullish':
        return 'bg-success/10 border-success/20 text-success';
      case 'bearish':
        return 'bg-destructive/10 border-destructive/20 text-destructive';
      default:
        return 'bg-muted border-muted-foreground/20 text-muted-foreground';
    }
  };

  const bullishCount = technicalIndicators?.filter(i => i.signal === 'bullish').length || 0;
  const bearishCount = technicalIndicators?.filter(i => i.signal === 'bearish').length || 0;
  const neutralCount = technicalIndicators?.filter(i => i.signal === 'neutral').length || 0;
  
  const overallTrend = bullishCount > bearishCount ? 'bullish' : bearishCount > bullishCount ? 'bearish' : 'neutral';

  return (
    <div className="trading-card h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Análise Técnica</h2>
        </div>
        <span className="text-xs text-muted-foreground">{symbol}</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 rounded-lg bg-success/10">
          <p className="text-xl font-bold text-success">{bullishCount}</p>
          <p className="text-xs text-success/80">Compra</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted">
          <p className="text-xl font-bold text-muted-foreground">{neutralCount}</p>
          <p className="text-xs text-muted-foreground">Neutro</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-destructive/10">
          <p className="text-xl font-bold text-destructive">{bearishCount}</p>
          <p className="text-xs text-destructive/80">Venda</p>
        </div>
      </div>

      {/* Trend */}
      <div className={cn(
        "flex items-center justify-center gap-2 p-3 mb-4 rounded-lg border",
        overallTrend === 'bullish' && "bg-success/10 border-success/20",
        overallTrend === 'bearish' && "bg-destructive/10 border-destructive/20",
        overallTrend === 'neutral' && "bg-muted border-muted-foreground/20"
      )}>
        {overallTrend === 'bullish' && <TrendingUp className="w-5 h-5 text-success" />}
        {overallTrend === 'bearish' && <TrendingDown className="w-5 h-5 text-destructive" />}
        {overallTrend === 'neutral' && <Minus className="w-5 h-5 text-muted-foreground" />}
        <span className={cn(
          "font-semibold",
          overallTrend === 'bullish' && "text-success",
          overallTrend === 'bearish' && "text-destructive",
          overallTrend === 'neutral' && "text-muted-foreground"
        )}>
          {overallTrend === 'bullish' ? 'Tendência de Alta' : overallTrend === 'bearish' ? 'Tendência de Baixa' : 'Tendência Lateral'}
        </span>
      </div>

      {/* Indicators List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {technicalIndicators.map((indicator, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <div className="flex items-center gap-2">
              {getSignalIcon(indicator.signal)}
              <div>
                <p className="text-sm font-medium text-foreground">{indicator.name}</p>
                <p className="text-xs text-muted-foreground">{indicator.description}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono text-foreground">
                {typeof indicator.value === 'number' && indicator.value > 100
                  ? indicator.value.toLocaleString()
                  : indicator.value}
              </p>
              <span
                className={cn(
                  'indicator-badge border',
                  getSignalBg(indicator.signal)
                )}
              >
                {indicator.signal === 'bullish' ? 'COMPRA' : indicator.signal === 'bearish' ? 'VENDA' : 'NEUTRO'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
