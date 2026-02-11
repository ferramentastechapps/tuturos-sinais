import { useState, useMemo } from 'react';
import { RiskLogEntry, RiskLogType } from '@/types/riskProfiles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
    Activity, AlertTriangle, Shield, Ban,
    TrendingUp, FileText, Trash2, Clock,
} from 'lucide-react';

interface RiskLogViewerProps {
    logs: RiskLogEntry[];
    onClear: () => void;
}

const typeIcons: Record<RiskLogType, React.ElementType> = {
    adjustment: Activity,
    alert: AlertTriangle,
    block: Ban,
    trade: TrendingUp,
    report: FileText,
};

const typeColors: Record<RiskLogType, string> = {
    adjustment: 'text-blue-400 bg-blue-500/10',
    alert: 'text-amber-400 bg-amber-500/10',
    block: 'text-red-400 bg-red-500/10',
    trade: 'text-emerald-400 bg-emerald-500/10',
    report: 'text-purple-400 bg-purple-500/10',
};

const severityColors = {
    info: 'border-l-blue-500/50',
    warning: 'border-l-amber-500/50',
    critical: 'border-l-red-500/50',
};

const typeLabels: Record<RiskLogType, string> = {
    adjustment: 'Ajuste',
    alert: 'Alerta',
    block: 'Bloqueio',
    trade: 'Operação',
    report: 'Relatório',
};

export const RiskLogViewer = ({ logs, onClear }: RiskLogViewerProps) => {
    const [filterType, setFilterType] = useState<RiskLogType | 'all'>('all');
    const [filterSymbol, setFilterSymbol] = useState<string>('all');

    // Extrair símbolos únicos
    const symbols = useMemo(() => {
        const set = new Set<string>();
        logs.forEach(l => { if (l.symbol) set.add(l.symbol); });
        return Array.from(set).sort();
    }, [logs]);

    const filteredLogs = useMemo(() => {
        let result = [...logs];
        if (filterType !== 'all') {
            result = result.filter(l => l.type === filterType);
        }
        if (filterSymbol !== 'all') {
            result = result.filter(l => l.symbol === filterSymbol);
        }
        return result.sort((a, b) => b.timestamp - a.timestamp);
    }, [logs, filterType, filterSymbol]);

    const formatTime = (ts: number) => {
        const date = new Date(ts);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
            return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
            date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-3">
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
                <Select value={filterType} onValueChange={(v) => setFilterType(v as RiskLogType | 'all')}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="adjustment">Ajustes</SelectItem>
                        <SelectItem value="alert">Alertas</SelectItem>
                        <SelectItem value="block">Bloqueios</SelectItem>
                        <SelectItem value="trade">Operações</SelectItem>
                        <SelectItem value="report">Relatórios</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={filterSymbol} onValueChange={setFilterSymbol}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue placeholder="Moeda" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {symbols.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="flex-1" />

                <Badge variant="secondary" className="text-xs">
                    {filteredLogs.length} registros
                </Badge>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="h-7 text-xs text-destructive hover:text-destructive"
                >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Limpar
                </Button>
            </div>

            {/* Log List */}
            <ScrollArea className="h-[400px]">
                <div className="space-y-1">
                    {filteredLogs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            Nenhum registro encontrado
                        </div>
                    ) : (
                        filteredLogs.map(log => {
                            const Icon = typeIcons[log.type];
                            return (
                                <div
                                    key={log.id}
                                    className={cn(
                                        'flex items-start gap-3 p-2.5 rounded-lg border-l-2 bg-card/50',
                                        'hover:bg-muted/50 transition-colors',
                                        severityColors[log.severity]
                                    )}
                                >
                                    <div className={cn('p-1.5 rounded-md mt-0.5', typeColors[log.type])}>
                                        <Icon className="h-3 w-3" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            {log.symbol && (
                                                <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">
                                                    {log.symbol}
                                                </Badge>
                                            )}
                                            <Badge
                                                variant="secondary"
                                                className="text-[10px] px-1 py-0"
                                            >
                                                {typeLabels[log.type]}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-foreground leading-relaxed">
                                            {log.message}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                                        <Clock className="h-2.5 w-2.5" />
                                        {formatTime(log.timestamp)}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};
