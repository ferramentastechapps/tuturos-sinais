import { CryptoPair } from '@/types/trading';
import { Star, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceCardProps {
  pair: CryptoPair;
  isSelected?: boolean;
  onClick?: () => void;
}

export const PriceCard = ({ pair, isSelected, onClick }: PriceCardProps) => {
  const isPositive = pair.change24h >= 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'trading-card cursor-pointer transition-all duration-200 hover:border-primary/50 p-3 sm:p-4',
        isSelected && 'border-primary glow-primary'
      )}
    >
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-[10px] sm:text-xs font-bold text-primary">
              {pair.symbol.slice(0, 2)}
            </span>
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">{pair.symbol}</h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{pair.name}</p>
          </div>
        </div>
        {pair.isFavorite && (
          <Star className="w-3 h-3 sm:w-4 sm:h-4 text-warning fill-warning" />
        )}
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
          <span className="text-lg sm:text-2xl font-bold font-mono text-foreground">
            ${pair.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs sm:text-sm font-medium',
              isPositive ? 'text-success' : 'text-destructive'
            )}
          >
            {isPositive ? (
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
            ) : (
              <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />
            )}
            {isPositive ? '+' : ''}
            {pair.change24h.toFixed(2)}%
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1.5 sm:pt-2 border-t border-border">
          <div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">24h High</p>
            <p className="text-xs sm:text-sm font-mono text-success">
              ${pair.high24h.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">24h Low</p>
            <p className="text-xs sm:text-sm font-mono text-destructive">
              ${pair.low24h.toLocaleString()}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Volume 24h</p>
          <p className="text-xs sm:text-sm font-mono text-foreground">
            ${(pair.volume24h / 1e9).toFixed(2)}B
          </p>
        </div>
      </div>
    </div>
  );
};
