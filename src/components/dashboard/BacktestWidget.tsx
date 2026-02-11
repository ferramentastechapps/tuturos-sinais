import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLatestResult } from '@/services/backtestService';
import { getActiveAlerts } from '@/services/backtestAlerts';
import { BacktestResult, BacktestAlert } from '@/types/backtestTypes';
import { BarChart3, CheckCircle2, AlertTriangle, ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const BacktestWidget = () => {
    const navigate = useNavigate();
    const [lastResult, setLastResult] = useState<BacktestResult | null>(null);
    const [alerts, setAlerts] = useState<BacktestAlert[]>([]);

    useEffect(() => {
        setLastResult(getLatestResult());
        setAlerts(getActiveAlerts());
    }, []);

    const getValidationStatus = () => {
        if (!lastResult) return { label: 'Sem dados', color: 'text-muted-foreground', bg: 'bg-muted/30', icon: <BarChart3 className="w-3.5 h-3.5" /> };

        const age = Date.now() - lastResult.timestamp;
        const maxAge = 7 * 24 * 60 * 60 * 1000;

        if (age > maxAge) return { label: 'Expirado', color: 'text-warning', bg: 'bg-warning/10', icon: <AlertTriangle className="w-3.5 h-3.5" /> };
        if (lastResult.metrics.main.totalPnL > 0 && lastResult.metrics.main.winRate > 45) {
            return { label: 'Validado', color: 'text-signal-buy', bg: 'bg-signal-buy/10', icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
        }
        return { label: 'Atenção', color: 'text-warning', bg: 'bg-warning/10', icon: <AlertTriangle className="w-3.5 h-3.5" /> };
    };

    const status = getValidationStatus();

    return (
        <div className="trading-card">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Backtesting</h2>
                </div>
                <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', status.bg, status.color)}>
                    {status.icon} {status.label}
                </span>
            </div>

            {lastResult ? (
                <>
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <MetricItem
                            label="Win Rate"
                            value={`${lastResult.metrics.main.winRate.toFixed(1)}%`}
                            positive={lastResult.metrics.main.winRate >= 50}
                        />
                        <MetricItem
                            label="Profit Factor"
                            value={lastResult.metrics.risk.profitFactor === Infinity ? '∞' : lastResult.metrics.risk.profitFactor.toFixed(2)}
                            positive={lastResult.metrics.risk.profitFactor >= 1.5}
                        />
                        <MetricItem
                            label="Max Drawdown"
                            value={`-${lastResult.metrics.risk.maxDrawdownPercent.toFixed(1)}%`}
                            positive={false}
                        />
                        <MetricItem
                            label="PnL"
                            value={`${lastResult.metrics.main.totalPnL >= 0 ? '+' : ''}${lastResult.metrics.main.totalPnLPercent.toFixed(1)}%`}
                            positive={lastResult.metrics.main.totalPnL >= 0}
                        />
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                        <span className="text-xs text-muted-foreground">
                            {new Date(lastResult.timestamp).toLocaleDateString('pt-BR')} · {lastResult.metrics.main.totalTrades} trades
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-primary h-7 px-2"
                            onClick={() => navigate('/backtesting')}
                        >
                            Detalhes <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                    </div>

                    {/* Alerts */}
                    {alerts.length > 0 && (
                        <div className="mt-3 p-2 rounded-lg bg-warning/10 border border-warning/20">
                            <span className="text-xs text-warning flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {alerts.length} alerta(s) de divergência
                            </span>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-6">
                    <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground mb-3">Nenhum backtest executado</p>
                    <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90"
                        onClick={() => navigate('/backtesting')}
                    >
                        <Zap className="w-4 h-4 mr-1" />
                        Rodar Primeiro Backtest
                    </Button>
                </div>
            )}
        </div>
    );
};

const MetricItem = ({ label, value, positive }: { label: string; value: string; positive: boolean }) => (
    <div className="space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={cn(
            'text-lg font-bold font-mono',
            positive ? 'text-signal-buy' : 'text-signal-sell'
        )}>
            {value}
        </p>
    </div>
);

export default BacktestWidget;
