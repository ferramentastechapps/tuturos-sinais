import { useState } from 'react';
import { Bell, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CryptoPair } from '@/types/trading';
import { AlertCondition, PriceAlertFormData } from '@/types/priceAlerts';

interface AddPriceAlertDialogProps {
  pairs: CryptoPair[];
  onAdd: (data: PriceAlertFormData) => void;
  defaultSymbol?: string;
}

export function AddPriceAlertDialog({ pairs, onAdd, defaultSymbol }: AddPriceAlertDialogProps) {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState(defaultSymbol || '');
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState<AlertCondition>('above');

  const selectedPair = pairs.find(p => p.symbol === symbol);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!symbol || !targetPrice || !selectedPair) return;

    onAdd({
      symbol,
      name: selectedPair.name,
      targetPrice: parseFloat(targetPrice),
      condition,
    });

    setOpen(false);
    setSymbol(defaultSymbol || '');
    setTargetPrice('');
    setCondition('above');
  };

  const setCurrentPrice = () => {
    if (selectedPair) {
      setTargetPrice(selectedPair.price.toString());
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bell className="h-4 w-4" />
          Criar Alerta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Novo Alerta de Preço
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="symbol">Criptomoeda</Label>
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {pairs.map(pair => (
                  <SelectItem key={pair.symbol} value={pair.symbol}>
                    <span className="flex items-center gap-2">
                      <span>{pair.symbol}</span>
                      <span className="text-muted-foreground text-sm">
                        ${pair.price.toLocaleString()}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="condition">Condição</Label>
            <Select value={condition} onValueChange={(v) => setCondition(v as AlertCondition)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="above">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    Preço subir acima de
                  </span>
                </SelectItem>
                <SelectItem value="below">
                  <span className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    Preço cair abaixo de
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetPrice">Preço Alvo (USD)</Label>
            <div className="flex gap-2">
              <Input
                id="targetPrice"
                type="number"
                step="any"
                placeholder="0.00"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="flex-1"
              />
              {selectedPair && (
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm"
                  onClick={setCurrentPrice}
                >
                  Atual
                </Button>
              )}
            </div>
            {selectedPair && (
              <p className="text-sm text-muted-foreground">
                Preço atual: ${selectedPair.price.toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!symbol || !targetPrice}
              className="gap-2"
            >
              <Bell className="h-4 w-4" />
              Criar Alerta
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
