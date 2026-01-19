import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { useToast } from '@/hooks/use-toast';

interface AddAssetDialogProps {
  onAdd: (symbol: string, quantity: number, buyPrice: number) => void;
}

export const AddAssetDialog = ({ onAdd }: AddAssetDialogProps) => {
  const { data: cryptoPairs = [] } = useCryptoPrices();
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const { toast } = useToast();

  const handleSelectPair = (value: string) => {
    setSymbol(value);
    const pair = cryptoPairs.find(p => p.symbol === value);
    if (pair) {
      setBuyPrice(pair.price.toString());
    }
  };

  const handleSubmit = () => {
    if (!symbol || !quantity || !buyPrice) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos antes de adicionar.',
        variant: 'destructive',
      });
      return;
    }

    const qty = parseFloat(quantity);
    const price = parseFloat(buyPrice);

    if (isNaN(qty) || qty <= 0) {
      toast({
        title: 'Quantidade inválida',
        description: 'A quantidade deve ser um número positivo.',
        variant: 'destructive',
      });
      return;
    }

    if (isNaN(price) || price <= 0) {
      toast({
        title: 'Preço inválido',
        description: 'O preço deve ser um número positivo.',
        variant: 'destructive',
      });
      return;
    }

    onAdd(symbol, qty, price);
    toast({
      title: 'Ativo adicionado',
      description: `${qty} ${symbol} foi adicionado ao seu portfólio.`,
    });

    // Reset form
    setSymbol('');
    setQuantity('');
    setBuyPrice('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Ativo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Ativo ao Portfólio</DialogTitle>
          <DialogDescription>
            Selecione um par de criptomoeda e informe a quantidade e preço médio de compra.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="symbol">Par</Label>
            <Select value={symbol} onValueChange={handleSelectPair}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um par" />
              </SelectTrigger>
              <SelectContent>
                {cryptoPairs.map(pair => (
                  <SelectItem key={pair.symbol} value={pair.symbol}>
                    {pair.symbol} - {pair.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantidade</Label>
            <Input
              id="quantity"
              type="number"
              step="any"
              min="0"
              placeholder="Ex: 0.5"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="buyPrice">Preço Médio de Compra ($)</Label>
            <Input
              id="buyPrice"
              type="number"
              step="any"
              min="0"
              placeholder="Ex: 67000"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
