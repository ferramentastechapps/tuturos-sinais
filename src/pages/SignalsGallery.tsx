import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TradeSignal } from '@/types/trading';
import { SignalCard } from '@/components/dashboard/SignalCard';
import { ExecuteTradeModal } from '@/components/trading/ExecuteTradeModal';
import { Target, ChevronLeft, ChevronRight, LayoutGrid, CalendarDays, Clock, Calendar, RefreshCw } from 'lucide-react';
import { useSignalHistory } from '@/hooks/useSignalHistory';
import { useSymbols } from '@/hooks/useSymbols';
import { usePairStats } from '@/hooks/usePairStats';
import { PairRanking } from '@/components/dashboard/PairRanking';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency, formatPercentage } from '@/utils/formatters';

type DateRange = 'ALL' | 'day' | 'week' | 'month';

const DATE_RANGE_OPTIONS: { value: DateRange; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'ALL', label: 'Tudo', icon: RefreshCw },
    { value: 'day', label: 'Hoje', icon: Clock },
    { value: 'week', label: 'Semana', icon: CalendarDays },
    { value: 'month', label: 'Mês', icon: Calendar },
];

export default function SignalsGallery() {
    // Modal states
    const [selectedSignal, setSelectedSignal] = useState<TradeSignal | null>(null);
    const [executeSignal, setExecuteSignal] = useState<TradeSignal | null>(null);
    const [executeModalOpen, setExecuteModalOpen] = useState(false);

    // Filter states
    const [page, setPage] = useState(1);
    const limit = 24;
    const [symbol, setSymbol] = useState<string>('ALL');
    const [type, setType] = useState<string>('ALL');
    const [status, setStatus] = useState<string>('ALL');
    const [tradeType, setTradeType] = useState<string>('ALL');
    const [dateRange, setDateRange] = useState<DateRange>('ALL');

    const { data, isLoading } = useSignalHistory({
        page,
        limit,
        symbol,
        type,
        status,
        tradeType,
        dateRange,
    });

    const { data: symbols = [], isLoading: loadingSymbols } = useSymbols();
    const { data: pairStats, isLoading: loadingPairStats } = usePairStats({ tradeType, dateRange, type });

    const getRR = (signal: TradeSignal) => {
        const risk = Math.abs(signal.entry - signal.stopLoss);
        const reward = Math.abs(signal.takeProfit - signal.entry);
        return risk > 0 ? (reward / risk).toFixed(2) : '0';
    };

    const hasActiveFilters = symbol !== 'ALL' || type !== 'ALL' || status !== 'ALL' || tradeType !== 'ALL' || dateRange !== 'ALL';

    const clearFilters = () => {
        setSymbol('ALL');
        setType('ALL');
        setStatus('ALL');
        setTradeType('ALL');
        setDateRange('ALL');
        setPage(1);
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-5 max-w-[1600px] pb-32">
            {/* Header & Title */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <LayoutGrid className="w-8 h-8 text-primary" />
                        Galeria de Sinais
                    </h1>
                    <p className="text-muted-foreground mt-1">Explore, filtre e acompanhe cards de trades mapeados.</p>
                </div>
                {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
                        <RefreshCw className="w-3.5 h-3.5" />
                        Limpar Filtros
                    </Button>
                )}
            </div>

            {/* Period Quick Filter */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Período:</span>
                {DATE_RANGE_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                        <Button
                            key={opt.value}
                            variant={dateRange === opt.value ? 'default' : 'outline'}
                            size="sm"
                            className={cn(
                                "h-8 gap-1.5 text-xs font-medium transition-all",
                                dateRange === opt.value ? "shadow-md" : "text-muted-foreground"
                            )}
                            onClick={() => { setDateRange(opt.value); setPage(1); }}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {opt.label}
                        </Button>
                    );
                })}
            </div>

            {/* Filter Bar */}
            <Card className="border border-border/50 bg-card/60 backdrop-blur-sm sticky top-4 z-10 shadow-lg shadow-black/5">
                <CardContent className="p-4 flex flex-wrap gap-4 items-end">

                    {/* Symbol with all pairs */}
                    <div className="space-y-1.5 min-w-[160px] flex-1">
                        <label className="text-xs font-semibold text-muted-foreground">Ativo/Par</label>
                        <Select value={symbol} onValueChange={(v) => { setSymbol(v); setPage(1); }}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Todas as Moedas" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[280px]">
                                <SelectItem value="ALL">🌐 Todas as Moedas</SelectItem>
                                {loadingSymbols ? (
                                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                                ) : (
                                    symbols.map(s => (
                                        <SelectItem key={s} value={s}>
                                            {s.replace('USDT', '/USDT')}
                                        </SelectItem>
                                    ))
                                )}
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

                    <div className="space-y-1.5 min-w-[160px] flex-1">
                        <label className="text-xs font-semibold text-muted-foreground">Status / Resultado</label>
                        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todo Histórico</SelectItem>
                                <SelectItem value="ACTIVE">⚡ Ativo / Pendente</SelectItem>
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
                                <SelectItem value="Main">🤖 Motor (Swing 4H)</SelectItem>
                                <SelectItem value="Scalping">⚡ Robô (Scalp 5m)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Overview */}
            {data?.stats && (data.total > 0 || data.stats.active > 0) && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                    <Card className="bg-card border-border/50 shadow-sm">
                        <CardContent className="p-4 flex flex-col justify-center">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Trades Analisados</p>
                            <div className="flex items-end gap-2">
                                <span className="text-2xl font-bold leading-none">{data.total}</span>
                                <span className="text-sm text-muted-foreground leading-none mb-0.5">({data.stats.active} ativos)</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border/50 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-signal-buy/10 blur-2xl -z-10 rounded-full" />
                        <CardContent className="p-4 flex flex-col justify-center">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Win Rate</p>
                            <p className="text-2xl font-bold text-signal-buy leading-none">{data.stats.winRate.toFixed(1)}%</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border/50 shadow-sm">
                        <CardContent className="p-4 flex flex-col justify-center">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Wins / Losses</p>
                            <p className="text-2xl font-bold flex gap-2 leading-none items-center">
                                <span className="text-signal-buy">{data.stats.wins}W</span>
                                <span className="text-muted-foreground/30 text-lg">/</span>
                                <span className="text-signal-sell">{data.stats.losses}L</span>
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border/50 shadow-sm relative overflow-hidden">
                        <div className={cn("absolute top-0 right-0 w-24 h-24 blur-2xl -z-10 rounded-full",
                            data.stats.totalPnl > 0 ? "bg-signal-buy/10" : "bg-signal-sell/10"
                        )} />
                        <CardContent className="p-4 flex flex-col justify-center">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">PNL Líquido</p>
                            <p className={cn("text-2xl font-bold leading-none",
                                data.stats.totalPnl > 0 ? "text-signal-buy" : data.stats.totalPnl < 0 ? "text-signal-sell" : "text-muted-foreground"
                            )}>
                                {data.stats.totalPnl > 0 ? '+' : ''}{data.stats.totalPnl.toFixed(2)}%
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Pair Rankings */}
            <PairRanking
                topWinners={pairStats?.topWinners || []}
                topLosers={pairStats?.topLosers || []}
                isLoading={loadingPairStats}
            />

            {/* Grid of Cards */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center p-24 text-muted-foreground">
                    <Target className="w-12 h-12 mb-4 opacity-20 animate-pulse" />
                    <p>Buscando sinais...</p>
                </div>
            ) : data?.signals.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-24 text-muted-foreground border border-dashed rounded-xl bg-muted/20">
                    <Target className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-medium">Nenhum sinal corresponde aos filtros.</p>
                    {hasActiveFilters && (
                        <Button variant="link" onClick={clearFilters} className="mt-2 text-muted-foreground">
                            Limpar filtros
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 animate-fade-in">
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
                            {selectedSignal?.signal_number && (
                                <span className="font-mono text-xs text-orange-500 font-bold bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 leading-none">
                                    #{selectedSignal.signal_number}
                                </span>
                            )}
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
