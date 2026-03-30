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
import { SignalPerformanceContext } from '@/utils/performanceEnricher';
import { ArrowUpRight, ArrowDownRight, Target, Clock, Activity, Shield, TrendingUp, Crosshair, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercentage } from '@/utils/formatters';
import { ExecuteTradeModal } from '@/components/trading/ExecuteTradeModal';
import { SignalCard } from './SignalCard';
import { useNavigate } from 'react-router-dom';

interface ActiveSignalsProps {
    signals: TradeSignal[];
    onSelectSignal?: (signal: TradeSignal) => void;
}

export const ActiveSignals = ({ signals, onSelectSignal }: ActiveSignalsProps) => {
    const [selectedSignal, setSelectedSignal] = useState<TradeSignal | null>(null);
    const [executeSignal, setExecuteSignal] = useState<TradeSignal | null>(null);
    const [executeModalOpen, setExecuteModalOpen] = useState(false);
    const [robotFilter, setRobotFilter] = useState<'ALL' | 'Main' | 'Scalping'>('ALL');
    const navigate = useNavigate();

    const isActive = (status: string) => status === 'active' || status === 'pending';
    
    const filteredByRobot = signals.filter(s => {
        if (robotFilter === 'ALL') return true;
        if (robotFilter === 'Scalping') return s.tradeType === 'Scalping';
        return s.tradeType !== 'Scalping'; // Tratamos tudo que não for Scalping como Principal
    });

    const activeSignals = filteredByRobot.filter(s => isActive(s.status));
    const closedSignals = filteredByRobot.filter(s => !isActive(s.status));

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

    return (
        <div className="trading-card animate-fade-up flex flex-col h-full">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-base font-semibold flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-primary" />
                    Sinais Ativos
                </h3>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5">
                        {filteredByRobot.length} Sinais
                    </Badge>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                        onClick={() => navigate('/signals-gallery')}
                        title="Ver em tela cheia"
                    >
                        <ArrowUpRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Robot Filter Switcher */}
            <div className="flex gap-2 mb-4">
                <Button 
                    variant={robotFilter === 'ALL' ? 'default' : 'outline'} 
                    size="sm" 
                    className="flex-1 h-7 text-[11px]" 
                    onClick={() => setRobotFilter('ALL')}
                >Mesa Geral</Button>
                <Button 
                    variant={robotFilter === 'Main' ? 'default' : 'outline'} 
                    size="sm" 
                    className="flex-1 h-7 text-[11px]" 
                    onClick={() => setRobotFilter('Main')}
                >Swing (4H)</Button>
                <Button 
                    variant={robotFilter === 'Scalping' ? 'default' : 'outline'} 
                    size="sm" 
                    className="flex-1 h-7 text-[11px]" 
                    onClick={() => setRobotFilter('Scalping')}
                >Scalping (5m)</Button>
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

                <TabsContent value="active" className="space-y-3 mt-0 flex-1 overflow-y-auto">
                    {activeSignals.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Target className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>Nenhum sinal ativo no momento</p>
                        </div>
                    ) : (
                        activeSignals.map(s => (
                            <SignalCard 
                                key={s.id} 
                                signal={s} 
                                onAnalyze={() => setSelectedSignal(s)} 
                                onExecute={() => { setExecuteSignal(s); setExecuteModalOpen(true); }} 
                            />
                        ))
                    )}
                </TabsContent>

                <TabsContent value="history" className="space-y-3 mt-0 flex-1 overflow-y-auto">
                    {closedSignals.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>Nenhum sinal no histórico</p>
                        </div>
                    ) : (
                        closedSignals.map(s => (
                            <SignalCard 
                                key={s.id} 
                                signal={s} 
                                onAnalyze={() => setSelectedSignal(s)} 
                                onExecute={() => { setExecuteSignal(s); setExecuteModalOpen(true); }} 
                            />
                        ))
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
                        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
                            {/* Smart Money ICT Badge */}
                            {(selectedSignal as any).smartMoney?.isLiquiditySweep && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-sm font-semibold">
                                    🐋 ESTRUTURA ICT DETECTADA — Liquidity Sweep (Caça de Stops)
                                </div>
                            )}
                            {(selectedSignal as any).smartMoney?.fvgZone && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-semibold">
                                    📊 Fair Value Gap (FVG) Detectado — Sinal de Desequilíbrio
                                </div>
                            )}

                            {/* Context Narrative */}
                            {(selectedSignal as any).contextNarrative && (
                                <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm text-foreground/80 italic">
                                    {(selectedSignal as any).contextNarrative}
                                </div>
                            )}

                            {/* Entry / TPs / SL */}
                            <div className="space-y-2 p-4 rounded-lg bg-muted/20 border border-border">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Entrada</span>
                                    <span className="text-lg font-mono font-bold text-primary">
                                        {formatCurrency(selectedSignal.entry)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-signal-buy">🎯 Alvo 1 (TP1)</span>
                                    <div className="text-right">
                                        <span className="text-base font-mono font-bold text-signal-buy">
                                            {formatCurrency(selectedSignal.takeProfit1 || selectedSignal.takeProfit)}
                                        </span>
                                        <span className="text-xs text-signal-buy/80 ml-2">
                                            +{formatPercentage(Math.abs(((selectedSignal.takeProfit1 || selectedSignal.takeProfit) - selectedSignal.entry) / selectedSignal.entry) * 100)}
                                        </span>
                                    </div>
                                </div>
                                {(selectedSignal as any).takeProfit2 && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-signal-buy/80">🎯 Alvo 2 (TP2)</span>
                                        <div className="text-right">
                                            <span className="text-base font-mono font-semibold text-signal-buy/80">
                                                {formatCurrency((selectedSignal as any).takeProfit2)}
                                            </span>
                                            <span className="text-xs text-signal-buy/60 ml-2">
                                                +{formatPercentage(Math.abs(((selectedSignal as any).takeProfit2 - selectedSignal.entry) / selectedSignal.entry) * 100)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {(selectedSignal as any).takeProfit3 && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-amber-400">🚀 Alvo 3 / Trailing Trigger</span>
                                        <div className="text-right">
                                            <span className="text-base font-mono font-semibold text-amber-400">
                                                {formatCurrency((selectedSignal as any).takeProfit3)}
                                            </span>
                                            <span className="text-xs text-amber-400/60 ml-2">
                                                +{formatPercentage(Math.abs(((selectedSignal as any).takeProfit3 - selectedSignal.entry) / selectedSignal.entry) * 100)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                                    <span className="text-sm text-signal-sell">🛡️ Stop Loss</span>
                                    <div className="text-right">
                                        <span className="text-base font-mono font-bold text-signal-sell">
                                            {formatCurrency(selectedSignal.stopLoss)}
                                        </span>
                                        <span className="text-xs text-signal-sell/80 ml-2">
                                            -{formatPercentage(Math.abs((selectedSignal.entry - selectedSignal.stopLoss) / selectedSignal.entry) * 100)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* MTF Context */}
                            {(selectedSignal as any).mtfContext && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4" /> Contexto Multi-Timeframe
                                    </h4>
                                    <div className="space-y-1.5">
                                        {(selectedSignal as any).mtfContext.macro?.map((item: string, i: number) => (
                                            <div key={i} className="text-xs p-2 rounded bg-muted/40 border border-border/50 text-foreground/80">
                                                📊 <span className="font-medium">Macro (4H):</span> {item}
                                            </div>
                                        ))}
                                        {(selectedSignal as any).mtfContext.medium?.map((item: string, i: number) => (
                                            <div key={i} className="text-xs p-2 rounded bg-muted/40 border border-border/50 text-foreground/80">
                                                📈 <span className="font-medium">Médio:</span> {item}
                                            </div>
                                        ))}
                                        {(selectedSignal as any).mtfContext.micro?.map((item: string, i: number) => (
                                            <div key={i} className="text-xs p-2 rounded bg-muted/40 border border-border/50 text-foreground/80">
                                                🔍 <span className="font-medium">Micro (15m):</span> {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Technical Confluences */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium flex items-center gap-2">
                                    <Activity className="w-4 h-4" /> Confluências Técnicas
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
                                {selectedSignal.indicators && selectedSignal.indicators.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {(selectedSignal.indicators as any[]).map((ind: any, i: number) => {
                                            const label = typeof ind === 'string' ? ind : ind.name;
                                            const isICT = label?.includes('Liquidity Sweep') || label?.includes('FVG');
                                            const isVWAP = label?.includes('VWAP') || label?.includes('Anchored');
                                            return (
                                                <span key={i} className={cn(
                                                    "text-[10px] px-2 py-0.5 rounded-full border font-medium",
                                                    isICT ? "bg-amber-500/15 border-amber-500/30 text-amber-400" :
                                                    isVWAP ? "bg-blue-500/15 border-blue-500/30 text-blue-400" :
                                                    "bg-primary/10 border-primary/20 text-primary"
                                                )}>
                                                    {label}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 mt-2">
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

            {/* Execute Trade Modal */}
            <ExecuteTradeModal
                open={executeModalOpen}
                onClose={() => { setExecuteModalOpen(false); setExecuteSignal(null); }}
                signal={executeSignal ? {
                    id: executeSignal.id,
                    symbol: executeSignal.symbol || executeSignal.pair,
                    direction: executeSignal.type as 'long' | 'short',
                    currentPrice: executeSignal.currentPrice || executeSignal.entry,
                    entryZone: {
                        min: executeSignal.entryZone?.low ?? (executeSignal.entry * 0.998),
                        max: executeSignal.entryZone?.high ?? (executeSignal.entry * 1.002),
                    },
                    stopLoss: {
                        price: executeSignal.stopLoss,
                        percent: executeSignal.stopLossPercent ?? Math.abs((executeSignal.stopLoss - executeSignal.entry) / executeSignal.entry * 100),
                    },
                    takeProfits: [
                        { level: 1, price: executeSignal.takeProfit1 || executeSignal.takeProfit, percent: Math.abs(((executeSignal.takeProfit1 || executeSignal.takeProfit) - executeSignal.entry) / executeSignal.entry * 100) },
                        ...(executeSignal.takeProfit2 ? [{ level: 2, price: executeSignal.takeProfit2, percent: Math.abs((executeSignal.takeProfit2 - executeSignal.entry) / executeSignal.entry * 100) }] : []),
                    ],
                    leverage: executeSignal.leverage || 5,
                    riskPercent: executeSignal.riskPercent || 2,
                    riskReward: parseFloat(getRR(executeSignal)),
                    quality: executeSignal.quality,
                    confidence: executeSignal.confidence || 0,
                } : null}
            />
        </div>
    );
};
