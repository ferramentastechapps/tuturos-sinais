import { Gauge, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarketSentiment } from '@/hooks/useMarketSentiment';
import { Skeleton } from '@/components/ui/skeleton';

export const SentimentGauge = () => {
  const { data: marketSentiment, isLoading } = useMarketSentiment();
  
  if (isLoading || !marketSentiment) {
    return (
      <div className="trading-card">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Sentimento</h2>
        </div>
        <div className="flex flex-col items-center space-y-3">
          <Skeleton className="w-32 h-16" />
          <Skeleton className="w-20 h-10" />
          <Skeleton className="w-32 h-8" />
        </div>
      </div>
    );
  }

  const { fearGreedIndex, sentiment, trend } = marketSentiment;

  const getSentimentLabel = () => {
    switch (sentiment) {
      case 'extreme_fear':
        return 'Medo Extremo';
      case 'fear':
        return 'Medo';
      case 'neutral':
        return 'Neutro';
      case 'greed':
        return 'Ganância';
      case 'extreme_greed':
        return 'Ganância Extrema';
    }
  };

  const getSentimentColor = () => {
    if (fearGreedIndex <= 25) return 'text-destructive';
    if (fearGreedIndex <= 45) return 'text-warning';
    if (fearGreedIndex <= 55) return 'text-muted-foreground';
    if (fearGreedIndex <= 75) return 'text-success';
    return 'text-success';
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'bullish':
        return <TrendingUp className="w-4 h-4 text-success" />;
      case 'bearish':
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="trading-card">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Sentimento</h2>
      </div>

      <div className="flex flex-col items-center">
        {/* Gauge Visual */}
        <div className="relative w-32 h-16 mb-3">
          <svg viewBox="0 0 100 50" className="w-full h-full">
            {/* Background arc */}
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Colored arc based on value */}
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(fearGreedIndex / 100) * 125.6} 125.6`}
            />
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--destructive))" />
                <stop offset="50%" stopColor="hsl(var(--warning))" />
                <stop offset="100%" stopColor="hsl(var(--success))" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Value */}
        <div className="text-center">
          <p className={cn('text-4xl font-bold font-mono', getSentimentColor())}>
            {fearGreedIndex}
          </p>
          <p className={cn('text-sm font-medium', getSentimentColor())}>
            {getSentimentLabel()}
          </p>
        </div>

        {/* Trend */}
        <div className="flex items-center gap-2 mt-3 px-3 py-1.5 rounded-lg bg-secondary">
          {getTrendIcon()}
          <span className="text-sm text-foreground capitalize">
            Tendência {trend === 'bullish' ? 'Alta' : trend === 'bearish' ? 'Baixa' : 'Lateral'}
          </span>
        </div>
      </div>
    </div>
  );
};
