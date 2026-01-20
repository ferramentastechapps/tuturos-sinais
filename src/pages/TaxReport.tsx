import { SimpleHeader } from '@/components/trading/SimpleHeader';
import { useTrades } from '@/hooks/useTrades';
import { useTransactions } from '@/hooks/useTransactions';
import { useTaxCalculator } from '@/hooks/useTaxCalculator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

const TaxReport = () => {
  const { trades } = useTrades();
  const { transactions } = useTransactions();
  const { taxReport, exportTaxReport, exportTaxCSV } = useTaxCalculator({ transactions, trades });

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
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Relatório de Impostos {taxReport.year}</h1>
            <p className="text-muted-foreground">Estimativa de ganhos e impostos sobre criptomoedas</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportTaxCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button onClick={exportTaxReport}>
              <FileText className="h-4 w-4 mr-2" />
              JSON
            </Button>
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Aviso Legal:</strong> Este relatório é apenas uma estimativa para fins informativos. 
            Consulte um contador ou especialista tributário para cálculos precisos e declaração de impostos.
          </AlertDescription>
        </Alert>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ganhos Totais</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatCurrency(taxReport.totalGains)}</div>
              <p className="text-xs text-muted-foreground">
                Curto prazo: {formatCurrency(taxReport.shortTermGains)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Perdas Totais</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(taxReport.totalLosses)}</div>
              <p className="text-xs text-muted-foreground">
                Longo prazo: {formatCurrency(taxReport.longTermGains)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ganho Líquido</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${taxReport.netGains >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(taxReport.netGains)}
              </div>
              <p className="text-xs text-muted-foreground">
                Base tributável
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Imposto Estimado</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{formatCurrency(taxReport.estimatedTax)}</div>
              <p className="text-xs text-muted-foreground">
                15% sobre ganhos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tax Information */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Fiscais - Brasil</CardTitle>
            <CardDescription>Regras para tributação de criptomoedas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Isenção</h3>
                <p className="text-sm text-muted-foreground">
                  Vendas até R$ 35.000 por mês são isentas de imposto de renda.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Alíquota</h3>
                <p className="text-sm text-muted-foreground">
                  15% sobre o ganho de capital para vendas acima do limite de isenção.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Declaração</h3>
                <p className="text-sm text-muted-foreground">
                  Deve ser declarado na ficha "Bens e Direitos" e ganhos em "Renda Variável".
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Prazo</h3>
                <p className="text-sm text-muted-foreground">
                  DARF deve ser pago até o último dia útil do mês seguinte à venda.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transações Tributáveis ({taxReport.transactions.length})</CardTitle>
            <CardDescription>Operações fechadas com ganho ou perda</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Custo Base</TableHead>
                    <TableHead className="text-right">Valor Venda</TableHead>
                    <TableHead className="text-right">Ganho/Perda</TableHead>
                    <TableHead className="text-right">Período</TableHead>
                    <TableHead>Prazo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxReport.transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhuma transação tributável encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    taxReport.transactions.map((tx, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(tx.date)}
                        </TableCell>
                        <TableCell className="font-semibold">{tx.asset}</TableCell>
                        <TableCell>
                          <Badge variant={tx.type === 'gain' ? 'default' : 'secondary'}>
                            {tx.type === 'gain' ? 'Ganho' : 'Perda'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(tx.costBasis)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(tx.proceeds)}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-semibold ${tx.type === 'gain' ? 'text-success' : 'text-destructive'}`}>
                          {tx.type === 'gain' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {tx.holdingPeriod} dias
                        </TableCell>
                        <TableCell>
                          <Badge variant={tx.isLongTerm ? 'outline' : 'secondary'}>
                            {tx.isLongTerm ? 'Longo' : 'Curto'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Alert>
          <AlertDescription className="text-xs">
            <strong>Nota:</strong> Este relatório considera apenas as operações fechadas. 
            Posições abertas não são tributadas até serem realizadas. 
            Consulte a Receita Federal para informações atualizadas sobre tributação de criptomoedas.
          </AlertDescription>
        </Alert>
      </main>
    </div>
  );
};

export default TaxReport;
