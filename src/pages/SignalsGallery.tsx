import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TradeSignal } from '@/types/trading';
import { SignalCard } from '@/components/dashboard/SignalCard';
import { ExecuteTradeModal } from '@/components/trading/ExecuteTradeModal';
import { Target, BarChart2, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { useSignalHistory } from '@/hooks/useSignalHistory';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency, formatPercentage } from '@/utils/formatters';

export default function SignalsGallery() {
    // Modal states
    const [selectedSignal, setSelectedSignal] = useState<TradeSignal | null>(null);
    const [executeSignal, setExecuteSignal] = useState<TradeSignal | null>(null);
    const [executeModalOpen, setExecuteModalOpen] = useState(false);

    // Filter states
    const [page, setPage] = useState(1);
    const limit = 24; // Show more cards in gallery
    const [symbol, setSymbol] = useState<string>('ALL');
    const [type, setType] = useState<string>('ALL');
    const [status, setStatus] = useState<string>('ALL');
    const [tradeType, setTradeType] = useState<string>('ALL');

    const { data, isLoading } = useSignalHistory({
        page,
        limit,
        symbol,
        type,
        status,
        tradeType
    });

    const getRR = (signal: TradeSignal) => {
        const risk = Math.abs(signal.entry - signal.stopLoss);
        const reward = Math.abs(signal.takeProfit - signal.entry);
        return risk > 0 ? (reward / risk).toFixed(2) : '0';
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] pb-32">
            {/* Header & Title */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <LayoutGrid className="w-8 h-8 text-primary" />
                        Galeria de Sinais
                    </h1>
                    <p className="text-muted-foreground mt-1">Explore, filtre e acompanhe cards de trades mapeados.</p>
                </div>
            </div>

            {/* Filter Bar */}
            <Card className="border border-border/50 bg-card/60 backdrop-blur-sm sticky top-4 z-10 shadow-lg shadow-black/5">
                <CardContent className="p-4 flex flex-wrap gap-4 items-end">
                    <div className="space-y-1.5 min-w-[140px] flex-1">
                        <label className="text-xs font-semibold text-muted-foreground">Ativo / Par</label>
                        <Select value={symbol} onValueChange={(v) => { setSymbol(v); setPage(1); }}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Todas as Moedas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todas as Moedas</SelectItem>
                                <SelectItem value="BTCUSDT">BTC/USDT</SelectItem>
                                <SelectItem value="ETHUSDT">ETH/USDT</SelectItem>
                                <SelectItem value="SOLUSDT">SOL/USDT</SelectItem>
                                <SelectItem value="BNBUSDT">BNB/USDT</SelectItem>
                                <SelectItem value="ADAUSDT">ADA/USDT</SelectItem>
                                <SelectItem value="XRPUSDT">XRP/USDT</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5 min-w-[140px] flex-1">
                        <label className="text-xs font-semibold text-muted-foreground">Direção</label>
                        <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Long & Short" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Ambas Análises</SelectItem>
                                <SelectItem value="long">🟢 LONG</SelectItem>
                                <SelectItem value="short">🔴 SHORT</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5 min-w-[140px] flex-1">
                        <label className="text-xs font-semibold text-muted-foreground">Status / Resultado</label>
                        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todo Histórico</SelectItem>
                                <SelectItem value="ACTIVE">Ativo / Pendente</SelectItem>
                                <SelectItem value="CLOSED_TP">🟢 Fechado - TP (Win)</SelectItem>
                                <SelectItem value="CLOSED_SL">🔴 Fechado - SL (Loss)</SelectItem>
                                <SelectItem value="CANCELED">⚪ Cancelado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5 min-w-[140px] flex-1">
                        <label className="text-xs font-semibold text-muted-foreground">Robô (Estratégia)</label>
                        <Select value={tradeType} onValueChange={(v) => { setTradeType(v); setPage(1); }}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Mesa (Ambos)</SelectItem>
                                <SelectItem value="Main">Motor (Swing 4H)</SelectItem>
                                <SelectItem value="Scalping">Robô (Scalp 5m)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(symbol !== 'ALL' || type !== 'ALL' || status !== 'ALL' || tradeType !== 'ALL') && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-muted-foreground h-9"
                            onClick={() => {
                                setSymbol('ALL'); setType('ALL'); setStatus('ALL'); setTradeType('ALL'); setPage(1);
                            }}
                        >
                            Limpar Filtros
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Grid of Cards */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center p-24 text-muted-foreground">
                    <Target className="w-12 h-12 mb-4 opacity-20 animate-pulse" />
                    <p>Buscando sinais...</p>
                </div>
            ) : data?.signals.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-24 text-muted-foreground border border-dashed rounded-xl bg-muted/20">
                    <Target className="w-12 h-12 mb-4 opacity-20" />
                    <p>Nenhum sinal corresponde aos filtros.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 animate-fade-in">
                    {data?.signals.map((signal) => (
                        <div key={signal.id} className="min-h-[220px]">
                            <SignalCard
                                signal={signal}
                                onAnalyze={() => setSelectedSignal(signal)}
                                onExecute={() => { setExecuteSignal(signal); setExecuteModalOpen(true); }}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {data && data.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8 bg-card/40 py-3 rounded-full border border-border/40 max-w-sm mx-auto">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">
                        Página {page} de {data.totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                        disabled={page === data.totalPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Signal Detail Modal */}
            <Dialog open={!!selectedSignal} onOpenChange={(open) => !open && setSelectedSignal(null)}>
                <DialogContent className="sm:max-w-[600px] border-border/80 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span className="text-xl">{selectedSignal?.pair}</span>
                            <Badge
                                variant={selectedSignal?.type === 'long' ? 'default' : 'destructive'}
                                className={cn(
                                    selectedSignal?.type === 'long' ? "bg-signal-buy hover:bg-signal-buy/90" : "bg-signal-sell hover:bg-signal-sell/90"
                                )}
                            >
                                {selectedSignal?.type === 'long' ? 'LONG' : 'SHORT'}
                            </Badge>
                        </DialogTitle>
                        <DialogDescription>
                            Detalhes do sinal gerado em {selectedSignal && new Date(selectedSignal.createdAt).toLocaleString()}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSignal && (
                        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
                            {/* Entry / TPs / SL */}
                            <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Entrada</span>
                                    <span className="text-lg font-mono font-bold text-primary">
                                        {formatCurrency(selectedSignal.entry)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-signal-buy">🎯 Alvo 1 (TP1)</span>
                                    <div className="text-right">
                                        <span className="text-base font-mono font-bold text-signal-buy">
                                            {formatCurrency(selectedSignal.takeProfit1 || selectedSignal.takeProfit)}
                                        </span>
                                        <span className="text-xs text-signal-buy/80 ml-2">
                                            +{formatPercentage(Math.abs(((selectedSignal.takeProfit1 || selectedSignal.takeProfit) - selectedSignal.entry) / selectedSignal.entry) * 100)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                                    <span className="text-sm text-signal-sell">🛡️ Stop Loss</span>
                                    <div className="text-right">
                                        <span className="text-base font-mono font-bold text-signal-sell">
                                            {formatCurrency(selectedSignal.stopLoss)}
                                        </span>
                                        <span className="text-xs text-signal-sell/80 ml-2">
                                            -{formatPercentage(Math.abs((selectedSignal.entry - selectedSignal.stopLoss) / selectedSignal.entry) * 100)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-end gap-3 mt-2">
                                <Button variant="outline" onClick={() => setSelectedSignal(null)}>Fechar Visualização</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Execute Trade Modal */}
            <ExecuteTradeModal
                open={executeModalOpen}
                onClose={() => { setExecuteModalOpen(false); setExecuteSignal(null); }}
                signal={executeSignal ? {
                    id: executeSignal.id,
                    symbol: executeSignal.symbol || executeSignal.pair,
                    direction: executeSignal.type as 'long' | 'short',
                    currentPrice: (executeSignal as any).currentPrice || executeSignal.entry,
                    entryZone: {
                        min: (executeSignal as any).entryZone?.low ?? (executeSignal.entry * 0.998),
                        max: (executeSignal as any).entryZone?.high ?? (executeSignal.entry * 1.002),
                    },
                    stopLoss: {
                        price: executeSignal.stopLoss,
                        percent: (executeSignal as any).stopLossPercent ?? Math.abs((executeSignal.stopLoss - executeSignal.entry) / executeSignal.entry * 100),
                    },
                    takeProfits: [
                        { level: 1, price: executeSignal.takeProfit1 || executeSignal.takeProfit, percent: Math.abs(((executeSignal.takeProfit1 || executeSignal.takeProfit) - executeSignal.entry) / executeSignal.entry * 100) },
                        ...(executeSignal.takeProfit2 ? [{ level: 2, price: executeSignal.takeProfit2, percent: Math.abs((executeSignal.takeProfit2 - executeSignal.entry) / executeSignal.entry * 100) }] : []),
                    ],
                    leverage: (executeSignal as any).leverage || 5,
                    riskPercent: (executeSignal as any).riskPercent || 2,
                    riskReward: parseFloat(getRR(executeSignal)),
                    quality: (executeSignal as any).quality,
                    confidence: executeSignal.confidence || 0,
                } : null}
            />
        </div>
    );
}
