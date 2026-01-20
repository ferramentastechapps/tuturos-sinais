import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { Transaction } from '@/types/transactions';

interface AddTransactionDialogProps {
  onAdd: (
    assetId: string,
    symbol: string,
    name: string,
    type: Transaction['type'],
    quantity: number,
    price: number,
    fee: number,
    feeAsset: string,
    notes?: string,
    exchange?: string
  ) => void;
}

export const AddTransactionDialog = ({ onAdd }: AddTransactionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<Transaction['type']>('buy');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('0');
  const [feeAsset, setFeeAsset] = useState('USDT');
  const [exchange, setExchange] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const qty = parseFloat(quantity);
    const prc = parseFloat(price);
    const feeVal = parseFloat(fee);

    if (!symbol || !name || isNaN(qty) || isNaN(prc) || qty <= 0 || prc <= 0) {
      return;
    }

    onAdd(
      crypto.randomUUID(),
      symbol.toUpperCase(),
      name,
      type,
      qty,
      prc,
      feeVal,
      feeAsset,
      notes || undefined,
      exchange || undefined
    );

    // Reset form
    setSymbol('');
    setName('');
    setQuantity('');
    setPrice('');
    setFee('0');
    setFeeAsset('USDT');
    setExchange('');
    setNotes('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova Transação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Transação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as Transaction['type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">Compra</SelectItem>
                <SelectItem value="sell">Venda</SelectItem>
                <SelectItem value="transfer_in">Transferência Entrada</SelectItem>
                <SelectItem value="transfer_out">Transferência Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol">Símbolo</Label>
              <Input
                id="symbol"
                placeholder="BTC"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                placeholder="Bitcoin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                placeholder="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Preço (USD)</Label>
              <Input
                id="price"
                type="number"
                step="any"
                placeholder="67000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fee">Taxa</Label>
              <Input
                id="fee"
                type="number"
                step="any"
                placeholder="0"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feeAsset">Moeda da Taxa</Label>
              <Input
                id="feeAsset"
                placeholder="USDT"
                value={feeAsset}
                onChange={(e) => setFeeAsset(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exchange">Exchange (opcional)</Label>
            <Input
              id="exchange"
              placeholder="Binance, Coinbase, etc."
              value={exchange}
              onChange={(e) => setExchange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Observações sobre esta transação..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Adicionar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
