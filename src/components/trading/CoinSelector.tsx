import { useState, useMemo } from 'react';
import { Search, Star, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CryptoPair, AssetCategory } from '@/types/trading';
import { getCategoryStats, filterPairs } from '@/services/binanceAssetSync';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface CoinSelectorProps {
  pairs: CryptoPair[];
  selectedPair: CryptoPair | null;
  onSelect: (pair: CryptoPair) => void;
}

const CATEGORY_COLORS: Record<AssetCategory, string> = {
  layer1: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  layer2: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  defi: 'bg-green-500/20 text-green-400 border-green-500/30',
  exchange: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  meme: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  gaming: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  ai: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  infra: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  privacy: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  rwa: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  trending: 'bg-red-500/20 text-red-400 border-red-500/30',
  other: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

export const CoinSelector = ({ pairs, selectedPair, onSelect }: CoinSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<AssetCategory | null>(null);

  const categoryStats = useMemo(() => getCategoryStats(pairs), [pairs]);

  const filteredPairs = useMemo(() => {
    return filterPairs(pairs, {
      category: activeCategory || undefined,
      search: searchQuery || undefined,
    });
  }, [pairs, searchQuery, activeCategory]);

  const handleSelect = (pair: CryptoPair) => {
    onSelect(pair);
    setOpen(false);
    setSearchQuery('');
    setActiveCategory(null);
  };

  const formatPrice = (price: number): string => {
    if (price >= 1000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    if (price >= 0.01) return price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
    return price.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 8 });
  };

  const formatVolume = (vol: number): string => {
    if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `${(vol / 1e3).toFixed(0)}K`;
    return vol.toFixed(0);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between h-auto py-3 px-4"
        >
          <div className="flex items-center gap-3">
            {selectedPair?.isFavorite && (
              <Star className="w-4 h-4 fill-warning text-warning" />
            )}
            <div className="text-left">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground">{selectedPair?.symbol || 'Selecione'}</p>
                {selectedPair?.category && (
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded border font-medium',
                    CATEGORY_COLORS[selectedPair.category]
                  )}>
                    {selectedPair.category.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{selectedPair?.name || 'Escolha uma moeda'}</p>
            </div>
          </div>
          <div className="text-right">
            {selectedPair && (
              <>
                <p className="font-mono font-semibold text-foreground">
                  ${formatPrice(selectedPair.price)}
                </p>
                <p className={cn(
                  'text-xs font-mono',
                  selectedPair.change24h >= 0 ? 'text-success' : 'text-destructive'
                )}>
                  {selectedPair.change24h >= 0 ? '+' : ''}{selectedPair.change24h.toFixed(2)}%
                </p>
              </>
            )}
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Selecionar Criptomoeda</DialogTitle>
          <DialogDescription>
            {pairs.length} pares de futuros perpétuos disponíveis
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou símbolo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full border transition-colors font-medium',
              !activeCategory
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary/50 text-muted-foreground border-border hover:bg-secondary'
            )}
          >
            Todos ({pairs.length})
          </button>
          {categoryStats.map(({ category, label, count }) => (
            <button
              key={category}
              onClick={() => setActiveCategory(activeCategory === category ? null : category)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors font-medium',
                activeCategory === category
                  ? CATEGORY_COLORS[category]
                  : 'bg-secondary/50 text-muted-foreground border-border hover:bg-secondary'
              )}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {/* Results */}
        <ScrollArea className="h-[350px] pr-4">
          <div className="space-y-1.5">
            {filteredPairs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma moeda encontrada</p>
                <p className="text-xs mt-1">Tente ajustar os filtros ou busca</p>
              </div>
            ) : (
              filteredPairs.map((pair) => (
                <button
                  key={pair.symbol}
                  onClick={() => handleSelect(pair)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-lg border transition-colors',
                    'hover:bg-secondary hover:border-primary',
                    selectedPair?.symbol === pair.symbol && 'bg-secondary border-primary'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {pair.isFavorite && (
                      <Star className="w-4 h-4 fill-warning text-warning flex-shrink-0" />
                    )}
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{pair.symbol}</p>
                        {pair.change24h >= 0 ? (
                          <TrendingUp className="w-3 h-3 text-success" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-destructive" />
                        )}
                        {pair.category && (
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded border font-medium',
                            CATEGORY_COLORS[pair.category]
                          )}>
                            {pair.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{pair.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold text-foreground">
                      ${formatPrice(pair.price)}
                    </p>
                    <p className={cn(
                      'text-xs font-mono',
                      pair.change24h >= 0 ? 'text-success' : 'text-destructive'
                    )}>
                      {pair.change24h >= 0 ? '+' : ''}{pair.change24h.toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vol: ${formatVolume(pair.volume24h)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Stats */}
        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <span>{filteredPairs.length} moedas{activeCategory ? ` em ${activeCategory}` : ''}</span>
          <span>
            {filteredPairs.filter(p => p.change24h >= 0).length} em alta • {' '}
            {filteredPairs.filter(p => p.change24h < 0).length} em baixa
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
