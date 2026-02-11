// Paper Header — Wallet overview with balance, PnL, mode toggle
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RefreshCcw, TrendingUp, TrendingDown, Wallet, Target, BarChart3 } from 'lucide-react';
import { PaperPortfolioState, PaperTradingMode } from '@/types/paperTrading';
import { PaperMetrics } from '@/types/paperTrading';

interface PaperHeaderProps {
    state: PaperPortfolioState;
    metrics: PaperMetrics | null;
    onModeChange: (mode: PaperTradingMode) => void;
    onReset: () => void;
}

export const PaperHeader = ({ state, metrics, onModeChange, onReset }: PaperHeaderProps) => {
    const totalPnL = state.equity - state.config.initialBalance;
    const totalPnLPercent = (totalPnL / state.config.initialBalance) * 100;
    const isProfit = totalPnL >= 0;
    const isAuto = state.mode === 'automatic';

    const stats = [
        {
            label: 'Saldo Inicial',
            value: `$${state.config.initialBalance.toLocaleString()}`,
            icon: Wallet,
            color: 'text-muted-foreground',
        },
        {
            label: 'Equity Atual',
            value: `$${state.equity.toFixed(2)}`,
            icon: isProfit ? TrendingUp : TrendingDown,
            color: isProfit ? 'text-emerald-400' : 'text-red-400',
        },
        {
            label: 'PnL Total',
            value: `${isProfit ? '+' : ''}$${totalPnL.toFixed(2)} (${totalPnLPercent.toFixed(1)}%)`,
            icon: Target,
            color: isProfit ? 'text-emerald-400' : 'text-red-400',
        },
        {
            label: 'Operações',
            value: `${(metrics?.totalTrades || 0)}`,
            icon: BarChart3,
            color: 'text-blue-400',
        },
        {
            label: 'Win Rate',
            value: `${(metrics?.winRate || 0).toFixed(1)}%`,
            icon: Target,
            color: (metrics?.winRate || 0) >= 55 ? 'text-emerald-400' : 'text-amber-400',
        },
    ];

    return (
        <div className="space-y-3">
            {/* PAPER TRADING badge + mode */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs px-2 py-0.5">
                        📄 PAPER TRADING — SIMULAÇÃO
                    </Badge>
                    <Badge variant="outline" className={`text-xs px-2 py-0.5 ${isAuto ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'}`}>
                        {isAuto ? '🤖 Automático' : '🖐 Manual'}
                    </Badge>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Auto</span>
                        <Switch
                            checked={isAuto}
                            onCheckedChange={(v) => onModeChange(v ? 'automatic' : 'manual')}
                        />
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-red-400">
                                <RefreshCcw className="h-3 w-3" />
                                Resetar
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Resetar Carteira Virtual?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Todas as posições abertas e histórico serão apagados. A carteira voltará para o saldo inicial de ${state.config.initialBalance.toLocaleString()} USDT. Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={onReset} className="bg-red-600 hover:bg-red-700">
                                    Resetar
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {stats.map((s) => (
                    <Card key={s.label} className="bg-card/50 border-border/50">
                        <CardContent className="p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
                            </div>
                            <span className={`text-sm font-semibold ${s.color}`}>{s.value}</span>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Period PnL */}
            {metrics && metrics.totalTrades > 0 && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                        Hoje: <span className={metrics.pnlToday >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {metrics.pnlToday >= 0 ? '+' : ''}{metrics.pnlToday.toFixed(2)}
                        </span>
                    </span>
                    <span>
                        Semana: <span className={metrics.pnlWeek >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {metrics.pnlWeek >= 0 ? '+' : ''}{metrics.pnlWeek.toFixed(2)}
                        </span>
                    </span>
                    <span>
                        Mês: <span className={metrics.pnlMonth >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {metrics.pnlMonth >= 0 ? '+' : ''}{metrics.pnlMonth.toFixed(2)}
                        </span>
                    </span>
                </div>
            )}
        </div>
    );
};
