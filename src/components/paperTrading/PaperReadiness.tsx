// Paper Readiness — Live trading readiness indicator
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, MinusCircle, Shield, AlertTriangle, Rocket } from 'lucide-react';
import { PaperReadiness as PaperReadinessType } from '@/types/paperTrading';

interface PaperReadinessProps {
    readiness: PaperReadinessType | null;
}

const statusConfig = {
    not_ready: {
        icon: XCircle,
        color: 'text-red-400',
        bg: 'bg-red-500/10 border-red-500/30',
        label: '🔴 NÃO PRONTO',
        description: 'O sistema ainda não atingiu os critérios mínimos para operação real.',
    },
    almost_ready: {
        icon: MinusCircle,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/30',
        label: '🟡 QUASE PRONTO',
        description: 'A maioria dos critérios foi atingida. Continue operando no paper trading.',
    },
    ready: {
        icon: CheckCircle2,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/30',
        label: '🟢 PRONTO PARA LIVE',
        description: 'Todos os critérios foram atingidos! O sistema está validado para operação real.',
    },
};

export const PaperReadinessComponent = ({ readiness }: PaperReadinessProps) => {
    if (!readiness) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Shield className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Sem dados para avaliação</p>
                <p className="text-xs mt-1 opacity-60">Realize operações de paper trading para avaliar prontidão</p>
            </div>
        );
    }

    const config = statusConfig[readiness.status];
    const StatusIcon = config.icon;

    return (
        <div className="space-y-4">
            {/* Status indicator */}
            <Card className={`border ${config.bg}`}>
                <CardContent className="p-4 flex items-center gap-4">
                    <StatusIcon className={`h-10 w-10 ${config.color} shrink-0`} />
                    <div>
                        <h3 className={`text-lg font-bold ${config.color}`}>{config.label}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                        <p className="text-xs mt-1">
                            <span className={config.color}>{readiness.passedCount}</span>
                            <span className="text-muted-foreground"> / {readiness.totalCount} critérios atingidos</span>
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Criteria list */}
            <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                        <Shield className="h-4 w-4" />
                        Critérios de Prontidão
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                    {readiness.criteria.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 py-1.5 border-b border-border/20 last:border-0">
                            {c.passed ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            ) : (
                                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium">{c.label}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${c.passed ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}`}>
                                    {String(c.currentValue)}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">Meta: {c.target}</span>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Migration section */}
            {readiness.status === 'ready' && (
                <Card className="bg-emerald-500/5 border-emerald-500/20">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Rocket className="h-5 w-5 text-emerald-400" />
                            <h3 className="text-sm font-bold text-emerald-400">Transição para Live Trading</h3>
                        </div>
                        <div className="space-y-2 text-xs text-muted-foreground">
                            <p>✅ Todos os critérios foram atingidos</p>
                            <p>✅ Performance validada pelo paper trading</p>
                            <p>✅ Métricas consistentes com backtesting</p>
                        </div>
                        <Alert className="border-amber-500/30 bg-amber-500/5">
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                            <AlertTitle className="text-xs text-amber-400">Aviso de Risco</AlertTitle>
                            <AlertDescription className="text-[10px] text-amber-300/80">
                                Resultados passados não garantem resultados futuros. Opere com capital que pode perder.
                                Comece com posições menores que o paper trading e aumente gradualmente.
                                Mantenha o paper trading rodando em paralelo para comparação contínua.
                            </AlertDescription>
                        </Alert>
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p className="font-semibold">Para migrar para Live:</p>
                            <p>1. Configure API Keys da Binance (apenas permissão de trading)</p>
                            <p>2. Defina limites de risco conservadores (50% do paper)</p>
                            <p>3. Comece com 1-2 posições simultâneas no máximo</p>
                            <p>4. Monitore os primeiros 10 trades de perto</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
