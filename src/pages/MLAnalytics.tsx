import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, BrainCircuit, CheckCircle2, XCircle, RefreshCw, TrendingUp, Database, Target, Info, Calendar, Filter, ArrowUpCircle, ArrowDownCircle, Clock, Star, DollarSign, ShieldAlert, Activity } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API_BASE = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'all';
type RobotFilter = 'all' | 'swing' | 'scalping';

interface MLStats {
    enabled: boolean;
    loaded: boolean;
    totalSignals: number;
    wins: number;
    losses: number;
    winRate: number;
    tp1Hits: number;
    tp2Hits: number;
    tp3Hits: number;
    avgPnl: number;
    trainingSamples?: number;
}

interface MLLearning {
    id: string;
    symbol: string;
    direction?: string;         // LONG / SHORT
    result: string;
    profit_percent: number;
    ml_was_correct: boolean;
    key_indicators: string[];
    trade_type?: string;
    signal_created_at?: string; // When the signal was created
    entry_time?: string;
    exit_time?: string;
    all_indicators?: any;
    ml_data?: any;
    // Price fields
    entry_price?: number | null;
    entry_range_low?: number | null;
    entry_range_high?: number | null;
    stop_loss?: number | null;
    take_profits?: Array<{ level?: number; tp?: number; price: number; hit?: boolean }>;
    // Quality
    score?: number | null;
    risk_reward?: number | null;
}

interface MLLearningHistory {
    success: boolean;
    learnings: MLLearning[];
    summary: { total: number; ml_accuracy: number };
}

