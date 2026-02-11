// Paper Trading — Main page with tabs
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileText, LayoutDashboard, History, BarChart3, GitCompare, Shield, Settings } from 'lucide-react';
import { usePaperTrading } from '@/hooks/usePaperTrading';
import { usePaperTradingMetrics } from '@/hooks/usePaperTradingMetrics';
import { PaperHeader } from '@/components/paperTrading/PaperHeader';
import { PaperPositions } from '@/components/paperTrading/PaperPositions';
import { PaperHistory } from '@/components/paperTrading/PaperHistory';
import { PaperMetrics } from '@/components/paperTrading/PaperMetrics';
import { PaperComparative } from '@/components/paperTrading/PaperComparative';
import { PaperReadinessComponent } from '@/components/paperTrading/PaperReadiness';
import { PaperSettings } from '@/components/paperTrading/PaperSettings';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PaperTrading = () => {
    const {
        state,
        openPosition,
        closePosition,
        setMode,
        updateConfig,
        resetPortfolio,
    } = usePaperTrading();

    const { metrics, readiness, backtestComparison } = usePaperTradingMetrics(state);

    if (!state) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-muted-foreground text-sm">Carregando Paper Trading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Top bar */}
            <div className="border-b border-border bg-card/30 px-4 py-2 flex items-center gap-3">
                <Link to="/">
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Dashboard
                    </Button>
                </Link>
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-semibold">Paper Trading</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/30">
                        SIMULAÇÃO
                    </Badge>
                </div>
            </div>

            {/* Page content */}
            <div className="max-w-7xl mx-auto p-4 space-y-4">
                {/* Header */}
                <PaperHeader
                    state={state}
                    metrics={metrics}
                    onModeChange={setMode}
                    onReset={resetPortfolio}
                />

                {/* Tabs */}
                <Tabs defaultValue="overview" className="space-y-3">
                    <TabsList className="h-9 bg-card/50 border border-border/50 p-0.5 flex-wrap">
                        <TabsTrigger value="overview" className="h-7 text-xs gap-1 data-[state=active]:bg-background">
                            <LayoutDashboard className="h-3 w-3" />
                            <span className="hidden sm:inline">Posições</span>
                            {state.positions.length > 0 && (
                                <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-0.5">
                                    {state.positions.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="history" className="h-7 text-xs gap-1 data-[state=active]:bg-background">
                            <History className="h-3 w-3" />
                            <span className="hidden sm:inline">Histórico</span>
                            {state.history.length > 0 && (
                                <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-0.5">
                                    {state.history.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="metrics" className="h-7 text-xs gap-1 data-[state=active]:bg-background">
                            <BarChart3 className="h-3 w-3" />
                            <span className="hidden sm:inline">Métricas</span>
                        </TabsTrigger>
                        <TabsTrigger value="comparative" className="h-7 text-xs gap-1 data-[state=active]:bg-background">
                            <GitCompare className="h-3 w-3" />
                            <span className="hidden sm:inline">Comparativo</span>
                        </TabsTrigger>
                        <TabsTrigger value="readiness" className="h-7 text-xs gap-1 data-[state=active]:bg-background">
                            <Shield className="h-3 w-3" />
                            <span className="hidden sm:inline">Prontidão</span>
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="h-7 text-xs gap-1 data-[state=active]:bg-background">
                            <Settings className="h-3 w-3" />
                            <span className="hidden sm:inline">Config</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-0">
                        <PaperPositions
                            positions={state.positions}
                            onClose={closePosition}
                        />
                    </TabsContent>

                    <TabsContent value="history" className="mt-0">
                        <PaperHistory history={state.history} />
                    </TabsContent>

                    <TabsContent value="metrics" className="mt-0">
                        {metrics && (
                            <PaperMetrics metrics={metrics} equityCurve={state.equityCurve} />
                        )}
                    </TabsContent>

                    <TabsContent value="comparative" className="mt-0">
                        <PaperComparative
                            comparison={backtestComparison}
                            equityCurve={state.equityCurve}
                            initialBalance={state.config.initialBalance}
                        />
                    </TabsContent>

                    <TabsContent value="readiness" className="mt-0">
                        <PaperReadinessComponent readiness={readiness} />
                    </TabsContent>

                    <TabsContent value="settings" className="mt-0">
                        <PaperSettings config={state.config} onUpdate={updateConfig} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default PaperTrading;
