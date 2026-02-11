// Paper History — Trade history table with filters
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { PaperOrder } from '@/types/paperTrading';

interface PaperHistoryProps {
    history: PaperOrder[];
}

const EXIT_LABELS: Record<string, string> = {
    tp1: 'TP1', tp2: 'TP2', tp3: 'TP3',
    sl: 'Stop Loss', trailing_sl: 'Trailing SL',
    liquidation: 'Liquidação', manual: 'Manual',
};

const formatDate = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
        d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatDuration = (ms: number): string => {
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
};

export const PaperHistory = ({ history }: PaperHistoryProps) => {
    const [filterResult, setFilterResult] = useState<'all' | 'win' | 'loss'>('all');
    const [filterSymbol, setFilterSymbol] = useState<string>('all');
    const [filterPeriod, setFilterPeriod] = useState<string>('all');

    const symbols = useMemo(
        () => [...new Set(history.map(h => h.symbol))].sort(),
        [history],
    );

    const filtered = useMemo(() => {
        let items = [...history].sort((a, b) => b.exitTime - a.exitTime);

        if (filterResult === 'win') items = items.filter(t => t.netPnl > 0);
        else if (filterResult === 'loss') items = items.filter(t => t.netPnl <= 0);

        if (filterSymbol !== 'all') items = items.filter(t => t.symbol === filterSymbol);

        if (filterPeriod !== 'all') {
            const now = Date.now();
            const periods: Record<string, number> = {
                '1d': 24 * 60 * 60 * 1000,
                '7d': 7 * 24 * 60 * 60 * 1000,
                '30d': 30 * 24 * 60 * 60 * 1000,
            };
            const cutoff = now - (periods[filterPeriod] || 0);
            items = items.filter(t => t.exitTime >= cutoff);
        }

        return items;
    }, [history, filterResult, filterSymbol, filterPeriod]);

    return (
        <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                        <History className="h-4 w-4" />
                        Histórico ({filtered.length})
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Select value={filterResult} onValueChange={(v) => setFilterResult(v as typeof filterResult)}>
                            <SelectTrigger className="h-7 text-xs w-24">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="win">Ganhos</SelectItem>
                                <SelectItem value="loss">Perdas</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filterSymbol} onValueChange={setFilterSymbol}>
                            <SelectTrigger className="h-7 text-xs w-28">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                {symbols.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                            <SelectTrigger className="h-7 text-xs w-24">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Sempre</SelectItem>
                                <SelectItem value="1d">24h</SelectItem>
                                <SelectItem value="7d">7 dias</SelectItem>
                                <SelectItem value="30d">30 dias</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {filtered.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                        Nenhuma operação encontrada
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-[10px] uppercase">
                                    <TableHead className="h-8">Data</TableHead>
                                    <TableHead className="h-8">Par</TableHead>
                                    <TableHead className="h-8">Dir.</TableHead>
                                    <TableHead className="h-8 text-right">Entrada</TableHead>
                                    <TableHead className="h-8 text-right">Saída</TableHead>
                                    <TableHead className="h-8 text-right">Resultado</TableHead>
                                    <TableHead className="h-8">Saída</TableHead>
                                    <TableHead className="h-8 text-right">Dur.</TableHead>
                                    <TableHead className="h-8 text-right">Score</TableHead>
                                    <TableHead className="h-8 text-right">Taxas</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((trade) => {
                                    const isWin = trade.netPnl > 0;
                                    return (
                                        <TableRow key={trade.id} className="text-xs">
                                            <TableCell className="py-1.5 font-mono text-[10px]">
                                                {formatDate(trade.exitTime)}
                                            </TableCell>
                                            <TableCell className="py-1.5 font-semibold">{trade.symbol}</TableCell>
                                            <TableCell className="py-1.5">
                                                {trade.direction === 'long' ? (
                                                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                                                ) : (
                                                    <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                                                )}
                                            </TableCell>
                                            <TableCell className="py-1.5 text-right font-mono">{trade.entryPrice.toFixed(2)}</TableCell>
                                            <TableCell className="py-1.5 text-right font-mono">{trade.exitPrice.toFixed(2)}</TableCell>
                                            <TableCell className={`py-1.5 text-right font-semibold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {isWin ? '+' : ''}{trade.netPnl.toFixed(2)} ({trade.pnlPercent.toFixed(1)}%)
                                            </TableCell>
                                            <TableCell className="py-1.5">
                                                <Badge variant="outline" className={`text-[9px] px-1 py-0 ${trade.exitReason.startsWith('tp') ? 'text-emerald-400 border-emerald-500/30' :
                                                        trade.exitReason === 'sl' || trade.exitReason === 'trailing_sl' ? 'text-red-400 border-red-500/30' :
                                                            'text-muted-foreground'
                                                    }`}>
                                                    {EXIT_LABELS[trade.exitReason] || trade.exitReason}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-1.5 text-right text-muted-foreground">{formatDuration(trade.duration)}</TableCell>
                                            <TableCell className="py-1.5 text-right text-muted-foreground">{trade.signalScore}</TableCell>
                                            <TableCell className="py-1.5 text-right text-muted-foreground">{trade.fees.toFixed(2)}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
