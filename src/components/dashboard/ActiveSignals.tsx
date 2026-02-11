import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TradeSignal } from '@/types/trading';
import { ArrowUpRight, ArrowDownRight, Target, Clock, Activity, Shield, TrendingUp, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercentage } from '@/utils/formatters';

interface ActiveSignalsProps {
    signals: TradeSignal[];
    onSelectSignal?: (signal: TradeSignal) => void;
}

export const ActiveSignals = ({ signals, onSelectSignal }: ActiveSignalsProps) => {
    const [selectedSignal, setSelectedSignal] = useState<TradeSignal | null>(null);

    const activeSignals = signals.filter(s => s.status === 'active');
    const closedSignals = signals.filter(s => s.status !== 'active');

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

    const renderSignalCard = (signal: TradeSignal) => {
        const isLong = signal.type === 'long';
        const score = signal.quality?.score || 0;
        const confidence = signal.confidence ?? (score * 0.95);

        return (
            <div
                key={signal.id}
                className="p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => setSelectedSignal(signal)}
            >
                {/* Row 1: Symbol + Direction + Status */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <img
                            src={`https://unavatar.io/crypto/${signal.pair.replace('USDT', '')}`}
                            alt={signal.pair}
                            className="w-6 h-6 rounded-full"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                        <span className="font-bold text-foreground">{signal.pair}</span>
                        <Badge
                            variant="outline"
                            className={cn(
                                "font-bold text-[10px] px-1.5 py-0",
                                isLong
                                    ? "bg-signal-buy/10 text-signal-buy border-signal-buy/20"
                                    : "bg-signal-sell/10 text-signal-sell border-signal-sell/20"
                            )}
                        >
                            {isLong ? 'LONG' : 'SHORT'}
                        </Badge>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0">
                        {signal.status === 'active' ? 'Ativo' : signal.status}
                    </Badge>
                </div>

                {/* Row 2: Timeframe + Time */}
                <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {signal.timeframe || '4H'}
                    </span>
                    <span>{getRelativeTime(new Date(signal.createdAt).getTime())}</span>
                </div>

                {/* Row 3: Entry / TP / SL — VERTICAL rows, label left value right */}
                <div className="space-y-1.5 mb-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Entrada</span>
                        <span className="text-sm font-mono font-bold text-primary">
                            {formatCurrency(signal.entry)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-signal-buy">TP (Principal)</span>
                        <span className="text-sm font-mono font-bold text-signal-buy">
                            {formatCurrency(signal.takeProfit)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-signal-sell">Stop Loss</span>
                        <span className="text-sm font-mono font-bold text-signal-sell">
                            {formatCurrency(signal.stopLoss)}
                        </span>
                    </div>
                </div>

                {/* Row 4: Multi-TP rows (if available) */}
                {(signal.takeProfit1 || signal.takeProfit2 || signal.takeProfit3) && (
                    <div className="space-y-1 mb-3 p-2.5 rounded-lg bg-muted/10 border border-border/30">
                        {signal.takeProfit1 && (
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground">TP1 (1.5R)</span>
                                <span className="text-xs font-mono text-signal-buy">{formatCurrency(signal.takeProfit1)}</span>
                            </div>
                        )}
                        {signal.takeProfit2 && (
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground">TP2 (2.5R)</span>
                                <span className="text-xs font-mono text-signal-buy">{formatCurrency(signal.takeProfit2)}</span>
                            </div>
                        )}
                        {signal.takeProfit3 && (
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground">TP3 (4R)</span>
                                <span className="text-xs font-mono text-signal-buy">{formatCurrency(signal.takeProfit3)}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Row 5: R:R + Score + Confidence — also vertical rows */}
                <div className="space-y-2 mb-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                            <Shield className="w-3.5 h-3.5" /> Risco/Retorno
                        </span>
                        <span className="font-mono font-bold text-foreground">1:{getRR(signal)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" /> Qualidade do Sinal
                        </span>
                        <span className={cn(
                            "font-bold",
                            score >= 80 ? "text-signal-buy" : score >= 50 ? "text-warning" : "text-signal-sell"
                        )}>{score}/100</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all",
                                score >= 80 ? "bg-signal-buy" : score >= 50 ? "bg-warning" : "bg-signal-sell"
                            )}
                            style={{ width: `${score}%` }}
                        />
                    </div>

                    {confidence > 0 && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <Crosshair className="w-3.5 h-3.5" /> Confiança IA
                            </span>
                            <span className="font-bold text-foreground">{Math.round(confidence)}%</span>
                        </div>
                    )}

                    {signal.mlData && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <Activity className="w-3.5 h-3.5 text-blue-400" /> Score ML (Beta)
                            </span>
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "font-bold",
                                    signal.mlData.probability > 0.6 ? "text-green-400" : "text-yellow-400"
                                )}>
                                    {(signal.mlData.probability * 100).toFixed(0)}%
                                </span>
                                {signal.mlData.predictedClass === 1 ? (
                                    <Badge variant="outline" className="text-[10px] h-5 bg-green-500/10 border-green-500/20 text-green-400">WIN</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] h-5 bg-red-500/10 border-red-500/20 text-red-400">LOSS</Badge>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Row 6: Confluence indicators as badges */}
                {signal.indicators && signal.indicators.length > 0 && (
                    <div className="pt-3 border-t border-border/50">
                        <p className="text-[10px] text-muted-foreground uppercase mb-2">Fatores de Confluência:</p>
                        <div className="flex flex-wrap gap-1.5">
                            {signal.indicators.slice(0, 5).map((ind, i) => (
                                <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-[10px] px-2 py-0.5 bg-muted/50 border-border text-muted-foreground"
                                >
                                    {ind}
                                </Badge>
                            ))}
                            {signal.indicators.length > 5 && (
                                <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-muted/50 border-border text-muted-foreground">
                                    +{signal.indicators.length - 5}
                                </Badge>
                            )}
                        </div>
                    </div>
                )}

                {/* Quality factors */}
                {signal.quality?.factors && signal.quality.factors.length > 0 && (
                    <div className="mt-2 space-y-1">
                        {signal.quality.factors.slice(0, 3).map((factor, i) => (
                            <p key={i} className="text-xs text-muted-foreground pl-2 border-l-2 border-muted">
                                {factor}
                            </p>
                        ))}
                        {signal.quality.factors.length > 3 && (
                            <p className="text-xs text-muted-foreground pl-2">
                                +{signal.quality.factors.length - 3} mais
                            </p>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="trading-card animate-fade-up">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Sinais Ativos
                </h3>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    {signals.length} Sinais
                </Badge>
            </div>

            <Tabs defaultValue="active" className="w-full">
                <TabsList className="w-full mb-4 bg-secondary">
                    <TabsTrigger value="active" className="flex-1">
                        Ativos ({activeSignals.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex-1">
                        Histórico ({closedSignals.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="space-y-3 mt-0">
                    {activeSignals.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Target className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>Nenhum sinal ativo no momento</p>
                        </div>
                    ) : (
                        activeSignals.map(renderSignalCard)
                    )}
                </TabsContent>

                <TabsContent value="history" className="space-y-3 mt-0">
                    {closedSignals.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>Nenhum sinal no histórico</p>
                        </div>
                    ) : (
                        closedSignals.map(renderSignalCard)
                    )}
                </TabsContent>
            </Tabs>

            {/* Signal Detail Modal */}
            <Dialog open={!!selectedSignal} onOpenChange={(open) => !open && setSelectedSignal(null)}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span className="text-xl">{selectedSignal?.pair}</span>
                            <Badge
                                variant={selectedSignal?.type === 'long' ? 'default' : 'destructive'}
                                className={cn(
                                    selectedSignal?.type === 'long' ? "bg-signal-buy hover:bg-signal-buy/90" : "bg-signal-sell hover:bg-signal-sell/90"
                                )}
                            >
                                {selectedSignal?.type === 'long' ? 'LONG' : 'SHORT'}
                            </Badge>
                        </DialogTitle>
                        <DialogDescription>
                            Detalhes do sinal gerado em {selectedSignal && new Date(selectedSignal.createdAt).toLocaleString()}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSignal && (
                        <div className="grid gap-4 py-4">
                            {/* Vertical list for entry/TP/SL in modal too */}
                            <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Entrada</span>
                                    <span className="text-lg font-mono font-bold text-primary">
                                        {formatCurrency(selectedSignal.entry)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-signal-buy">Alvo (TP)</span>
                                    <div className="text-right">
                                        <span className="text-lg font-mono font-bold text-signal-buy">
                                            {formatCurrency(selectedSignal.takeProfit)}
                                        </span>
                                        <span className="text-xs text-signal-buy/80 ml-2">
                                            +{formatPercentage(Math.abs((selectedSignal.takeProfit - selectedSignal.entry) / selectedSignal.entry) * 100)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-signal-sell">Stop Loss</span>
                                    <div className="text-right">
                                        <span className="text-lg font-mono font-bold text-signal-sell">
                                            {formatCurrency(selectedSignal.stopLoss)}
                                        </span>
                                        <span className="text-xs text-signal-sell/80 ml-2">
                                            -{formatPercentage(Math.abs((selectedSignal.entry - selectedSignal.stopLoss) / selectedSignal.entry) * 100)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-sm font-medium flex items-center gap-2">
                                    <Activity className="w-4 h-4" /> Análise Técnica
                                </h4>
                                <div className="bg-card p-3 rounded-lg border border-border text-sm space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Relação Risco/Retorno:</span>
                                        <span className="font-mono">1:{getRR(selectedSignal)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Score do Sinal:</span>
                                        <span className={cn(
                                            "font-bold",
                                            (selectedSignal.quality?.score || 0) >= 80 ? "text-signal-buy" : "text-warning"
                                        )}>{selectedSignal.quality?.score || 0}/100</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-4">
                                <Button variant="outline" onClick={() => setSelectedSignal(null)}>Fechar</Button>
                                <Button
                                    className={cn(
                                        "w-full sm:w-auto",
                                        selectedSignal.type === 'long' ? "bg-signal-buy hover:bg-signal-buy/90" : "bg-signal-sell hover:bg-signal-sell/90"
                                    )}
                                    onClick={() => {
                                        onSelectSignal?.(selectedSignal);
                                        setSelectedSignal(null);
                                    }}
                                >
                                    {selectedSignal.type === 'long' ? 'Abrir Long' : 'Abrir Short'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};
