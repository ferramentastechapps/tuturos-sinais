import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, X, TrendingUp, TrendingDown } from 'lucide-react';
import { TradeWithMetrics } from '@/types/trades';
import { CloseTradeDialog } from './CloseTradeDialog';
import { TableFilters } from '@/components/common/TableFilters';
import { useTableFilters } from '@/hooks/useTableFilters';
import { format } from 'date-fns';

interface TradesTableProps {
  trades: TradeWithMetrics[];
  onClose: (id: string, exitPrice: number, exitFee?: number) => void;
  onDelete: (id: string) => void;
}

export const TradesTable = ({ trades, onClose, onDelete }: TradesTableProps) => {
  const [selectedTrade, setSelectedTrade] = useState<TradeWithMetrics | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const {
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    filterBy,
    setFilterBy,
    filteredAndSortedData,
    clearFilters,
  } = useTableFilters({
    data: trades,
    searchFields: ['symbol', 'name'],
    defaultSortBy: 'date-desc',
    sortFunctions: {
      'date-desc': (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      'date-asc': (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      'pnl-desc': (a, b) => b.pnl - a.pnl,
      'pnl-asc': (a, b) => a.pnl - b.pnl,
      'symbol': (a, b) => a.symbol.localeCompare(b.symbol),
    },
    filterFunction: (trade, filter) => {
      if (filter === 'open') return trade.status === 'open';
      if (filter === 'closed') return trade.status === 'closed';
      if (filter === 'long') return trade.type === 'buy';
      if (filter === 'short') return trade.type === 'sell';
      if (filter === 'profit') return trade.pnl > 0;
      if (filter === 'loss') return trade.pnl < 0;
      return true;
    },
  });

  const handleCloseClick = (trade: TradeWithMetrics) => {
    setSelectedTrade(trade);
    setCloseDialogOpen(true);
  };

  if (trades.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Operações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhuma operação registrada ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Histórico de Operações ({filteredAndSortedData.length}/{trades.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TableFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            sortBy={sortBy}
            onSortChange={setSortBy}
            sortOptions={[
              { value: 'date-desc', label: 'Mais recentes' },
              { value: 'date-asc', label: 'Mais antigas' },
              { value: 'pnl-desc', label: 'Maior P&L' },
              { value: 'pnl-asc', label: 'Menor P&L' },
              { value: 'symbol', label: 'Ativo (A-Z)' },
            ]}
            filterBy={filterBy}
            onFilterChange={setFilterBy}
            filterOptions={[
              { value: 'all', label: 'Todas' },
              { value: 'open', label: 'Abertas' },
              { value: 'closed', label: 'Fechadas' },
              { value: 'long', label: 'Long' },
              { value: 'short', label: 'Short' },
              { value: 'profit', label: 'Lucro' },
              { value: 'loss', label: 'Prejuízo' },
            ]}
            onClearFilters={clearFilters}
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ativo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Entrada</TableHead>
                  <TableHead className="text-right">Atual/Saída</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nenhuma operação encontrada com os filtros aplicados
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedData.map(trade => (
                    <TableRow key={trade.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{trade.symbol}</div>
                          <div className="text-xs text-muted-foreground">{trade.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={trade.type === 'buy' ? 'default' : 'destructive'} className="gap-1">
                          {trade.type === 'buy' ? (
                            <><TrendingUp className="h-3 w-3" /> Long</>
                          ) : (
                            <><TrendingDown className="h-3 w-3" /> Short</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${trade.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${trade.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {trade.quantity}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-medium ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        <div>
                          {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs">
                          ({trade.pnlPercentage >= 0 ? '+' : ''}{trade.pnlPercentage.toFixed(2)}%)
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={trade.status === 'open' ? 'outline' : 'secondary'}>
                          {trade.status === 'open' ? 'Aberta' : 'Fechada'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(trade.createdAt, 'dd/MM/yy HH:mm')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {trade.status === 'open' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleCloseClick(trade)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => onDelete(trade.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CloseTradeDialog
        trade={selectedTrade}
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        onClose={onClose}
      />
    </>
  );
};
