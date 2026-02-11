import { useState } from 'react';
import { AssetRiskConfig, RiskProfileType } from '@/types/riskProfiles';
import { RISK_PROFILES } from '@/data/riskProfileDefaults';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RotateCcw, Save, Crosshair, TrendingUp, Filter, Shield } from 'lucide-react';

interface RiskConfigEditorProps {
    config: AssetRiskConfig | null;
    open: boolean;
    onClose: () => void;
    onSave: (symbol: string, partial: Partial<AssetRiskConfig>) => void;
    onReset: (symbol: string) => void;
}

export const RiskConfigEditor = ({ config, open, onClose, onSave, onReset }: RiskConfigEditorProps) => {
    if (!config) return null;

    // Leverage
    const [leverageMax, setLeverageMax] = useState(config.leverage.max);
    const [leverageSuggested, setLeverageSuggested] = useState(config.leverage.suggested);
    const [autoAdjust, setAutoAdjust] = useState(config.leverage.autoAdjust);

    // Stop Loss
    const [slMin, setSlMin] = useState(config.stopLoss.min);
    const [slMax, setSlMax] = useState(config.stopLoss.max);
    const [atrMultiplier, setAtrMultiplier] = useState(config.stopLoss.atrMultiplier);
    const [useTrailing, setUseTrailing] = useState(config.stopLoss.useTrailingStop);
    const [trailingDistance, setTrailingDistance] = useState(config.stopLoss.trailingDistance);

    // Take Profit
    const [tp1Pct, setTp1Pct] = useState(config.takeProfit.tp1.percent);
    const [tp1Close, setTp1Close] = useState(config.takeProfit.tp1.closePercent);
    const [tp2Pct, setTp2Pct] = useState(config.takeProfit.tp2.percent);
    const [tp2Close, setTp2Close] = useState(config.takeProfit.tp2.closePercent);
    const [tp3Pct, setTp3Pct] = useState(config.takeProfit.tp3.percent);
    const [tp3Close, setTp3Close] = useState(config.takeProfit.tp3.closePercent);
    const [useFib, setUseFib] = useState(config.takeProfit.useFibonacci);

    // Position
    const [maxRisk, setMaxRisk] = useState(config.position.maxRiskPercent);
    const [maxPosition, setMaxPosition] = useState(config.position.maxPositionPercent);
    const [minRR, setMinRR] = useState(config.position.minRiskReward);

    // Filters
    const [minVolume, setMinVolume] = useState(config.filters.minVolume24h);
    const [avoidFunding, setAvoidFunding] = useState(config.filters.avoidHighFunding);
    const [maxFunding, setMaxFunding] = useState(config.filters.maxFundingRate);

    const handleSave = () => {
        onSave(config.symbol, {
            leverage: { min: 1, max: leverageMax, suggested: leverageSuggested, autoAdjust },
            stopLoss: { min: slMin, max: slMax, atrMultiplier, useTrailingStop: useTrailing, trailingDistance },
            takeProfit: {
                tp1: { percent: tp1Pct, closePercent: tp1Close },
                tp2: { percent: tp2Pct, closePercent: tp2Close },
                tp3: { percent: tp3Pct, closePercent: tp3Close },
                useFibonacci: useFib,
            },
            position: { maxRiskPercent: maxRisk, maxPositionPercent: maxPosition, minRiskReward: minRR },
            filters: {
                ...config.filters,
                minVolume24h: minVolume,
                avoidHighFunding: avoidFunding,
                maxFundingRate: maxFunding,
            },
        });
        onClose();
    };

    const handleReset = () => {
        onReset(config.symbol);
        onClose();
    };

    const profile = RISK_PROFILES[config.riskProfile];

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        {config.symbol} — {config.name}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2">
                        Perfil: <Badge variant="outline">{profile.label}</Badge>
                        <span className="text-muted-foreground">|</span>
                        Categoria: <Badge variant="secondary">{config.category}</Badge>
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="leverage" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="leverage" className="text-xs">Alavancagem</TabsTrigger>
                        <TabsTrigger value="stoploss" className="text-xs">Stop Loss</TabsTrigger>
                        <TabsTrigger value="takeprofit" className="text-xs">Take Profit</TabsTrigger>
                        <TabsTrigger value="filters" className="text-xs">Posição & Filtros</TabsTrigger>
                    </TabsList>

                    {/* Leverage Tab */}
                    <TabsContent value="leverage" className="space-y-4 mt-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Alavancagem Máxima</Label>
                                <span className="font-mono text-sm text-primary">{leverageMax}x</span>
                            </div>
                            <Slider
                                value={[leverageMax]}
                                onValueChange={([v]) => setLeverageMax(v)}
                                min={1} max={20} step={1}
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Alavancagem Sugerida</Label>
                                <span className="font-mono text-sm text-primary">{leverageSuggested}x</span>
                            </div>
                            <Slider
                                value={[leverageSuggested]}
                                onValueChange={([v]) => setLeverageSuggested(v)}
                                min={1} max={leverageMax} step={1}
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="space-y-0.5">
                                <Label>Ajuste Automático</Label>
                                <p className="text-xs text-muted-foreground">
                                    Ajusta alavancagem conforme volatilidade do mercado
                                </p>
                            </div>
                            <Switch checked={autoAdjust} onCheckedChange={setAutoAdjust} />
                        </div>
                    </TabsContent>

                    {/* Stop Loss Tab */}
                    <TabsContent value="stoploss" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Stop Loss Mínimo (%)</Label>
                                <Input
                                    type="number" step="0.1"
                                    value={slMin}
                                    onChange={(e) => setSlMin(+e.target.value)}
                                    className="font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Stop Loss Máximo (%)</Label>
                                <Input
                                    type="number" step="0.1"
                                    value={slMax}
                                    onChange={(e) => setSlMax(+e.target.value)}
                                    className="font-mono"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Multiplicador ATR</Label>
                            <div className="flex items-center gap-3">
                                <Slider
                                    value={[atrMultiplier]}
                                    onValueChange={([v]) => setAtrMultiplier(v)}
                                    min={0.5} max={4} step={0.1}
                                    className="flex-1"
                                />
                                <span className="font-mono text-sm w-10 text-right">{atrMultiplier}x</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="space-y-0.5">
                                <Label>Trailing Stop</Label>
                                <p className="text-xs text-muted-foreground">
                                    Move o stop automaticamente a favor da operação
                                </p>
                            </div>
                            <Switch checked={useTrailing} onCheckedChange={setUseTrailing} />
                        </div>

                        {useTrailing && (
                            <div className="space-y-2">
                                <Label>Distância do Trailing (%)</Label>
                                <Input
                                    type="number" step="0.1"
                                    value={trailingDistance}
                                    onChange={(e) => setTrailingDistance(+e.target.value)}
                                    className="font-mono"
                                />
                            </div>
                        )}
                    </TabsContent>

                    {/* Take Profit Tab */}
                    <TabsContent value="takeprofit" className="space-y-4 mt-4">
                        {[
                            { label: 'TP1', pct: tp1Pct, setPct: setTp1Pct, close: tp1Close, setClose: setTp1Close },
                            { label: 'TP2', pct: tp2Pct, setPct: setTp2Pct, close: tp2Close, setClose: setTp2Close },
                            { label: 'TP3', pct: tp3Pct, setPct: setTp3Pct, close: tp3Close, setClose: setTp3Close },
                        ].map(({ label, pct, setPct, close, setClose }) => (
                            <div key={label} className="p-3 rounded-lg bg-muted/50 space-y-3">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    {label}
                                </Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Alvo (%)</Label>
                                        <Input
                                            type="number" step="0.5"
                                            value={pct}
                                            onChange={(e) => setPct(+e.target.value)}
                                            className="font-mono text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Fechar (%)</Label>
                                        <Input
                                            type="number" step="5"
                                            value={close}
                                            onChange={(e) => setClose(+e.target.value)}
                                            className="font-mono text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="space-y-0.5">
                                <Label>Extensões Fibonacci</Label>
                                <p className="text-xs text-muted-foreground">Usar extensões de Fib nos TPs</p>
                            </div>
                            <Switch checked={useFib} onCheckedChange={setUseFib} />
                        </div>

                        {/* Close % total validation */}
                        <div className="text-xs text-muted-foreground text-right">
                            Total fechamento: {tp1Close + tp2Close + tp3Close}%
                            {tp1Close + tp2Close + tp3Close !== 100 && (
                                <span className="text-destructive ml-1">(deve ser 100%)</span>
                            )}
                        </div>
                    </TabsContent>

                    {/* Position & Filters Tab */}
                    <TabsContent value="filters" className="space-y-4 mt-4">
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Crosshair className="h-3 w-3" /> Posição
                            </Label>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Risco Máx (%)</Label>
                                    <Input
                                        type="number" step="0.1"
                                        value={maxRisk}
                                        onChange={(e) => setMaxRisk(+e.target.value)}
                                        className="font-mono text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Posição Máx (%)</Label>
                                    <Input
                                        type="number" step="1"
                                        value={maxPosition}
                                        onChange={(e) => setMaxPosition(+e.target.value)}
                                        className="font-mono text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">R:R Mínimo</Label>
                                    <Input
                                        type="number" step="0.1"
                                        value={minRR}
                                        onChange={(e) => setMinRR(+e.target.value)}
                                        className="font-mono text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Filter className="h-3 w-3" /> Filtros
                            </Label>

                            <div className="space-y-2">
                                <Label className="text-xs">Volume Mínimo 24h (USD)</Label>
                                <Select
                                    value={String(minVolume)}
                                    onValueChange={(v) => setMinVolume(+v)}
                                >
                                    <SelectTrigger className="font-mono text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5000000">$5M</SelectItem>
                                        <SelectItem value="20000000">$20M</SelectItem>
                                        <SelectItem value="50000000">$50M</SelectItem>
                                        <SelectItem value="100000000">$100M</SelectItem>
                                        <SelectItem value="500000000">$500M</SelectItem>
                                        <SelectItem value="1000000000">$1B</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                <div className="space-y-0.5">
                                    <Label>Evitar Funding Alto</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Não entrar quando funding &gt; {maxFunding}%
                                    </p>
                                </div>
                                <Switch checked={avoidFunding} onCheckedChange={setAvoidFunding} />
                            </div>

                            {avoidFunding && (
                                <div className="space-y-2">
                                    <Label className="text-xs">Funding Rate Máximo (%)</Label>
                                    <Input
                                        type="number" step="0.01"
                                        value={maxFunding}
                                        onChange={(e) => setMaxFunding(+e.target.value)}
                                        className="font-mono text-sm"
                                    />
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={handleReset} className="flex items-center gap-1">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Resetar ao Padrão
                    </Button>
                    <div className="flex gap-2 ml-auto">
                        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                        <Button onClick={handleSave} className="flex items-center gap-1">
                            <Save className="h-3.5 w-3.5" />
                            Salvar
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
