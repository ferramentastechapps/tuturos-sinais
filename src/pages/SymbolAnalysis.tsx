import { useState, useMemo } from 'react';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { useIndicatorPerformance } from '@/hooks/useIndicatorPerformance';
import { Header } from '@/components/trading/Header';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useAlerts } from '@/hooks/useAlerts';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Target, Shield, AlertTriangle, RefreshCcw, Activity, Settings2 } from 'lucide-react';
import { INDICATOR_REGISTRY } from '@/types/strategyTypes';

const SymbolAnalysis = () => {
  const { data: cryptoPairs = [] } = useCryptoPrices();
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const { alerts, unreadCount, markAsRead, markAllAsRead, clearAlerts } = useAlerts({ enableSound: false });
  
  // Load data for all to do cross-symbol, and data for the selected symbol for deep dive
  const { 
    records, 
    analysis, 
    isLoading, 
    resetSymbolData, 
    generateOptimizedProfile 
  } = useIndicatorPerformance('all');

  // We loaded 'all', so we filter for the deep dive
  const selectedAnalysis = useMemo(() => {
    const relevantRecords = records.filter(r => r.symbol === selectedSymbol);
    if (relevantRecords.length === 0) return null;
    
    // Quick inline computation of summary since getSymbolAnalysis is bound to the hook's internal logic
    // We can use the imported one or just filter here. Actually `analysis` is technically "all" if we fetched 'all', but actually we fetch 'all' and then the hook might return null for `analysis` if we didn't specify a symbol. So we recompute or filter:
    const fromRecords = records.filter(r => r.symbol === selectedSymbol);
    if(fromRecords.length === 0) return null;
    
    // Simplest way is to compute on the fly using the utility we wrote
    // but React won't know about it unless we import it, so let's just do it manually or via a quick hack:
    // the hook exposes `getSymbolAnalysis(symbol)`!
    return null; // see getSymbolAnalysis effect below
  }, [records, selectedSymbol]);
  
  const { getSymbolAnalysis } = useIndicatorPerformance('all');
  const targetAnalysis = getSymbolAnalysis(selectedSymbol);

  // Group performance globally per symbol to show the comparison matrix
  const comparisonMatrix = useMemo(() => {
    const symbolSet = new Set(records.map(r => r.symbol));
    const matrix: { symbol: string; winRate: number; pf: number; trades: number; top: string }[] = [];
    symbolSet.forEach(sym => {
      const symAnalysis = getSymbolAnalysis(sym);
      if (symAnalysis) {
        matrix.push({
          symbol: sym,
          winRate: symAnalysis.globalWinRate,
          pf: symAnalysis.globalProfitFactor,
          trades: symAnalysis.totalTrades,
          top: symAnalysis.topIndicators[0]?.indicatorKey || 'N/A'
        });
      }
    });
    return matrix.sort((a, b) => b.winRate - a.winRate);
  }, [records, getSymbolAnalysis]);

  const handleGenerateProfile = async () => {
    await generateOptimizedProfile(selectedSymbol);
  };

  const handleReset = async () => {
    if (confirm(`Tem certeza que deseja apagar os dados de aprendizado para ${selectedSymbol}? Isso não pode ser desfeito.`)) {
      await resetSymbolData(selectedSymbol);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header 
        alerts={alerts} 
        unreadCount={unreadCount} 
        onMarkAsRead={markAsRead} 
        onMarkAllAsRead={markAllAsRead} 
        onClearAlerts={clearAlerts} 
        soundEnabled={false} 
        onToggleSound={() => {}} 
      />
      <main className="flex-1 overflow-x-hidden overflow-y-auto w-full">
        <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold font-heading flex items-center gap-3">
                <Activity className="w-8 h-8 text-primary" />
                Análise de Inteligência por Moeda
              </h1>
              <p className="text-muted-foreground mt-1">
                O sistema aprende continuamente quais indicadores funcionam melhor para cada ativo.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione a Moeda" />
                </SelectTrigger>
                <SelectContent>
                  {cryptoPairs.map(p => (
                    <SelectItem key={p.symbol} value={p.symbol}>{p.symbol}</SelectItem>
                  ))}
                  {/* Fallbacks if API fails to load specific coins that have history */}
                  {Array.from(new Set(records.map(r => r.symbol))).filter(sym => !cryptoPairs.find(p => p.symbol === sym)).map(sym => (
                    <SelectItem key={sym} value={sym}>{sym}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!targetAnalysis ? (
            <div className="text-center py-20 px-4 border border-dashed border-border rounded-xl bg-muted/10">
              <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold mb-2">Sem Dados Suficientes</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Ainda não há histórico de operações fechadas para {selectedSymbol}.
                O sistema precisa registrar trades neste par para aprender a eficácia dos indicadores.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Level Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-card">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Win Rate Global ({selectedSymbol})</p>
                        <h3 className="text-3xl font-bold font-mono text-signal-buy">
                          {targetAnalysis.globalWinRate.toFixed(1)}%
                        </h3>
                      </div>
                      <div className="p-3 bg-signal-buy/10 rounded-full text-signal-buy">
                        <Target className="w-6 h-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Profit Factor</p>
                        <h3 className="text-3xl font-bold font-mono text-primary">
                          {targetAnalysis.globalProfitFactor.toFixed(2)}x
                        </h3>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-full text-primary">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Amostragem (Trades)</p>
                        <h3 className="text-3xl font-bold font-mono">
                          {targetAnalysis.totalTrades}
                        </h3>
                        {targetAnalysis.totalTrades < 10 && (
                          <p className="text-xs text-warning mt-1">Amostra pequena</p>
                        )}
                      </div>
                      <div className="p-3 bg-muted rounded-full text-muted-foreground">
                        <Activity className="w-6 h-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <Button variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/20" onClick={handleReset}>
                  <RefreshCcw className="w-4 h-4 mr-2" /> Resetar Dados
                </Button>
                <Button onClick={handleGenerateProfile} className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={targetAnalysis.totalTrades < 10}>
                  <Settings2 className="w-4 h-4 mr-2" /> Gerar Perfil Otimizado
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ranking de Indicadores */}
                <Card className="bg-card h-full">
                  <CardHeader>
                    <CardTitle>Eficácia dos Indicadores</CardTitle>
                    <CardDescription>
                      Ranking dos fatores que mais geraram vitórias neste par.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead>Indicador</TableHead>
                            <TableHead className="text-center">Confiança</TableHead>
                            <TableHead className="text-right">Win Rate</TableHead>
                            <TableHead className="text-right">Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {targetAnalysis.topIndicators.map(ind => (
                            <TableRow key={ind.indicatorKey}>
                              <TableCell className="font-medium text-xs sm:text-sm">
                                {INDICATOR_REGISTRY.find(r => r.key === ind.indicatorKey)?.label || ind.indicatorKey}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="bg-background">{ind.stars}</Badge>
                              </TableCell>
                              <TableCell className="text-right text-signal-buy font-mono font-medium">
                                {ind.winRate.toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-right font-bold text-primary">
                                {Math.round(ind.finalScore)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {targetAnalysis.weakIndicators.map(ind => (
                            <TableRow key={ind.indicatorKey} className="opacity-70">
                              <TableCell className="font-medium text-xs sm:text-sm">
                                {INDICATOR_REGISTRY.find(r => r.key === ind.indicatorKey)?.label || ind.indicatorKey}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="bg-background text-warning border-warning/30">{ind.stars}</Badge>
                              </TableCell>
                              <TableCell className="text-right text-warning font-mono">
                                {ind.winRate.toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-right font-bold text-warning">
                                {Math.round(ind.finalScore)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {targetAnalysis.insufficientDataIndicators.map(ind => (
                            <TableRow key={ind.indicatorKey} className="opacity-50">
                              <TableCell className="font-medium text-xs sm:text-sm">
                                {INDICATOR_REGISTRY.find(r => r.key === ind.indicatorKey)?.label || ind.indicatorKey}
                              </TableCell>
                              <TableCell colSpan={3} className="text-center text-xs">
                                Faltam dados ({ind.totalTrades}/10)
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Comparativo entre moedas */}
                <Card className="bg-card h-full">
                  <CardHeader>
                    <CardTitle>Comparativo de Pares</CardTitle>
                    <CardDescription>
                      Descubra quais moedas têm comportamento mais previsível.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                     <div className="rounded-md border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead>Par</TableHead>
                            <TableHead className="text-right">Win Rate</TableHead>
                            <TableHead className="text-right">Melhor Ind.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {comparisonMatrix.length > 0 ? comparisonMatrix.map(row => (
                            <TableRow key={row.symbol} className={row.symbol === selectedSymbol ? 'bg-primary/5' : ''}>
                              <TableCell className="font-bold">
                                {row.symbol}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                <span className={row.winRate >= 60 ? 'text-signal-buy' : row.winRate < 40 ? 'text-signal-sell' : ''}>
                                  {row.winRate.toFixed(1)}%
                                </span>
                                <span className="text-[10px] text-muted-foreground ml-1">({row.trades})</span>
                              </TableCell>
                              <TableCell className="text-right text-xs truncate max-w-[120px]">
                                {INDICATOR_REGISTRY.find(r => r.key === row.top)?.label || row.top}
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                                Sem dados globais para comparação
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SymbolAnalysis;
