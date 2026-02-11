// Paper Settings — Configuration panel
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings, DollarSign, Percent, Zap } from 'lucide-react';
import { PaperTradingConfig } from '@/types/paperTrading';

interface PaperSettingsProps {
    config: PaperTradingConfig;
    onUpdate: (config: Partial<PaperTradingConfig>) => void;
}

export const PaperSettings = ({ config, onUpdate }: PaperSettingsProps) => {
    const updateExecution = (field: string, value: number) => {
        onUpdate({
            execution: { ...config.execution, [field]: value },
        });
    };

    const updateAutoTrade = (field: string, value: number | boolean) => {
        onUpdate({
            autoTrade: { ...config.autoTrade, [field]: value },
        });
    };

    return (
        <div className="space-y-4">
            {/* Wallet Config */}
            <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                        <DollarSign className="h-4 w-4" />
                        Carteira Virtual
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Saldo Inicial (USDT)</Label>
                            <Input
                                type="number"
                                value={config.initialBalance}
                                onChange={(e) => onUpdate({ initialBalance: Number(e.target.value) })}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Moeda</Label>
                            <Input value={config.currency} disabled className="h-8 text-xs" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Execution Config */}
            <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                        <Percent className="h-4 w-4" />
                        Simulação de Execução
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Spread (%)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={config.execution.spread}
                                onChange={(e) => updateExecution('spread', Number(e.target.value))}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Slippage (%)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={config.execution.slippage}
                                onChange={(e) => updateExecution('slippage', Number(e.target.value))}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Taxa Maker (%)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={config.execution.makerFee}
                                onChange={(e) => updateExecution('makerFee', Number(e.target.value))}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Taxa Taker (%)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={config.execution.takerFee}
                                onChange={(e) => updateExecution('takerFee', Number(e.target.value))}
                                className="h-8 text-xs"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Auto Trade Config */}
            <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                        <Zap className="h-4 w-4" />
                        Auto Trading
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Ativar Auto Trading</Label>
                        <Switch
                            checked={config.autoTrade.enabled}
                            onCheckedChange={(v) => updateAutoTrade('enabled', v)}
                        />
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Score Mínimo</Label>
                            <Input
                                type="number"
                                value={config.autoTrade.minScore}
                                onChange={(e) => updateAutoTrade('minScore', Number(e.target.value))}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">ML Prob. Mínima (%)</Label>
                            <Input
                                type="number"
                                value={config.autoTrade.minMLProbability}
                                onChange={(e) => updateAutoTrade('minMLProbability', Number(e.target.value))}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Max Posições</Label>
                            <Input
                                type="number"
                                value={config.autoTrade.maxSimultaneousPositions}
                                onChange={(e) => updateAutoTrade('maxSimultaneousPositions', Number(e.target.value))}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Max Capital / Trade (%)</Label>
                            <Input
                                type="number"
                                value={config.autoTrade.maxCapitalPerTrade}
                                onChange={(e) => updateAutoTrade('maxCapitalPerTrade', Number(e.target.value))}
                                className="h-8 text-xs"
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                        No modo automático, o sistema abrirá posições para cada sinal que atender aos critérios acima.
                    </p>
                </CardContent>
            </Card>

            {/* Info */}
            <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                        <Settings className="h-4 w-4" />
                        Informações
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
                    <p>• Dados persistidos localmente no navegador</p>
                    <p>• Preços em tempo real da Binance</p>
                    <p>• Funding rate aplicado automaticamente a cada 8h</p>
                    <p>• Alterações no saldo inicial só afetam novas sessões</p>
                </CardContent>
            </Card>
        </div>
    );
};
