import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Star, Plus } from 'lucide-react';
import { CryptoPair } from '@/types/trading';

interface AddToWatchlistDialogProps {
  availableCoins: CryptoPair[];
  onAdd: (symbol: string, name: string, notes?: string, targetPrice?: number) => void;
  isInWatchlist: (symbol: string) => boolean;
  trigger?: React.ReactNode;
}

export const AddToWatchlistDialog = ({ 
  availableCoins, 
  onAdd, 
  isInWatchlist,
  trigger 
}: AddToWatchlistDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [notes, setNotes] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [enableAlert, setEnableAlert] = useState(false);

  const availableToAdd = availableCoins.filter(coin => !isInWatchlist(coin.symbol));
  const selectedCoin = availableCoins.find(c => c.symbol === selectedSymbol);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSymbol || !selectedCoin) return;

    onAdd(
      selectedSymbol,
      selectedCoin.name,
      notes || undefined,
      enableAlert && targetPrice ? parseFloat(targetPrice) : undefined
    );

    setSelectedSymbol('');
    setNotes('');
    setTargetPrice('');
    setEnableAlert(false);
    setOpen(false);
  };

  const resetForm = () => {
    setSelectedSymbol('');
    setNotes('');
    setTargetPrice('');
    setEnableAlert(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Adicionar à Watchlist
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="coin">Moeda</Label>
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma moeda" />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Todas as moedas já estão na watchlist
                  </SelectItem>
                ) : (
                  availableToAdd.map(coin => (
                    <SelectItem key={coin.symbol} value={coin.symbol}>
                      {coin.name} ({coin.symbol})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Ex: Aguardando correção para comprar..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="alert">Ativar alerta de preço</Label>
            <Switch
              id="alert"
              checked={enableAlert}
              onCheckedChange={setEnableAlert}
            />
          </div>

          {enableAlert && (
            <div className="space-y-2">
              <Label htmlFor="targetPrice">Preço alvo (USD)</Label>
              <Input
                id="targetPrice"
                type="number"
                step="0.01"
                placeholder="Ex: 50000"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
              />
              {selectedCoin && (
                <p className="text-xs text-muted-foreground">
                  Preço atual: ${selectedCoin.price.toLocaleString()}
                </p>
              )}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full"
            disabled={!selectedSymbol || availableToAdd.length === 0}
          >
            <Star className="h-4 w-4 mr-2" />
            Adicionar à Watchlist
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
