import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, BrainCircuit, CheckCircle2, XCircle, RefreshCw, TrendingUp, Database, Target } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

const API_BASE = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
    result: string;
    profit_percent: number;
    ml_was_correct: boolean;
    key_indicators: string[];
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

    const loadData = useCallback(async () => {
        try {
            const [statsRes, historyRes] = await Promise.all([
                fetch(`${API_BASE}/api/ml/stats`),
                fetch(`${API_BASE}/api/ml/learning-history?limit=10`),
            ]);
            if (statsRes.ok) setStats(await statsRes.json());
            if (historyRes.ok) setHistory(await historyRes.json());
        } catch (err) {
            console.error('Failed to load ML data', err);
        } finally {
            setLoading(false);
        }
    }, []);

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
                                        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
                                            <div className="flex items-center gap-3">
                                                {item.ml_was_correct
                                                    ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                                                    : <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
                                                <div>
                                                    <p className="font-medium text-sm">{item.symbol}</p>
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
        </div>
    );
};

export default MLAnalytics;