const MLAnalytics = () => {
    const { toast } = useToast();
    const [stats, setStats] = useState<MLStats | null>(null);
    const [history, setHistory] = useState<MLLearningHistory | null>(null);
    const [loading, setLoading] = useState(true);
    const [retraining, setRetraining] = useState(false);
    const [selectedLearning, setSelectedLearning] = useState<MLLearning | null>(null);
    
    // Filtros
    const [dateFilter, setDateFilter] = useState<DateFilter>('all');
    const [robotFilter, setRobotFilter] = useState<RobotFilter>('all');
    const [symbolFilter, setSymbolFilter] = useState<string>('all');
    const [limitFilter, setLimitFilter] = useState<number>(50); // Default to 50 items
    const [monitoredSymbols, setMonitoredSymbols] = useState<string[]>([]);

    useEffect(() => {
        const fetchSymbols = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/symbols`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.symbols) {
                        setMonitoredSymbols(data.symbols);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch monitored symbols', err);
            }
        };
        fetchSymbols();
    }, []);

    const getDateRange = (filter: DateFilter): { start?: string; end?: string } => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (filter) {
            case 'today':
                return { start: today.toISOString() };
            case 'yesterday':
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                return { start: yesterday.toISOString(), end: today.toISOString() };
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return { start: weekAgo.toISOString() };
            case 'month':
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return { start: monthAgo.toISOString() };
            default:
                return {};
        }
    };

    const loadData = useCallback(async () => {
        try {
            const dateRange = getDateRange(dateFilter);
            const params = new URLSearchParams();
            
            if (dateRange.start) params.append('startDate', dateRange.start);
            if (dateRange.end) params.append('endDate', dateRange.end);
            if (robotFilter !== 'all') params.append('robotType', robotFilter);
            if (symbolFilter !== 'all') params.append('symbol', symbolFilter);
            
            const queryString = params.toString();
            
            const [statsRes, historyRes] = await Promise.all([
                fetch(`${API_BASE}/api/ml/stats${queryString ? `?${queryString}` : ''}`),
                fetch(`${API_BASE}/api/ml/learning-history?limit=${limitFilter}${queryString ? `&${queryString}` : ''}`),
            ]);
            if (statsRes.ok) setStats(await statsRes.json());
            if (historyRes.ok) setHistory(await historyRes.json());
        } catch (err) {
            console.error('Failed to load ML data', err);
        } finally {
            setLoading(false);
        }
    }, [dateFilter, robotFilter, symbolFilter, limitFilter]);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 15000);
        return () => clearInterval(interval);
    }, [loadData]);

    const handleRetrain = async () => {
        setRetraining(true);
        try {
            const res = await fetch(`${API_BASE}/api/ml/retrain`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                toast({ title: 'Retreinamento iniciado', description: data.message });
            } else {
                toast({ variant: 'destructive', title: 'Erro', description: data.error });
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Erro', description: err.message });
        } finally {
            setRetraining(false);
        }
    };

    const handleExportCSV = async () => {
        try {
            toast({ title: 'Exportando', description: 'Gerando arquivo CSV...' });
            
            const dateRange = getDateRange(dateFilter);
            const params = new URLSearchParams();
            if (dateRange.start) params.append('startDate', dateRange.start);
            if (dateRange.end) params.append('endDate', dateRange.end);
            if (robotFilter !== 'all') params.append('robotType', robotFilter);
            if (symbolFilter !== 'all') params.append('symbol', symbolFilter);
            
            const queryString = params.toString();
            const res = await fetch(`${API_BASE}/api/ml/export${queryString ? `?${queryString}` : ''}`);
            if (!res.ok) throw new Error('Falha ao exportar os dados do ML');
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ml_training_data.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Erro', description: err.message });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
        );
    }

    const accuracy = history?.summary?.ml_accuracy ?? 0;

    return (
        <div className="container mx-auto p-6 space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                        ML Analytics
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Aprendizado de máquina — otimização e métricas de performance
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadData}>
                        <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
                    </Button>
                    <Button
                        onClick={handleExportCSV}
                        variant="outline"
                        className="border-purple-500/50 hover:bg-purple-500/10"
                    >
                        <Database className="mr-2 h-4 w-4 text-purple-400" />
                        Exportar CSV
                    </Button>
                    <Button
                        onClick={handleRetrain}
                        disabled={retraining || !stats?.enabled}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                        {retraining
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <BrainCircuit className="mr-2 h-4 w-4" />}
                        Retreinar Modelo
                    </Button>
                </div>
            </div>

            {/* Filtros */}
            <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-purple-400" />
                            <span className="text-sm font-medium">Filtros:</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                                <SelectTrigger className="w-[140px] h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="today">Hoje</SelectItem>
                                    <SelectItem value="yesterday">Ontem</SelectItem>
                                    <SelectItem value="week">Última Semana</SelectItem>
                                    <SelectItem value="month">Último Mês</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <BrainCircuit className="h-4 w-4 text-muted-foreground" />
                            <Select value={robotFilter} onValueChange={(v) => setRobotFilter(v as RobotFilter)}>
                                <SelectTrigger className="w-[140px] h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos Robôs</SelectItem>
                                    <SelectItem value="swing">Swing Trading</SelectItem>
                                    <SelectItem value="scalping">Scalping</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <Select value={symbolFilter} onValueChange={(v) => setSymbolFilter(v)}>
                                <SelectTrigger className="w-[160px] h-9">
                                    <SelectValue placeholder="Todas Moedas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas Moedas</SelectItem>
                                    {monitoredSymbols.map((sym) => (
                                        <SelectItem key={sym} value={sym}>
                                            {sym}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Select value={limitFilter.toString()} onValueChange={(v) => setLimitFilter(parseInt(v))}>
                                <SelectTrigger className="w-[130px] h-9">
                                    <SelectValue placeholder="Qtd. Linhas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">Mostrar 10</SelectItem>
                                    <SelectItem value="20">Mostrar 20</SelectItem>
                                    <SelectItem value="50">Mostrar 50</SelectItem>
                                    <SelectItem value="100">Mostrar 100</SelectItem>
                                    <SelectItem value="500">Mostrar 500</SelectItem>
                                    <SelectItem value="1000">Mostrar 1000</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {(dateFilter !== 'all' || robotFilter !== 'all' || symbolFilter !== 'all' || limitFilter !== 50) && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                    setDateFilter('all');
                                    setRobotFilter('all');
                                    setSymbolFilter('all');
                                    setLimitFilter(50);
                                }}
                                className="text-xs"
                            >
                                Limpar Filtros
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Status do Modelo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold">
                            {stats?.loaded ? (
                                <span className="text-green-500 flex items-center gap-1">
                                    <CheckCircle2 className="h-5 w-5" /> Ativo
                                </span>
                            ) : (
                                <span className="text-yellow-500 flex items-center gap-1">
                                    <XCircle className="h-5 w-5" /> Sem modelo
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            ML {stats?.enabled ? 'habilitado' : 'desabilitado'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Dados de Treino</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold flex items-center gap-2">
                            <Database className="h-5 w-5 text-purple-400" />
                            {stats?.trainingSamples ?? 0}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">amostras de treino ML</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate (real)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                            {stats ? `${stats.winRate.toFixed(1)}%` : 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats?.wins ?? 0}W / {stats?.losses ?? 0}L — sinais fechados
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Acurácia ML</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-400">
                            {history ? `${(accuracy * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">previsões corretas</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="performance" className="w-full">
                <TabsList>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                    <TabsTrigger value="history">Histórico de Aprendizado</TabsTrigger>
                </TabsList>

                <TabsContent value="performance" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Target className="h-5 w-5 text-purple-400" /> Take Profits Atingidos
                                </CardTitle>
                                <CardDescription>Sinais fechados que atingiram cada nível de TP</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {[
                                    { label: 'TP1', value: stats?.tp1Hits ?? 0, color: 'bg-green-500' },
                                    { label: 'TP2', value: stats?.tp2Hits ?? 0, color: 'bg-blue-500' },
                                    { label: 'TP3', value: stats?.tp3Hits ?? 0, color: 'bg-purple-500' },
                                ].map(({ label, value, color }) => {
                                    const total = Math.max(stats?.wins ?? 1, 1);
                                    const pct = Math.min((value / total) * 100, 100);
                                    return (
                                        <div key={label}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>{label}</span>
                                                <span className="text-muted-foreground">{value} hits</span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-green-400" /> PnL Médio
                                </CardTitle>
                                <CardDescription>Retorno médio por operação nos dados de treino</CardDescription>
                            </CardHeader>
                            <CardContent className="flex items-center justify-center h-40">
                                <div className="text-center">
                                    <div className={`text-5xl font-bold ${(stats?.avgPnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {stats ? `${stats.avgPnl >= 0 ? '+' : ''}${stats.avgPnl.toFixed(2)}%` : 'N/A'}
                                    </div>
                                    <p className="text-muted-foreground mt-2 text-sm">por operação (média)</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Últimas Operações Aprendidas</CardTitle>
                            <CardDescription>
                                Operações recentes e se a IA previu corretamente o resultado
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!history?.learnings?.length ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <BrainCircuit className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                    <p>Nenhuma operação concluída ainda.</p>
                                    <p className="text-sm mt-1">Os dados aparecerão conforme os sinais forem fechados.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {history.learnings.map((item) => (
                                        <div 
                                            key={item.id} 
                                            onClick={() => setSelectedLearning(item)}
                                            className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50 cursor-pointer hover:bg-muted/80 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                {item.ml_was_correct
                                                    ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                                                    : <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-sm group-hover:text-purple-400 transition-colors">
                                                            {item.signal_number && `#${item.signal_number} `}{item.symbol}
                                                        </p>
                                                        {item.trade_type && (
                                                            <Badge variant="outline" className="text-[10px] h-4 px-1">{item.trade_type}</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.key_indicators?.join(', ')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge variant={item.result === 'WIN' ? 'default' : 'destructive'}>
                                                    {item.result}
                                                </Badge>
                                                <span className={`text-sm font-semibold ${item.profit_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {item.profit_percent >= 0 ? '+' : ''}{item.profit_percent.toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={!!selectedLearning} onOpenChange={(o) => !o && setSelectedLearning(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            {selectedLearning?.signal_number && `#${selectedLearning.signal_number} `}{selectedLearning?.symbol} 
                            <Badge variant={selectedLearning?.result === 'WIN' ? 'default' : 'destructive'}>
                                {selectedLearning?.result}
                            </Badge>
                            {selectedLearning?.direction && (
                                <Badge variant="outline" className={`ml-1 text-xs font-bold ${selectedLearning.direction === 'LONG' ? 'border-green-500/60 text-green-400' : 'border-red-500/60 text-red-400'}`}>
                                    {selectedLearning.direction === 'LONG' ? '▲' : '▼'} {selectedLearning.direction}
                                </Badge>
                            )}
                            {selectedLearning?.trade_type && (
                                <Badge variant="outline" className="ml-1 text-xs">
                                    {selectedLearning.trade_type}
                                </Badge>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            Detalhes completos da operação e análise da Inteligência Artificial.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLearning && (
                        <div className="space-y-4 mt-2">

                            {/* ── Row 1: Timestamps + Score ── */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-muted/40 rounded-lg p-3 border border-border/30 space-y-1">
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wide"><Clock className="h-3 w-3" /> Sinal Criado</p>
                                    <p className="text-xs font-semibold">
                                        {selectedLearning.signal_created_at
                                            ? new Date(selectedLearning.signal_created_at).toLocaleString('pt-BR')
                                            : 'N/A'}
                                    </p>
                                </div>
                                <div className="bg-muted/40 rounded-lg p-3 border border-border/30 space-y-1">
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wide"><ArrowUpCircle className="h-3 w-3" /> Entrada</p>
                                    <p className="text-xs font-semibold">
                                        {selectedLearning.entry_time
                                            ? new Date(selectedLearning.entry_time).toLocaleString('pt-BR')
                                            : 'N/A'}
                                    </p>
                                </div>
                                <div className="bg-muted/40 rounded-lg p-3 border border-border/30 space-y-1">
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wide"><ArrowDownCircle className="h-3 w-3" /> Saída</p>
                                    <p className="text-xs font-semibold">
                                        {selectedLearning.exit_time
                                            ? new Date(selectedLearning.exit_time).toLocaleString('pt-BR')
                                            : 'N/A'}
                                    </p>
                                </div>
                                <div className="bg-muted/40 rounded-lg p-3 border border-border/30 space-y-1">
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wide"><Star className="h-3 w-3" /> Score IA</p>
                                    <p className={`text-lg font-bold ${
                                        selectedLearning.score != null
                                            ? (selectedLearning.score >= 0.75 ? 'text-green-400' : selectedLearning.score >= 0.5 ? 'text-yellow-400' : 'text-red-400')
                                            : 'text-muted-foreground'
                                    }`}>
                                        {selectedLearning.score != null
                                            ? (selectedLearning.score > 1 ? selectedLearning.score.toFixed(1) : (selectedLearning.score * 100).toFixed(0) + '%')
                                            : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            {/* ── Row 2: Price Snapshot ── */}
                            <div>
                                <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                    <DollarSign className="h-4 w-4" /> Preços da Operação
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-1">
                                        <p className="text-[10px] text-blue-400 uppercase tracking-wide">Entrada (midpoint)</p>
                                        <p className="text-sm font-bold text-blue-300">
                                            {selectedLearning.entry_price != null
                                                ? `$${selectedLearning.entry_price.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}`
                                                : 'N/A'}
                                        </p>
                                        {selectedLearning.entry_range_low != null && selectedLearning.entry_range_high != null && (
                                            <p className="text-[10px] text-muted-foreground">
                                                {`$${selectedLearning.entry_range_low.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} – $${selectedLearning.entry_range_high.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}`}
                                            </p>
                                        )}
                                    </div>
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-1">
                                        <p className="text-[10px] text-red-400 uppercase tracking-wide flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Stop Loss</p>
                                        <p className="text-sm font-bold text-red-300">
                                            {selectedLearning.stop_loss != null
                                                ? `$${selectedLearning.stop_loss.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}`
                                                : 'N/A'}
                                        </p>
                                    </div>
                                    {/* Take Profits */}
                                    {(selectedLearning.take_profits && selectedLearning.take_profits.length > 0)
                                        ? selectedLearning.take_profits.slice(0, 2).map((tp, i) => {
                                            const lvl = tp.level ?? tp.tp ?? (i + 1);
                                            return (
                                                <div key={i} className={`rounded-lg p-3 space-y-1 border ${tp.hit ? 'bg-green-500/15 border-green-500/30' : 'bg-muted/40 border-border/30'}`}>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                                        <Target className="h-3 w-3" /> TP{lvl} {tp.hit && <span className="text-green-400">✓</span>}
                                                    </p>
                                                    <p className={`text-sm font-bold ${tp.hit ? 'text-green-300' : ''}`}>
                                                        ${tp.price.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                                                    </p>
                                                </div>
                                            );
                                        })
                                        : (
                                            <div className="bg-muted/40 rounded-lg p-3 border border-border/30 space-y-1">
                                                <p className="text-[10px] text-muted-foreground uppercase">Take Profit</p>
                                                <p className="text-sm text-muted-foreground italic text-xs">Sem dados</p>
                                            </div>
                                        )
                                    }
                                </div>
                                {/* Risk Reward */}
                                {selectedLearning.risk_reward != null && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                        <span className="text-foreground font-medium">Risk/Reward:</span> 1:{typeof selectedLearning.risk_reward === 'number' ? selectedLearning.risk_reward.toFixed(2) : selectedLearning.risk_reward}
                                        {' '}• Resultado: <span className={`font-semibold ${selectedLearning.profit_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {selectedLearning.profit_percent >= 0 ? '+' : ''}{selectedLearning.profit_percent.toFixed(2)}%
                                        </span>
                                        {' '}• IA Previu: {selectedLearning.ml_was_correct
                                            ? <span className="text-green-400 font-semibold">✓ Certo</span>
                                            : <span className="text-red-400 font-semibold">✗ Errado</span>}
                                    </p>
                                )}
                            </div>

                            {/* ── Row 3: Indicators + AI Features ── */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Technical Indicators */}
                                <div>
                                    <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                        <Activity className="h-4 w-4" /> Indicadores Técnicos
                                    </h4>
                                    <div className="bg-muted/50 p-3 rounded-md text-sm max-h-52 overflow-y-auto border border-border/30">
                                        {selectedLearning.all_indicators && Array.isArray(selectedLearning.all_indicators) && selectedLearning.all_indicators.length > 0 ? (
                                            <ul className="space-y-1.5">
                                                {selectedLearning.all_indicators.map((ind: any, i: number) => {
                                                    if (typeof ind === 'string') return (
                                                        <li key={i} className="flex items-center gap-2 text-xs border-b border-border/30 pb-1 last:border-0">
                                                            <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
                                                            <span className="font-medium">{ind}</span>
                                                        </li>
                                                    );
                                                    const name = ind.name || ind.indicator || Object.keys(ind)[0] || 'Ind';
                                                    const val = ind.value !== undefined ? ind.value : Object.values(ind)[0];
                                                    return (
                                                        <li key={i} className="flex justify-between text-xs border-b border-border/30 pb-1 last:border-0">
                                                            <span className="text-muted-foreground">{name}</span>
                                                            <span className="font-mono font-medium">{typeof val === 'number' ? val.toFixed(4) : JSON.stringify(val)}</span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : (
                                            <p className="text-muted-foreground italic text-xs text-center py-3">Sem indicadores detalhados salvos para esta operação.</p>
                                        )}
                                    </div>
                                </div>

                                {/* AI Features — formatted as key-value, NOT raw JSON */}
                                <div>
                                    <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                        <BrainCircuit className="h-4 w-4" /> Dados da IA (Features)
                                    </h4>
                                    <div className="bg-muted/50 p-3 rounded-md text-sm max-h-52 overflow-y-auto border border-border/30">
                                        {selectedLearning.ml_data && Object.keys(selectedLearning.ml_data).length > 0 ? (() => {
                                            // Separate meta-fields from feature fields
                                            const SKIP_KEYS = new Set(['predictedClass', 'probability', 'confidence']);
                                            const metaKeys = ['predictedClass', 'probability', 'confidence'].filter(k => selectedLearning.ml_data[k] !== undefined);
                                            const featureEntries = Object.entries(selectedLearning.ml_data).filter(([k]) => !SKIP_KEYS.has(k));
                                            return (
                                                <div className="space-y-3">
                                                    {/* Meta summary */}
                                                    {metaKeys.length > 0 && (
                                                        <div className="flex gap-2 flex-wrap pb-2 border-b border-border/30">
                                                            {selectedLearning.ml_data.predictedClass !== undefined && (
                                                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${selectedLearning.ml_data.predictedClass === 1 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                                    Previu: {selectedLearning.ml_data.predictedClass === 1 ? 'WIN' : 'LOSS'}
                                                                </span>
                                                            )}
                                                            {selectedLearning.ml_data.probability !== undefined && (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold">
                                                                    Prob: {(selectedLearning.ml_data.probability * 100).toFixed(1)}%
                                                                </span>
                                                            )}
                                                            {selectedLearning.ml_data.confidence !== undefined && (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold">
                                                                    Conf: {(selectedLearning.ml_data.confidence * 100).toFixed(1)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {/* Feature rows */}
                                                    <ul className="space-y-1">
                                                        {featureEntries.map(([key, val]) => (
                                                            <li key={key} className="flex justify-between text-xs border-b border-border/20 pb-1 last:border-0">
                                                                <span className="text-muted-foreground truncate max-w-[55%]">{key.replace(/_/g, ' ')}</span>
                                                                <span className="font-mono font-medium text-right">
                                                                    {typeof val === 'number'
                                                                        ? (Math.abs(val as number) < 10 ? (val as number).toFixed(4) : (val as number).toLocaleString('pt-BR', { maximumFractionDigits: 2 }))
                                                                        : typeof val === 'boolean'
                                                                            ? (val ? '✓ sim' : '✗ não')
                                                                            : String(val)}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            );
                                        })() : (
                                            <p className="text-muted-foreground italic text-xs text-center py-4">Sem dados de machine learning salvos.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ── TradingView Chart ── */}
                            <div className="pt-2 border-t border-border/40">
                                <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                    <TrendingUp className="h-4 w-4" /> Gráfico da Operação
                                </h4>
                                <div className="h-72 w-full bg-muted/30 rounded-md overflow-hidden border border-border/30">
                                    <iframe
                                        src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_1&symbol=${selectedLearning.symbol.replace('USDT', '')}USDT&interval=15&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=America%2FSao_Paulo`}
                                        className="w-full h-full border-0"
                                        title={`Gráfico ${selectedLearning.symbol}`}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MLAnalytics;
