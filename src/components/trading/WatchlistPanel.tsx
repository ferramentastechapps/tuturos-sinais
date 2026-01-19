import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Star, Trash2, Bell, BellOff, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { WatchlistItem } from '@/types/watchlist';
import { CryptoPair } from '@/types/trading';
import { AddToWatchlistDialog } from './AddToWatchlistDialog';
import { cn } from '@/lib/utils';

interface WatchlistPanelProps {
  items: WatchlistItem[];
  livePrices: CryptoPair[] | undefined;
  onRemove: (id: string) => void;
  onToggleAlert: (id: string) => void;
  onAdd: (symbol: string, name: string, notes?: string, targetPrice?: number) => void;
  isInWatchlist: (symbol: string) => boolean;
}

export const WatchlistPanel = ({
  items,
  livePrices,
  onRemove,
  onToggleAlert,
  onAdd,
  isInWatchlist,
}: WatchlistPanelProps) => {
  const getPrice = (symbol: string) => {
    return livePrices?.find(p => p.symbol === symbol);
  };

  const getTargetStatus = (item: WatchlistItem, currentPrice: number) => {
    if (!item.targetPrice) return null;
    const diff = ((currentPrice - item.targetPrice) / item.targetPrice) * 100;
    const isAbove = currentPrice >= item.targetPrice;
    return { diff, isAbove };
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
          Watchlist
        </CardTitle>
        <AddToWatchlistDialog
          availableCoins={livePrices || []}
          onAdd={onAdd}
          isInWatchlist={isInWatchlist}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Star className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Nenhuma moeda na watchlist</p>
            <p className="text-xs mt-1">Adicione moedas para acompanhar</p>
          </div>
        ) : (
          items.map(item => {
            const priceData = getPrice(item.symbol);
            const currentPrice = priceData?.price ?? 0;
            const change24h = priceData?.change24h ?? 0;
            const targetStatus = getTargetStatus(item, currentPrice);
            const isPositive = change24h >= 0;

            return (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-background/50 border border-border/30 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">
                        {item.symbol.slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.symbol}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold">
                      ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={cn(
                      "flex items-center gap-1 text-xs",
                      isPositive ? "text-green-500" : "text-red-500"
                    )}>
                      {isPositive ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {isPositive ? '+' : ''}{change24h.toFixed(2)}%
                    </div>
                  </div>

                  {item.targetPrice && (
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Target className="h-3 w-3" />
                        Alvo: ${item.targetPrice.toLocaleString()}
                      </div>
                      {targetStatus && (
                        <Badge
                          variant={targetStatus.isAbove ? "default" : "secondary"}
                          className={cn(
                            "text-xs mt-1",
                            targetStatus.isAbove 
                              ? "bg-green-500/20 text-green-500 hover:bg-green-500/30" 
                              : "bg-orange-500/20 text-orange-500 hover:bg-orange-500/30"
                          )}
                        >
                          {targetStatus.isAbove ? '✓ Atingido' : `${targetStatus.diff.toFixed(1)}%`}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {item.notes && (
                  <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                    {item.notes}
                  </p>
                )}

                {item.targetPrice && (
                  <div className="flex items-center justify-between pt-1 border-t border-border/30">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {item.alertEnabled ? (
                        <Bell className="h-3 w-3" />
                      ) : (
                        <BellOff className="h-3 w-3" />
                      )}
                      Alerta de preço
                    </span>
                    <Switch
                      checked={item.alertEnabled}
                      onCheckedChange={() => onToggleAlert(item.id)}
                      className="scale-75"
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
