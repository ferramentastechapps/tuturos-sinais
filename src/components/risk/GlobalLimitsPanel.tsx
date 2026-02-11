import { useState } from 'react';
import { GlobalRiskLimits, CategoryLimit } from '@/types/riskProfiles';
import { AssetCategory } from '@/types/trading';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Save, Shield, DollarSign, Layers, AlertTriangle } from 'lucide-react';

interface GlobalLimitsPanelProps {
    limits: GlobalRiskLimits;
    onSave: (limits: Partial<GlobalRiskLimits>) => void;
}

const CATEGORY_LABELS: Record<AssetCategory, string> = {
    layer1: 'Layer 1',
    layer2: 'Layer 2',
    defi: 'DeFi',
    exchange: 'Exchange',
    meme: 'Memecoins',
    gaming: 'Gaming',
    ai: 'AI',
    infra: 'Infra',
    privacy: 'Privacy',
    rwa: 'RWA',
    trending: 'Trending',
    other: 'Outros',
};

export const GlobalLimitsPanel = ({ limits, onSave }: GlobalLimitsPanelProps) => {
    const [capital, setCapital] = useState(limits.portfolioCapital);
    const [maxPositions, setMaxPositions] = useState(limits.maxOpenPositions);
    const [maxCapital, setMaxCapital] = useState(limits.maxCapitalAllocated);
    const [dailyDD, setDailyDD] = useState(limits.maxDailyDrawdown);
    const [weeklyDD, setWeeklyDD] = useState(limits.maxWeeklyDrawdown);
    const [consecutiveLosses, setConsecutiveLosses] = useState(limits.maxConsecutiveLosses);
    const [categoryLimits, setCategoryLimits] = useState<CategoryLimit[]>(limits.maxPositionsPerCategory);

    const updateCategoryLimit = (category: AssetCategory, maxPos: number) => {
        setCategoryLimits(prev =>
            prev.map(c => c.category === category ? { ...c, maxPositions: maxPos } : c)
        );
    };

    const handleSave = () => {
        onSave({
            portfolioCapital: capital,
            maxOpenPositions: maxPositions,
            maxCapitalAllocated: maxCapital,
            maxDailyDrawdown: dailyDD,
            maxWeeklyDrawdown: weeklyDD,
            maxConsecutiveLosses: consecutiveLosses,
            maxPositionsPerCategory: categoryLimits,
        });
    };

    return (
        <div className="space-y-4">
            {/* Capital */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        Capital do Portfólio
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Label className="text-xs">Capital Total (USD)</Label>
                        <Input
                            type="number"
                            value={capital}
                            onChange={(e) => setCapital(+e.target.value)}
                            className="font-mono"
                            placeholder="10000"
                        />
                        <p className="text-xs text-muted-foreground">
                            Usado para calcular tamanho de posição e limites de drawdown
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Position Limits */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Limites de Posição
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Máximo de Posições Abertas</Label>
                            <span className="font-mono text-sm text-primary">{maxPositions}</span>
                        </div>
                        <Slider
                            value={[maxPositions]}
                            onValueChange={([v]) => setMaxPositions(v)}
                            min={1} max={20} step={1}
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Capital Máximo Alocado (%)</Label>
                            <span className="font-mono text-sm text-primary">{maxCapital}%</span>
                        </div>
                        <Slider
                            value={[maxCapital]}
                            onValueChange={([v]) => setMaxCapital(v)}
                            min={10} max={100} step={5}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Drawdown Limits */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        Limites de Drawdown
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Operações são bloqueadas automaticamente quando esses limites são atingidos
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs">Drawdown Diário Máx (%)</Label>
                            <Input
                                type="number" step="0.5"
                                value={dailyDD}
                                onChange={(e) => setDailyDD(+e.target.value)}
                                className="font-mono text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Drawdown Semanal Máx (%)</Label>
                            <Input
                                type="number" step="0.5"
                                value={weeklyDD}
                                onChange={(e) => setWeeklyDD(+e.target.value)}
                                className="font-mono text-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs">Perdas Consecutivas Máx</Label>
                        <div className="flex items-center gap-3">
                            <Slider
                                value={[consecutiveLosses]}
                                onValueChange={([v]) => setConsecutiveLosses(v)}
                                min={1} max={10} step={1}
                                className="flex-1"
                            />
                            <span className="font-mono text-sm w-6 text-right">{consecutiveLosses}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Category Limits */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" />
                        Máx Posições por Categoria
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {categoryLimits.map(({ category, maxPositions: max }) => (
                            <div key={category} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                                <Label className="text-xs truncate">{CATEGORY_LABELS[category] || category}</Label>
                                <Input
                                    type="number" min={0} max={10}
                                    value={max}
                                    onChange={(e) => updateCategoryLimit(category, +e.target.value)}
                                    className="w-14 h-7 text-xs font-mono text-center p-1"
                                />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            <Button onClick={handleSave} className="w-full flex items-center gap-2">
                <Save className="h-4 w-4" />
                Salvar Limites Globais
            </Button>
        </div>
    );
};
