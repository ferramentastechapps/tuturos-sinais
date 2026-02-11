// Paper Metrics — Performance dashboard with equity curve
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
    TrendingUp, TrendingDown, Target, BarChart3, Percent, Activity,
    ArrowUp, ArrowDown, DollarSign, Zap,
} from 'lucide-react';
import { PaperMetrics as PaperMetricsType, PaperEquityPoint } from '@/types/paperTrading';

interface PaperMetricsProps {
    metrics: PaperMetricsType;
    equityCurve: PaperEquityPoint[];
}

const MetricCard = ({
    label, value, icon: Icon, color, subtext,
}: {
    label: string; value: string; icon: React.ElementType; color: string; subtext?: string;
}) => (
    <Card className="bg-card/50 border-border/50">
        <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
            </div>
            <span className={`text-sm font-semibold ${color}`}>{value}</span>
            {subtext && <p className="text-[10px] text-muted-foreground mt-0.5">{subtext}</p>}
        </CardContent>
    </Card>
);

export const PaperMetrics = ({ metrics, equityCurve }: PaperMetricsProps) => {
    const chartData = useMemo(
        () => equityCurve.map(p => ({
            time: new Date(p.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            equity: Number(p.equity.toFixed(2)),
        })),
        [equityCurve],
    );

    if (metrics.totalTrades === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Sem dados de performance</p>
                <p className="text-xs mt-1 opacity-60">Inicie operações para ver métricas</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                <MetricCard
                    label="Win Rate"
                    value={`${metrics.winRate.toFixed(1)}%`}
                    icon={Target}
                    color={metrics.winRate >= 55 ? 'text-emerald-400' : 'text-amber-400'}
                    subtext={`L: ${metrics.winRateLong.toFixed(0)}% | S: ${metrics.winRateShort.toFixed(0)}%`}
                />
                <MetricCard
                    label="Profit Factor"
                    value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
                    icon={TrendingUp}
                    color={metrics.profitFactor >= 1.3 ? 'text-emerald-400' : 'text-amber-400'}
                />
                <MetricCard
                    label="Sharpe Ratio"
                    value={metrics.sharpeRatio.toFixed(2)}
                    icon={Activity}
                    color={metrics.sharpeRatio >= 1 ? 'text-emerald-400' : 'text-amber-400'}
                />
                <MetricCard
                    label="Max Drawdown"
                    value={`${metrics.maxDrawdownPercent.toFixed(1)}%`}
                    icon={TrendingDown}
                    color={metrics.maxDrawdownPercent <= 15 ? 'text-emerald-400' : 'text-red-400'}
                    subtext={`$${metrics.maxDrawdown.toFixed(2)}`}
                />
                <MetricCard
                    label="Média Ganho"
                    value={`$${metrics.avgWin.toFixed(2)}`}
                    icon={ArrowUp}
                    color="text-emerald-400"
                />
                <MetricCard
                    label="Média Perda"
                    value={`$${metrics.avgLoss.toFixed(2)}`}
                    icon={ArrowDown}
                    color="text-red-400"
                />
                <MetricCard
                    label="Expectativa"
                    value={`$${metrics.expectancy.toFixed(2)}`}
                    icon={Zap}
                    color={metrics.expectancy > 0 ? 'text-emerald-400' : 'text-red-400'}
                    subtext="por operação"
                />
                <MetricCard
                    label="Taxas Totais"
                    value={`$${metrics.totalFees.toFixed(2)}`}
                    icon={DollarSign}
                    color="text-muted-foreground"
                />
                <MetricCard
                    label="Melhor Trade"
                    value={`+$${metrics.largestWin.toFixed(2)}`}
                    icon={ArrowUp}
                    color="text-emerald-400"
                />
                <MetricCard
                    label="Pior Trade"
                    value={`$${metrics.largestLoss.toFixed(2)}`}
                    icon={ArrowDown}
                    color="text-red-400"
                />
                <MetricCard
                    label="Seq. Ganhos"
                    value={`${metrics.maxConsecutiveWins}`}
                    icon={TrendingUp}
                    color="text-emerald-400"
                />
                <MetricCard
                    label="Seq. Perdas"
                    value={`${metrics.maxConsecutiveLosses}`}
                    icon={TrendingDown}
                    color="text-red-400"
                />
            </div>

            {/* Equity Curve */}
            {chartData.length > 1 && (
                <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-1.5">
                            <Percent className="h-4 w-4" />
                            Equity Curve
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                        <div style={{ height: 250 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={['auto', 'auto']} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="equity"
                                        name="Equity"
                                        stroke="#22c55e"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
