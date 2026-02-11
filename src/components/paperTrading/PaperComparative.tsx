// Paper Comparative — Paper Trading vs Backtest comparison
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { GitCompare, AlertTriangle } from 'lucide-react';
import { PaperBacktestComparison, PaperEquityPoint } from '@/types/paperTrading';
import { getLatestResult } from '@/services/backtestService';
import { useMemo } from 'react';

interface PaperComparativeProps {
    comparison: PaperBacktestComparison | null;
    equityCurve: PaperEquityPoint[];
    initialBalance: number;
}

export const PaperComparative = ({ comparison, equityCurve, initialBalance }: PaperComparativeProps) => {
    const backtestResult = useMemo(() => getLatestResult(), []);

    // Merge curves for chart
    const chartData = useMemo(() => {
        if (equityCurve.length < 2) return [];

        const paperPoints = equityCurve.map(p => ({
            time: new Date(p.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            paper: Number(((p.equity / initialBalance - 1) * 100).toFixed(2)),
        }));

        // If backtest data available, merge
        if (backtestResult?.equityCurve) {
            const btInitial = backtestResult.config.initialCapital;
            const btPoints = backtestResult.equityCurve.map(p => ({
                time: new Date(p.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                backtest: Number(((p.equity / btInitial - 1) * 100).toFixed(2)),
            }));

            // Simple merge: put backtest and paper data side by side using index
            const maxLen = Math.max(paperPoints.length, btPoints.length);
            const merged: Array<{ time: string; paper?: number; backtest?: number }> = [];
            for (let i = 0; i < maxLen; i++) {
                merged.push({
                    time: paperPoints[i]?.time || btPoints[i]?.time || '',
                    paper: paperPoints[i]?.paper,
                    backtest: btPoints[i]?.backtest,
                });
            }
            return merged;
        }

        return paperPoints;
    }, [equityCurve, backtestResult, initialBalance]);

    if (!comparison && equityCurve.length < 2) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <GitCompare className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Dados insuficientes para comparação</p>
                <p className="text-xs mt-1 opacity-60">Execute um backtest e realize operações de paper trading</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Divergence warnings */}
            {comparison?.hasDivergence && (
                <Alert variant="destructive" className="border-amber-500/30 bg-amber-500/5">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <AlertDescription className="text-xs text-amber-300">
                        <strong>Divergência detectada</strong> entre Paper Trading e Backtesting:
                        <ul className="mt-1 list-disc list-inside">
                            {comparison.divergenceWarnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {/* Comparison table */}
            {comparison && (
                <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-1.5">
                            <GitCompare className="h-4 w-4" />
                            Paper Trading vs Backtesting
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                        <div className="grid grid-cols-4 gap-2 text-xs">
                            {/* Header */}
                            <div className="font-semibold text-muted-foreground">Métrica</div>
                            <div className="font-semibold text-blue-400 text-center">Paper</div>
                            <div className="font-semibold text-amber-400 text-center">Backtest</div>
                            <div className="font-semibold text-muted-foreground text-center">Desvio</div>

                            {/* Win Rate */}
                            <div className="text-muted-foreground">Win Rate</div>
                            <div className="text-center">{comparison.paperWinRate.toFixed(1)}%</div>
                            <div className="text-center">{comparison.backtestWinRate.toFixed(1)}%</div>
                            <div className="text-center">
                                <Badge variant="outline" className={`text-[9px] px-1 py-0 ${comparison.winRateDeviation > 15 ? 'text-red-400 border-red-500/30' : 'text-emerald-400 border-emerald-500/30'}`}>
                                    {comparison.winRateDeviation.toFixed(1)}%
                                </Badge>
                            </div>

                            {/* Profit Factor */}
                            <div className="text-muted-foreground">Profit Factor</div>
                            <div className="text-center">{comparison.paperProfitFactor === Infinity ? '∞' : comparison.paperProfitFactor.toFixed(2)}</div>
                            <div className="text-center">{comparison.backtestProfitFactor.toFixed(2)}</div>
                            <div className="text-center">
                                <Badge variant="outline" className={`text-[9px] px-1 py-0 ${comparison.profitFactorDeviation > 0.5 ? 'text-red-400 border-red-500/30' : 'text-emerald-400 border-emerald-500/30'}`}>
                                    {comparison.profitFactorDeviation.toFixed(2)}
                                </Badge>
                            </div>

                            {/* Drawdown */}
                            <div className="text-muted-foreground">Max Drawdown</div>
                            <div className="text-center">{comparison.paperDrawdown.toFixed(1)}%</div>
                            <div className="text-center">{comparison.backtestDrawdown.toFixed(1)}%</div>
                            <div className="text-center">
                                <Badge variant="outline" className={`text-[9px] px-1 py-0 ${comparison.drawdownDeviation > 15 ? 'text-red-400 border-red-500/30' : 'text-emerald-400 border-emerald-500/30'}`}>
                                    {comparison.drawdownDeviation.toFixed(1)}%
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Chart */}
            {chartData.length > 1 && (
                <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Performance Comparada (%)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                        <div style={{ height: 280 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 11 }} />
                                    <Line type="monotone" dataKey="paper" name="Paper Trading" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                    {backtestResult && (
                                        <Line type="monotone" dataKey="backtest" name="Backtesting" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
