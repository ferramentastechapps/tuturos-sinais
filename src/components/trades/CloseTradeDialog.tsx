import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { TradeWithMetrics } from '@/types/trades';

interface CloseTradeDialogProps {
  trade: TradeWithMetrics | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: (id: string, exitPrice: number) => void;
}

export const CloseTradeDialog = ({ trade, open, onOpenChange, onClose }: CloseTradeDialogProps) => {
  const [exitPrice, setExitPrice] = useState('');
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!trade) return;

    const price = parseFloat(exitPrice);
    if (isNaN(price) || price <= 0) {
      toast({
        title: 'Preço inválido',
        description: 'Informe um preço de saída válido.',
        variant: 'destructive',
      });
      return;
    }

    onClose(trade.id, price);
    onOpenChange(false);
    setExitPrice('');
    
    toast({
      title: 'Operação fechada',
      description: `${trade.symbol} fechado a $${price.toFixed(2)}`,
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && trade) {
      setExitPrice(trade.currentPrice.toString());
    }
    onOpenChange(newOpen);
  };

  if (!trade) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar Operação - {trade.symbol}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Tipo:</span>
              <span className="ml-2 font-medium">
                {trade.type === 'buy' ? 'Compra' : 'Venda'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Quantidade:</span>
              <span className="ml-2 font-medium">{trade.quantity}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Entrada:</span>
              <span className="ml-2 font-medium">${trade.entryPrice.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Preço Atual:</span>
              <span className="ml-2 font-medium">${trade.currentPrice.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Preço de Saída ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            Fechar Operação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
