// Paper Positions — Open position cards with real-time PnL
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X, Clock, Brain, Target } from 'lucide-react';
import { PaperPosition } from '@/types/paperTrading';

interface PaperPositionsProps {
    positions: PaperPosition[];
    onClose: (positionId: string) => void;
}

const formatDuration = (ms: number): string => {
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ${mins % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
};

const calculateTPProgress = (
    entry: number,
    current: number,
    target: number,
    direction: 'long' | 'short',
): number => {
    const totalDistance = direction === 'long' ? target - entry : entry - target;
    if (totalDistance <= 0) return 0;
    const currentDistance = direction === 'long' ? current - entry : entry - current;
    return Math.max(0, Math.min(100, (currentDistance / totalDistance) * 100));
};

export const PaperPositions = ({ positions, onClose }: PaperPositionsProps) => {
    if (positions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Target className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Nenhuma posição aberta</p>
                <p className="text-xs mt-1 opacity-60">Abra uma posição a partir dos sinais ou ative o modo automático</p>
            </div>
        );
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {positions.map((pos) => {
                const isLong = pos.direction === 'long';
                const isProfit = pos.unrealizedPnl >= 0;
                const timeOpen = Date.now() - pos.entryTime;
                const tp1Progress = calculateTPProgress(pos.entryPrice, pos.currentPrice, pos.takeProfit1, pos.direction);
                const tp2Progress = pos.takeProfit2
                    ? calculateTPProgress(pos.entryPrice, pos.currentPrice, pos.takeProfit2, pos.direction)
                    : null;

                return (
                    <Card key={pos.id} className="bg-card/50 border-border/50 relative overflow-hidden">
                        {/* Direction indicator bar */}
                        <div className={`absolute top-0 left-0 right-0 h-0.5 ${isLong ? 'bg-emerald-500' : 'bg-red-500'}`} />

                        <CardContent className="p-3 space-y-2.5">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm">{pos.symbol}</span>
                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${isLong ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                                        {isLong ? 'LONG' : 'SHORT'}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground">{pos.leverage}x</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-red-400"
                                    onClick={() => onClose(pos.id)}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>

                            {/* Prices */}
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                <div>
                                    <span className="text-muted-foreground">Entrada: </span>
                                    <span className="font-mono">{pos.entryPrice.toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Atual: </span>
                                    <span className="font-mono">{pos.currentPrice.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* PnL */}
                            <div className={`text-center py-1.5 rounded ${isProfit ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                                <span className={`text-sm font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {isProfit ? '+' : ''}{pos.unrealizedPnl.toFixed(2)} USDT
                                </span>
                                <span className={`text-xs ml-1.5 ${isProfit ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                                    ({pos.unrealizedPnlPercent.toFixed(1)}%)
                                </span>
                            </div>

                            {/* TP Progress Bars */}
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-[10px]">
                                    <span className="text-muted-foreground w-6">TP1</span>
                                    <Progress value={tp1Progress} className="h-1.5 flex-1" />
                                    <span className="font-mono w-14 text-right">{pos.takeProfit1.toFixed(2)}</span>
                                    {pos.tp1Hit && <span className="text-emerald-400">✓</span>}
                                </div>
                                {tp2Progress !== null && (
                                    <div className="flex items-center gap-2 text-[10px]">
                                        <span className="text-muted-foreground w-6">TP2</span>
                                        <Progress value={tp2Progress} className="h-1.5 flex-1" />
                                        <span className="font-mono w-14 text-right">{pos.takeProfit2!.toFixed(2)}</span>
                                        {pos.tp2Hit && <span className="text-emerald-400">✓</span>}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                                <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>{formatDuration(timeOpen)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span>SL: {pos.stopLoss.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Brain className="h-3 w-3" />
                                    <span>{pos.mlProbability.toFixed(0)}%</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};
