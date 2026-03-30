import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TradeSignal } from '@/types/trading';
import { Clock, Shield, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';

interface SignalCardProps {
    signal: TradeSignal;
    onAnalyze: (signal: TradeSignal) => void;
    onExecute: (signal: TradeSignal) => void;
}

const getRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
};

const getRR = (signal: TradeSignal) => {
    const risk = Math.abs(signal.entry - signal.stopLoss);
    const reward = Math.abs(signal.takeProfit - signal.entry);
    return risk > 0 ? (reward / risk).toFixed(2) : '0';
};

export function SignalCard({ signal, onAnalyze, onExecute }: SignalCardProps) {
    const isLong = signal.type === 'long';
    const score = signal.quality?.score || 0;
    const confidence = signal.confidence ?? (score * 0.95);

    return (
        <div
            className={cn(
                "p-3.5 rounded-xl border bg-card transition-all relative overflow-hidden group hover:border-primary/50 shadow-sm hover:shadow-md h-full flex flex-col",
                isLong ? "border-l-4 border-l-signal-buy" : "border-l-4 border-l-signal-sell"
            )}
        >
            {/* Score background gradient effect */}
            <div className={cn(
                "absolute top-0 right-0 w-32 h-32 opacity-[0.03] blur-2xl -z-10 group-hover:opacity-10 transition-opacity",
                isLong ? "bg-signal-buy" : "bg-signal-sell"
            )} />

            {/* Header: Direction, Symbol, Score */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", isLong ? "bg-signal-buy" : "bg-signal-sell")} />
                    <span className="font-bold text-[15px] text-foreground tracking-tight leading-none">{signal.pair}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={cn(
                        "font-bold font-mono text-[9px] px-1 py-0 shadow-none h-4 border-transparent",
                        isLong ? "bg-signal-buy/10 text-signal-buy" : "bg-signal-sell/10 text-signal-sell"
                    )}>
                        {isLong ? 'LONG' : 'SHORT'}
                    </Badge>
                    <span className={cn(
                        "font-mono text-[11px] font-bold flex items-center gap-0.5",
                        score >= 80 ? "text-signal-buy" : score >= 50 ? "text-warning" : "text-signal-sell"
                    )}>
                        ⚡{score}
                    </span>
                </div>
            </div>

            {/* Subheader: Trade Type & Duration */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground/80">{signal.tradeType || 'Day Trade'}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {signal.expectedDuration || signal.timeframe || '1h'}</span>
                {signal.status !== 'active' && signal.status !== 'pending' && (
                    <Badge className={cn("ml-1 h-4 text-[9px] px-1 shadow-none",
                        signal.status === 'hit_tp' ? 'bg-signal-buy hover:bg-signal-buy' : 
                        signal.status === 'hit_sl' ? 'bg-signal-sell hover:bg-signal-sell' : 'bg-muted text-muted-foreground'
                    )}>
                        {signal.status}
                    </Badge>
                )}
                <span className="ml-auto text-[9px] bg-muted/60 px-1.5 py-0.5 rounded-sm whitespace-nowrap">
                    {getRelativeTime(new Date(signal.createdAt).getTime())}
                </span>
            </div>

            <div className="w-full h-px bg-border/40 mb-3" />

            {/* Prices: Entry & Current/TP/SL context */}
            <div className="flex items-end justify-between mb-3 bg-muted/20 p-2 rounded-lg border border-border/40 flex-1">
                <div className="space-y-0.5">
                    <p className="text-[9px] text-muted-foreground uppercase font-medium tracking-wider">Entrada</p>
                    <p className="text-xs font-mono font-bold text-foreground leading-none">{formatCurrency(signal.entry)}</p>
                </div>
                {/* Target Progress */}
                <div className="space-y-0.5 text-right">
                    <p className="text-[9px] text-muted-foreground uppercase font-medium tracking-wider">{signal.status === 'active' ? 'Alvo TP1' : 'Alvo Final'}</p>
                    <p className={cn(
                        "text-xs font-mono font-bold leading-none",
                        isLong ? "text-signal-buy" : "text-signal-sell"
                    )}>
                        {formatCurrency(signal.takeProfit1 || signal.takeProfit)}
                    </p>
                </div>
            </div>
            
            {/* Risk and additional context */}
            <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-muted-foreground mb-3 px-1">
                <span className="flex items-center gap-1 font-medium"><Shield className="w-3 h-3 opacity-60" /> R:R 1:{getRR(signal)}</span>
                <span className="flex items-center gap-1 text-signal-sell font-bold">SL {formatCurrency(signal.stopLoss)}</span>
            </div>

            {/* Price Progress Bar */}
            {(() => {
                const current: number = (signal as any).currentPrice ?? signal.entry;
                const sl = signal.stopLoss;
                const tp = signal.takeProfit1 || signal.takeProfit;
                const range = Math.abs(tp - sl);
                const rawPct = range > 0 ? ((current - sl) / range) * 100 : 50;
                const pct = Math.min(100, Math.max(0, rawPct));
                const entryLow = (signal as any).entryZone?.low ?? signal.entry * 0.998;
                const entryHigh = (signal as any).entryZone?.high ?? signal.entry * 1.002;
                const inZone = current >= entryLow && current <= entryHigh;
                const entryPct = range > 0 ? Math.min(100, Math.max(0, ((signal.entry - sl) / range) * 100)) : 50;

                return (
                    <div className="mb-4 space-y-1.5 mt-auto">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="text-signal-sell font-medium">SL</span>
                            <span className="font-mono">{formatCurrency(current)}</span>
                            <span className={cn("font-medium", isLong ? "text-signal-buy" : "text-signal-sell")}>TP1</span>
                        </div>
                        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                            {/* Entry zone marker */}
                            <div
                                className="absolute top-0 h-full w-0.5 bg-primary/60 z-10"
                                style={{ left: `${entryPct}%` }}
                            />
                            {/* Progress fill */}
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    pct > entryPct
                                        ? (isLong ? "bg-signal-buy/70" : "bg-signal-sell/70")
                                        : "bg-muted-foreground/40"
                                )}
                                style={{ width: `${pct}%` }}
                            />
                            {/* Current price dot */}
                            <div
                                className={cn(
                                    "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ring-2 ring-card -translate-x-1/2",
                                    isLong ? "bg-signal-buy" : "bg-signal-sell"
                                )}
                                style={{ left: `${pct}%` }}
                            />
                        </div>
                        {inZone && (
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-signal-buy">
                                <Crosshair className="w-3 h-3" />
                                Em zona de entrada
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 w-full mt-auto">
                <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full bg-background hover:bg-muted hover:text-foreground font-semibold text-[10px] h-7 px-2 border-border/80 shadow-sm"
                    onClick={(e) => { e.stopPropagation(); onAnalyze(signal); }}
                >
                    📊 Analisar
                </Button>
                <Button 
                    size="sm"
                    className={cn(
                        "w-full font-semibold text-[10px] h-7 px-2 shadow-sm hover:shadow-md transition-all",
                        isLong ? "bg-signal-buy hover:bg-signal-buy/90 text-white" : "bg-signal-sell hover:bg-signal-sell/90 text-white"
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        onExecute(signal);
                    }}
                >
                    ⚡ Executar
                </Button>
            </div>
        </div>
    );
}
