import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { useToast } from '@/hooks/use-toast';
import { TradeType } from '@/types/trades';

interface AddTradeDialogProps {
  onAdd: (symbol: string, type: TradeType, entryPrice: number, quantity: number) => void;
}

export const AddTradeDialog = ({ onAdd }: AddTradeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState<TradeType>('buy');
  const [entryPrice, setEntryPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const { data: pairs } = useCryptoPrices();
  const { toast } = useToast();

  const handleSelectPair = (value: string) => {
    setSymbol(value);
    const pair = pairs?.find(p => p.symbol === value);
    if (pair) {
      setEntryPrice(pair.price.toString());
    }
  };

  const handleSubmit = () => {
    if (!symbol || !entryPrice || !quantity) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos para registrar a operação.',
        variant: 'destructive',
      });
      return;
    }

    const qty = parseFloat(quantity);
    const price = parseFloat(entryPrice);

    if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
      toast({
        title: 'Valores inválidos',
        description: 'Quantidade e preço devem ser números positivos.',
        variant: 'destructive',
      });
      return;
    }

    onAdd(symbol, type, price, qty);
    setOpen(false);
    setSymbol('');
    setType('buy');
    setEntryPrice('');
    setQuantity('');
    
    toast({
      title: 'Operação registrada',
      description: `${type === 'buy' ? 'Compra' : 'Venda'} de ${qty} ${symbol} adicionada.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Operação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Operação</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Criptomoeda</Label>
            <Select value={symbol} onValueChange={handleSelectPair}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {pairs?.map(pair => (
                  <SelectItem key={pair.symbol} value={pair.symbol}>
                    {pair.symbol} - {pair.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Operação</Label>
            <Select value={type} onValueChange={(v) => setType(v as TradeType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">Compra (Long)</SelectItem>
                <SelectItem value="sell">Venda (Short)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Preço de Entrada ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label>Quantidade</Label>
            <Input
              type="number"
              step="0.0001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.0000"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
