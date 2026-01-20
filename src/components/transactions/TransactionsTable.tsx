import { Transaction } from '@/types/transactions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Trash2, ArrowUpRight, ArrowDownRight, ArrowRightLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TransactionsTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}

export const TransactionsTable = ({ transactions, onDelete }: TransactionsTableProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getTypeIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'buy':
        return <ArrowDownRight className="h-4 w-4 text-success" />;
      case 'sell':
        return <ArrowUpRight className="h-4 w-4 text-destructive" />;
      case 'transfer_in':
        return <ArrowRightLeft className="h-4 w-4 text-blue-500" />;
      case 'transfer_out':
        return <ArrowRightLeft className="h-4 w-4 text-orange-500" />;
    }
  };

  const getTypeLabel = (type: Transaction['type']) => {
    const labels: Record<Transaction['type'], string> = {
      buy: 'Compra',
      sell: 'Venda',
      transfer_in: 'Entrada',
      transfer_out: 'Saída',
    };
    return labels[type];
  };

  const getTypeBadgeVariant = (type: Transaction['type']) => {
    switch (type) {
      case 'buy':
      case 'transfer_in':
        return 'default';
      case 'sell':
      case 'transfer_out':
        return 'secondary';
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Ativo</TableHead>
            <TableHead className="text-right">Quantidade</TableHead>
            <TableHead className="text-right">Preço</TableHead>
            <TableHead className="text-right">Taxa</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Exchange</TableHead>
            <TableHead>Notas</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                Nenhuma transação registrada
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="font-mono text-sm">
                  {formatDate(tx.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant={getTypeBadgeVariant(tx.type)} className="flex items-center gap-1 w-fit">
                    {getTypeIcon(tx.type)}
                    {getTypeLabel(tx.type)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-semibold">{tx.symbol}</p>
                    <p className="text-xs text-muted-foreground">{tx.name}</p>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {tx.quantity.toFixed(8)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(tx.price)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {tx.fee > 0 ? `${formatCurrency(tx.fee)} ${tx.feeAsset}` : '-'}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatCurrency(tx.total)}
                </TableCell>
                <TableCell>
                  {tx.exchange ? (
                    <Badge variant="outline">{tx.exchange}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                  {tx.notes || '-'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(tx.id)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
