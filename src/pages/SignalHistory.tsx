import { useState } from 'react';
import { useSignalHistory } from '@/hooks/useSignalHistory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const SignalHistory = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [symbol, setSymbol] = useState<string>('ALL');
  const [type, setType] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [tradeType, setTradeType] = useState<string>('ALL');

  const { data, isLoading, error } = useSignalHistory({
    page,
    limit,
    symbol,
    type,
    status,
    tradeType
  });

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'ACTIVE': return <Badge className="bg-blue-500 hover:bg-blue-600">Active</Badge>;
      case 'CLOSED_TP': return <Badge className="bg-green-500 hover:bg-green-600">Take Profit</Badge>;
      case 'CLOSED_SL': return <Badge className="bg-red-500 hover:bg-red-600">Stop Loss</Badge>;
      case 'CANCELED': return <Badge className="bg-gray-500 hover:bg-gray-600">Canceled</Badge>;
      default: return <Badge variant="outline">{s}</Badge>;
    }
  };

  const clearFilters = () => {
    setSymbol('ALL');
    setType('ALL');
    setStatus('ALL');
    setTradeType('ALL');
    setPage(1);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 animate-fade-in pb-24 lg:pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
              Histórico de Sinais
            </h1>
          </div>
          <p className="text-muted-foreground ml-11">
            Análise detalhada de todos os alertas gerados pelo motor no Supabase.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" />
              Filtros Avançados
            </div>
            {(symbol !== 'ALL' || type !== 'ALL' || status !== 'ALL' || tradeType !== 'ALL') && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground h-8 text-xs">
                Limpar Filtros
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Refine sua pesquisa para analisar tendências e assertividade do modelo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1.5 w-[160px]">
              <label className="text-xs font-semibold text-muted-foreground">Símbolo</label>
              <Select value={symbol} onValueChange={(v) => { setSymbol(v); setPage(1); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos os Símbolos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Símbolos</SelectItem>
                  <SelectItem value="BTCUSDT">BTCUSDT</SelectItem>
                  <SelectItem value="ETHUSDT">ETHUSDT</SelectItem>
                  <SelectItem value="SOLUSDT">SOLUSDT</SelectItem>
                  <SelectItem value="BNBUSDT">BNBUSDT</SelectItem>
                  <SelectItem value="XRPUSDT">XRPUSDT</SelectItem>
                  <SelectItem value="DOGEUSDT">DOGEUSDT</SelectItem>
                  <SelectItem value="ADAUSDT">ADAUSDT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 w-[160px]">
              <label className="text-xs font-semibold text-muted-foreground">Direção</label>
              <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Qualquer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Qualquer</SelectItem>
                  <SelectItem value="LONG">LONG</SelectItem>
                  <SelectItem value="SHORT">SHORT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 w-[160px]">
              <label className="text-xs font-semibold text-muted-foreground">Status</label>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="CLOSED_TP">Fechado - TP Hit</SelectItem>
                  <SelectItem value="CLOSED_SL">Fechado - SL Hit</SelectItem>
                  <SelectItem value="CANCELED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 w-[160px]">
              <label className="text-xs font-semibold text-muted-foreground">Robô (Estratégia)</label>
              <Select value={tradeType} onValueChange={(v) => { setTradeType(v); setPage(1); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Dashboard Geral</SelectItem>
                  <SelectItem value="Main">Motor (Swing 4H)</SelectItem>
                  <SelectItem value="Scalping">Robô (Scalp 5m)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border border-border/40 shadow-xl">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[180px]">Data / Hora</TableHead>
                <TableHead>Símbolo</TableHead>
                <TableHead>Direção</TableHead>
                <TableHead className="text-right">Entrada</TableHead>
                <TableHead className="text-right">Alvos (TP / SL)</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && !data?.signals ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                    <span className="text-muted-foreground text-sm">Carregando histórico...</span>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-red-500">
                    Erro ao carregar o histórico de sinais.
                  </TableCell>
                </TableRow>
              ) : data?.signals && data.signals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Nenhum sinal encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                data?.signals.map((sig) => (
                  <TableRow key={sig.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-sm whitespace-nowrap">
                      {format(new Date(sig.createdAt), 'dd MMM yyyy, HH:mm')}
                    </TableCell>
                    <TableCell className="font-bold">
                      {sig.pair}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        sig.type === 'LONG' ? 'bg-signal-buy/20 text-signal-buy' : 'bg-signal-sell/20 text-signal-sell'
                      }`}>
                        {sig.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      ${sig.entry.toLocaleString(undefined, { maximumFractionDigits: 5 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col gap-1 items-end text-xs">
                        <span className="text-green-500 font-mono">TP: ${sig.takeProfit.toLocaleString(undefined, { maximumFractionDigits: 5 })}</span>
                        <span className="text-red-500 font-mono">SL: ${sig.stopLoss.toLocaleString(undefined, { maximumFractionDigits: 5 })}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {sig.quality?.score ? (
                        <Badge variant="outline" className={sig.quality.score >= 80 ? 'border-primary text-primary' : 'border-muted-foreground text-muted-foreground'}>
                          {sig.quality.score}/100
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {getStatusBadge(sig.status)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
          <p className="text-xs text-muted-foreground">
            {data?.total ? `Mostrando página ${page} de ${data.totalPages} (Total: ${data.total})` : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!data || page >= data.totalPages || isLoading}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SignalHistory;
