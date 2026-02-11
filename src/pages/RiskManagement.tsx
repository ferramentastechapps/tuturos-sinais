import { useState, useMemo } from 'react';
import { SimpleHeader } from '@/components/trading/SimpleHeader';
import { useRiskManagement } from '@/hooks/useRiskManagement';
import { RiskProfileCard } from '@/components/risk/RiskProfileCard';
import { RiskConfigEditor } from '@/components/risk/RiskConfigEditor';
import { GlobalLimitsPanel } from '@/components/risk/GlobalLimitsPanel';
import { RiskLogViewer } from '@/components/risk/RiskLogViewer';
import { riskLogger } from '@/services/riskLogger';
import { AssetRiskConfig, RiskProfileType } from '@/types/riskProfiles';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Shield, ShieldCheck, ShieldAlert, Zap,
    Settings, Activity, FileBarChart, Search,
    TrendingUp, AlertTriangle, CheckCircle2,
    DollarSign,
} from 'lucide-react';

const profileFilterOptions: Array<{ value: string; label: string; icon: React.ElementType }> = [
    { value: 'all', label: 'Todos', icon: Shield },
    { value: 'conservative', label: 'Conservador', icon: ShieldCheck },
    { value: 'moderate', label: 'Moderado', icon: Shield },
    { value: 'aggressive', label: 'Agressivo', icon: ShieldAlert },
    { value: 'speculative', label: 'Especulativo', icon: Zap },
];

