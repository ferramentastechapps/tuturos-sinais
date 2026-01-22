import { useState, useMemo } from 'react';
import { Search, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CryptoPair } from '@/types/trading';
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

export const CoinSelector = ({ pairs, selectedPair, onSelect }: CoinSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPairs = useMemo(() => {
    if (!searchQuery) return pairs;
    
    const query = searchQuery.toLowerCase();
    return pairs.filter(
      pair =>
        pair.symbol.toLowerCase().includes(query) ||
        pair.name.toLowerCase().includes(query)
    );
  }, [pairs, searchQuery]);

  const handleSelect = (pair: CryptoPair) => {
    onSelect(pair);
    setOpen(false);
    setSearchQuery('');
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
              <p className="font-semibold text-foreground">{selectedPair?.symbol || 'Selecione'}</p>
              <p className="text-xs text-muted-foreground">{selectedPair?.name || 'Escolha uma moeda'}</p>
            </div>
          </div>
          <div className="text-right">
            {selectedPair && (
              <>
                <p className="font-mono font-semibold text-foreground">
                  ${selectedPair.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
            Escolha uma moeda para análise técnica e sinais de trading
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

        {/* Results */}
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {filteredPairs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma moeda encontrada</p>
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
                      </div>
                      <p className="text-xs text-muted-foreground">{pair.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold text-foreground">
                      ${pair.price.toLocaleString(undefined, { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: pair.price < 1 ? 4 : 2 
                      })}
                    </p>
                    <p className={cn(
                      'text-xs font-mono',
                      pair.change24h >= 0 ? 'text-success' : 'text-destructive'
                    )}>
                      {pair.change24h >= 0 ? '+' : ''}{pair.change24h.toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vol: ${(pair.volume24h / 1e9).toFixed(2)}B
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Stats */}
        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <span>{filteredPairs.length} moedas disponíveis</span>
          <span>
            {filteredPairs.filter(p => p.change24h >= 0).length} em alta • {' '}
            {filteredPairs.filter(p => p.change24h < 0).length} em baixa
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
