import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

interface MarketTickerProps {
  onSelectPair?: (symbol: string) => void;
}

export const MarketTicker = ({ onSelectPair }: MarketTickerProps) => {
  const { data: cryptoPairs = [], isLoading } = useCryptoPrices();
  const duplicatedPairs = [...cryptoPairs, ...cryptoPairs];

  if (isLoading || cryptoPairs.length === 0) {
    return (
      <div className="h-10 bg-secondary/30 border-b border-border flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando preços...</span>
      </div>
    );
  }

  return (
    <div className="h-8 sm:h-10 bg-secondary/30 border-b border-border overflow-hidden group">
      <div className="flex items-center h-full animate-ticker whitespace-nowrap group-hover:[animation-play-state:paused]">
        {duplicatedPairs.map((pair, index) => (
          <button
            key={`${pair.symbol}-${index}`}
            onClick={() => onSelectPair?.(pair.symbol)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 border-r border-border/50 hover:bg-muted/50 transition-colors h-full outline-none focus-visible:bg-muted/50"
          >
            <span className="text-xs sm:text-sm font-medium text-foreground">{pair.symbol}</span>
            <span className="text-xs sm:text-sm font-mono text-foreground">
              ${pair.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span
              className={`flex items-center gap-0.5 text-[10px] sm:text-xs font-medium ${pair.change24h >= 0 ? 'text-success' : 'text-destructive'
                }`}
            >
              {pair.change24h >= 0 ? (
                <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              )}
              {pair.change24h >= 0 ? '+' : ''}
              {pair.change24h.toFixed(2)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