const RiskManagement = () => {
    const {
        configs,
        updateConfig,
        resetConfig,
        toggleAsset,
        globalLimits,
        setGlobalLimits,
        logs,
        refreshLogs,
        generateReport,
        profileStats,
        enabledCount,
        profiles,
    } = useRiskManagement();

    const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
    const [profileFilter, setProfileFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showEnabled, setShowEnabled] = useState<string>('all');

    // Filtered configs
    const filteredConfigs = useMemo(() => {
        let result = [...configs];

        if (profileFilter !== 'all') {
            result = result.filter(c => c.riskProfile === profileFilter);
        }
        if (showEnabled === 'enabled') {
            result = result.filter(c => c.enabled);
        } else if (showEnabled === 'disabled') {
            result = result.filter(c => !c.enabled);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(c =>
                c.symbol.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q) ||
                c.category.toLowerCase().includes(q)
            );
        }

        // Sort: enabled first, then by profile priority
        const profileOrder: Record<RiskProfileType, number> = {
            conservative: 0, moderate: 1, aggressive: 2, speculative: 3,
        };
        result.sort((a, b) => {
            if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
            return profileOrder[a.riskProfile] - profileOrder[b.riskProfile];
        });

        return result;
    }, [configs, profileFilter, searchQuery, showEnabled]);

    const editingConfig = editingSymbol
        ? configs.find(c => c.symbol === editingSymbol) || null
        : null;

    const todayStats = useMemo(() => {
        const today = riskLogger.getTodayLogs();
        return {
            adjustments: today.filter(l => l.type === 'adjustment').length,
            alerts: today.filter(l => l.type === 'alert').length,
            blocks: today.filter(l => l.type === 'block').length,
        };
    }, [logs]);

    return (
        <div className="min-h-screen bg-background">
            <SimpleHeader />

            <main className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Shield className="h-6 w-6 text-primary" />
                            Gestão de Risco
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Perfis individualizados por ativo com ajuste dinâmico
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => generateReport()}>
                            <FileBarChart className="h-4 w-4 mr-1" />
                            Gerar Relatório
                        </Button>
                    </div>
                </div>

                {/* Overview Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <span className="text-xs text-muted-foreground">Ativos</span>
                            </div>
                            <p className="text-2xl font-bold text-foreground">{enabledCount}</p>
                            <p className="text-xs text-muted-foreground">de {configs.length} configurados</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <DollarSign className="h-4 w-4 text-blue-500" />
                                <span className="text-xs text-muted-foreground">Capital</span>
                            </div>
                            <p className="text-2xl font-bold text-foreground">
                                ${globalLimits.portfolioCapital.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">portfólio total</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Activity className="h-4 w-4 text-amber-500" />
                                <span className="text-xs text-muted-foreground">Hoje</span>
                            </div>
                            <p className="text-2xl font-bold text-foreground">{todayStats.adjustments}</p>
                            <p className="text-xs text-muted-foreground">ajustes automáticos</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                <span className="text-xs text-muted-foreground">Alertas</span>
                            </div>
                            <p className="text-2xl font-bold text-foreground">
                                {todayStats.alerts + todayStats.blocks}
                            </p>
                            <p className="text-xs text-muted-foreground">alertas + bloqueios</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Profile Stats */}
                <div className="flex flex-wrap gap-2">
                    {Object.entries(profiles).map(([key, profile]) => (
                        <Badge
                            key={key}
                            variant="outline"
                            className="text-xs cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => setProfileFilter(profileFilter === key ? 'all' : key)}
                        >
                            {profile.label}: {profileStats[key] || 0} moedas
                        </Badge>
                    ))}
                </div>

                {/* Main Content Tabs */}
                <Tabs defaultValue="assets" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="assets" className="gap-1">
                            <TrendingUp className="h-3.5 w-3.5" />
                            Ativos
                        </TabsTrigger>
                        <TabsTrigger value="limits" className="gap-1">
                            <Settings className="h-3.5 w-3.5" />
                            Limites Globais
                        </TabsTrigger>
                        <TabsTrigger value="logs" className="gap-1">
                            <Activity className="h-3.5 w-3.5" />
                            Logs
                        </TabsTrigger>
                    </TabsList>

                    {/* ████ ASSETS TAB ████ */}
                    <TabsContent value="assets" className="mt-4">
                        {/* Search & Filter */}
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar moeda..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 h-9 text-sm"
                                />
                            </div>

                            <Select value={profileFilter} onValueChange={setProfileFilter}>
                                <SelectTrigger className="w-36 h-9 text-xs">
                                    <SelectValue placeholder="Perfil" />
                                </SelectTrigger>
                                <SelectContent>
                                    {profileFilterOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={showEnabled} onValueChange={setShowEnabled}>
                                <SelectTrigger className="w-28 h-9 text-xs">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="enabled">Ativos</SelectItem>
                                    <SelectItem value="disabled">Inativos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Asset Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {filteredConfigs.map(config => (
                                <RiskProfileCard
                                    key={config.symbol}
                                    config={config}
                                    onEdit={setEditingSymbol}
                                    onToggle={toggleAsset}
                                />
                            ))}
                        </div>

                        {filteredConfigs.length === 0 && (
                            <div className="text-center py-12 text-muted-foreground">
                                <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p>Nenhuma moeda encontrada com os filtros atuais</p>
                            </div>
                        )}
                    </TabsContent>

                    {/* ████ GLOBAL LIMITS TAB ████ */}
                    <TabsContent value="limits" className="mt-4 max-w-2xl">
                        <GlobalLimitsPanel
                            limits={globalLimits}
                            onSave={setGlobalLimits}
                        />
                    </TabsContent>

                    {/* ████ LOGS TAB ████ */}
                    <TabsContent value="logs" className="mt-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-primary" />
                                    Registro de Atividades
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Ajustes automáticos, alertas e operações registradas
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <RiskLogViewer
                                    logs={logs}
                                    onClear={() => { riskLogger.clearLogs(); refreshLogs(); }}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Edit Modal */}
                <RiskConfigEditor
                    config={editingConfig}
                    open={!!editingSymbol}
                    onClose={() => setEditingSymbol(null)}
                    onSave={updateConfig}
                    onReset={resetConfig}
                />
            </main>
        </div>
    );
};

export default RiskManagement;
