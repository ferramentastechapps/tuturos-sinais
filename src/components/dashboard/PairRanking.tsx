import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PairStat } from '@/hooks/usePairStats';
import { Trophy, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PairRankingProps {
    topWinners: PairStat[];
    topLosers: PairStat[];
    isLoading?: boolean;
}

const PairRow = ({
    stat,
    rank,
    variant,
}: {
    stat: PairStat;
    rank: number;
    variant: 'win' | 'loss';
}) => {
    const isWin = variant === 'win';
    const barMax = isWin ? stat.wins : stat.losses;
    const barValue = isWin ? stat.wins : stat.losses;

    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0 group hover:bg-muted/30 px-2 rounded-lg transition-colors">
            {/* Rank */}
            <span className={cn(
                "text-xs font-bold w-5 text-center shrink-0",
                rank === 1 ? "text-yellow-500" : rank === 2 ? "text-slate-400" : rank === 3 ? "text-amber-700" : "text-muted-foreground/50"
            )}>
                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
            </span>

            {/* Pair name */}
            <span className="font-mono font-bold text-sm text-foreground min-w-[90px]">
                {stat.pair.replace('USDT', '')}
                <span className="text-muted-foreground font-normal text-[10px]">/USDT</span>
            </span>

            {/* Bar */}
            <div className="flex-1 relative h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                    className={cn(
                        "h-full rounded-full transition-all duration-700",
                        isWin ? "bg-signal-buy" : "bg-signal-sell"
                    )}
                    style={{ width: `${Math.min(100, (barValue / (barMax || 1)) * 100)}%` }}
                />
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2 shrink-0">
                <Badge className={cn(
                    "text-[10px] font-bold px-1.5 h-5 shadow-none",
                    isWin ? "bg-signal-buy/15 text-signal-buy hover:bg-signal-buy/20" : "bg-signal-sell/15 text-signal-sell hover:bg-signal-sell/20"
                )}>
                    {isWin ? `${stat.wins}W` : `${stat.losses}L`}
                </Badge>
                <span className={cn(
                    "text-[10px] font-medium font-mono",
                    stat.pnl > 0 ? "text-signal-buy" : "text-signal-sell"
                )}>
                    {stat.pnl > 0 ? '+' : ''}{stat.pnl.toFixed(1)}%
                </span>
                <span className="text-[10px] text-muted-foreground">
                    {stat.winRate.toFixed(0)}%
                </span>
            </div>
        </div>
    );
};

export function PairRanking({ topWinners, topLosers, isLoading }: PairRankingProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[0, 1].map(i => (
                    <Card key={i} className="bg-card border-border/50 shadow-sm animate-pulse">
                        <CardHeader className="pb-3">
                            <div className="h-5 w-40 bg-muted rounded" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {Array.from({ length: 5 }).map((_, j) => (
                                <div key={j} className="h-9 bg-muted/60 rounded-lg" />
                            ))}
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (topWinners.length === 0 && topLosers.length === 0) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Winners */}
            <Card className="bg-card border-border/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-signal-buy/5 blur-3xl rounded-full -z-0" />
                <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-signal-buy/15">
                            <Trophy className="w-3.5 h-3.5 text-signal-buy" />
                        </div>
                        Top 10 — Mais Wins
                        <Badge className="ml-auto bg-signal-buy/10 text-signal-buy border-signal-buy/20 hover:bg-signal-buy/15 text-[10px]">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            {topWinners.length} pares
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                    {topWinners.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Sem dados de win ainda.</p>
                    ) : (
                        topWinners.map((stat, i) => (
                            <PairRow key={stat.pair} stat={stat} rank={i + 1} variant="win" />
                        ))
                    )}
                </CardContent>
            </Card>

            {/* Top Losers */}
            <Card className="bg-card border-border/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-signal-sell/5 blur-3xl rounded-full -z-0" />
                <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-signal-sell/15">
                            <TrendingDown className="w-3.5 h-3.5 text-signal-sell" />
                        </div>
                        Top 10 — Mais Losses
                        <Badge className="ml-auto bg-signal-sell/10 text-signal-sell border-signal-sell/20 hover:bg-signal-sell/15 text-[10px]">
                            <TrendingDown className="w-3 h-3 mr-1" />
                            {topLosers.length} pares
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                    {topLosers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Sem dados de loss ainda.</p>
                    ) : (
                        topLosers.map((stat, i) => (
                            <PairRow key={stat.pair} stat={stat} rank={i + 1} variant="loss" />
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
