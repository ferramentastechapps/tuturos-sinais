import { SimpleHeader } from '@/components/trading/SimpleHeader';
import { useTransactions } from '@/hooks/useTransactions';
import { AddTransactionDialog } from '@/components/transactions/AddTransactionDialog';
import { TransactionsTable } from '@/components/transactions/TransactionsTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, DollarSign, TrendingUp, TrendingDown, Receipt } from 'lucide-react';

const Transactions = () => {
  const { transactions, summary, addTransaction, deleteTransaction, exportToCSV } = useTransactions();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Histórico de Transações</h1>
            <p className="text-muted-foreground">Registro completo de compras, vendas e transferências</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportToCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <AddTransactionDialog onAdd={addTransaction} />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Comprado</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(summary.totalBought)}</div>
              <p className="text-xs text-muted-foreground">Investimento total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Vendido</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatCurrency(summary.totalSold)}</div>
              <p className="text-xs text-muted-foreground">Retorno de vendas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxas Totais</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalFees)}</div>
              <p className="text-xs text-muted-foreground">Custos de transação</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Investido Líquido</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.netInvested >= 0 ? 'text-foreground' : 'text-success'}`}>
                {formatCurrency(summary.netInvested)}
              </div>
              <p className="text-xs text-muted-foreground">{summary.transactionCount} transações</p>
            </CardContent>
          </Card>
        </div>

        <TransactionsTable transactions={transactions} onDelete={deleteTransaction} />
      </main>
    </div>
  );
};

export default Transactions;
