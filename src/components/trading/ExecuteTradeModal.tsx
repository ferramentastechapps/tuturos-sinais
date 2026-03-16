import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AlertTriangle, TrendingUp, TrendingDown, Zap, Shield, Target, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface Signal {
    id: string;
    symbol: string;
    direction: 'long' | 'short';
    currentPrice: number;
    entryZone: { min: number; max: number };
    stopLoss: { price: number; percent: number };
    takeProfits: { level: number; price: number; percent: number }[];
    leverage: number;
    riskPercent: number;
    riskReward: number;
    quality?: { score: number; label: string };
    confidence: number;
}

interface ExecuteTradeModalProps {
    signal: Signal | null;
    open: boolean;
    onClose: () => void;
}

export function ExecuteTradeModal({ signal, open, onClose }: ExecuteTradeModalProps) {
    const [riskPercent, setRiskPercent] = useState(2);
    const [leverage, setLeverage] = useState(signal?.leverage ?? 5);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'confirm' | 'executing' | 'done'>('confirm');

    if (!signal) return null;

    const score = signal.quality?.score ?? signal.confidence;
    const isLong = signal.direction === 'long';
    const tp1 = signal.takeProfits[0];
    const tp2 = signal.takeProfits[1];

    const handleExecute = async () => {
        setLoading(true);
        setStep('executing');

        try {
            const { data } = await axios.post(`${API_BASE}/api/trade/execute`, {
                symbol: signal.symbol,
                direction: signal.direction,
                entryPrice: signal.currentPrice,
                stopLoss: signal.stopLoss.price,
                takeProfit1: tp1?.price,
                takeProfit2: tp2?.price,
                leverage,
                riskPercent,
                signalScore: score,
            });

            if (data.success) {
                toast.success(`✅ Ordem ${signal.direction.toUpperCase()} executada para ${signal.symbol}!`, {
                    description: `Qty: ${data.qty} | ID: ${data.orderId?.slice(0, 12)}...`,
                    duration: 8000,
                });
                setStep('done');
                setTimeout(onClose, 1500);
            } else {
                throw new Error(data.error || 'Erro desconhecido');
            }
        } catch (error: any) {
            const msg = error.response?.data?.error || error.message;
            toast.error('❌ Falha na execução', { description: msg, duration: 6000 });
            setStep('confirm');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md border-border bg-[#0D1128] text-foreground">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Zap className="w-5 h-5 text-amber-400" />
                        Executar Trade REAL
                        <Badge
                            className={cn(
                                'ml-auto text-[10px] font-bold',
                                isLong ? 'bg-emerald-500/20 text-emerald-400 border-emerald-600' : 'bg-red-500/20 text-red-400 border-red-600'
                            )}
                            variant="outline"
                        >
                            {isLong ? 'LONG' : 'SHORT'} — {signal.symbol}
                        </Badge>
                    </DialogTitle>
                </DialogHeader>

                {/* Warning Banner */}
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="text-xs">Esta ordem será executada com <strong>fundos reais</strong> na Bybit. Revise todos os valores antes de confirmar.</span>
                </div>

                {/* Signal Summary */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-muted/30 p-3 space-y-1">
                        {isLong ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                        <p className="text-muted-foreground text-xs">Entrada Aprox.</p>
                        <p className="font-mono font-bold">${signal.currentPrice.toFixed(4)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-3 space-y-1">
                        <Shield className="w-4 h-4 text-red-400" />
                        <p className="text-muted-foreground text-xs">Stop Loss</p>
                        <p className="font-mono font-bold text-red-400">${signal.stopLoss.price.toFixed(4)} <span className="text-xs font-normal">(-{signal.stopLoss.percent.toFixed(1)}%)</span></p>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-3 space-y-1">
                        <Target className="w-4 h-4 text-emerald-400" />
                        <p className="text-muted-foreground text-xs">TP1 (Principal)</p>
                        <p className="font-mono font-bold text-emerald-400">${tp1?.price.toFixed(4)} <span className="text-xs font-normal">(+{tp1?.percent.toFixed(1)}%)</span></p>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-3 space-y-1">
                        <Target className="w-4 h-4 text-sky-400" />
                        <p className="text-muted-foreground text-xs">R:R Ratio</p>
                        <p className="font-mono font-bold text-sky-400">1:{signal.riskReward.toFixed(1)}</p>
                    </div>
                </div>

                {/* Risk Settings */}
                <div className="space-y-4 pt-1">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <Label>Risco por Trade</Label>
                            <span className="font-mono text-amber-400 font-bold">{riskPercent}%</span>
                        </div>
                        <Slider
                            min={0.5}
                            max={5}
                            step={0.5}
                            value={[riskPercent]}
                            onValueChange={([v]) => setRiskPercent(v)}
                            className="[&_[role=slider]]:bg-amber-400"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Conservador 0.5%</span>
                            <span>Agressivo 5%</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <Label>Alavancagem</Label>
                            <span className="font-mono text-sky-400 font-bold">{leverage}x</span>
                        </div>
                        <Slider
                            min={1}
                            max={20}
                            step={1}
                            value={[leverage]}
                            onValueChange={([v]) => setLeverage(v)}
                            className="[&_[role=slider]]:bg-sky-400"
                        />
                    </div>
                </div>

                {/* Score gate info */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 text-xs text-center text-muted-foreground">
                    Score do Sinal: <span className={cn('font-bold', score >= 80 ? 'text-emerald-400' : score >= 65 ? 'text-amber-400' : 'text-red-400')}>{score}/100</span>
                    {score < 65 && <span className="text-red-400 ml-1">— Abaixo do mínimo (65). Execução será bloqueada.</span>}
                </div>

                <DialogFooter className="gap-2 sm:gap-2 pt-1">
                    <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleExecute}
                        disabled={loading || score < 65 || step === 'done'}
                        className={cn(
                            'flex-1 font-bold',
                            isLong
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-red-600 hover:bg-red-500 text-white'
                        )}
                    >
                        {step === 'executing' ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executando...</>
                        ) : step === 'done' ? (
                            '✅ Executado!'
                        ) : (
                            `Confirmar ${isLong ? 'LONG' : 'SHORT'}`
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
