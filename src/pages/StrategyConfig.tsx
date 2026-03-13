import { useState, useRef, useCallback } from 'react';
import { useStrategyProfile } from '@/hooks/useStrategyProfile';
import { INDICATOR_REGISTRY, INDICATOR_CATEGORIES, IndicatorKey, IndicatorConfig, IndicatorCategory, StrategyProfile, computeProfileStats } from '@/types/strategyTypes';
import { getSavedResults } from '@/services/backtestService';
import { analyzeProfilePerformance } from '@/utils/strategyRecommender';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Settings2,
  ChevronDown,
  ChevronRight,
  Plus,
  Copy,
  Trash2,
  Download,
  Upload,
  Star,
  StarOff,
  MoreVertical,
  Zap,
  TrendingUp,
  Activity,
  BarChart2,
  DollarSign,
  Layers,
  AlertTriangle,
  LineChart,
  Globe,
  Lightbulb,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const CATEGORY_ICONS: Record<IndicatorCategory, React.ReactNode> = {
  marketStructure: <TrendingUp className="w-4 h-4" />,
  classicTechnical: <Activity className="w-4 h-4" />,
  movingAverages: <LineChart className="w-4 h-4" />,
  volumeOrderflow: <BarChart2 className="w-4 h-4" />,
  smartMoney: <Layers className="w-4 h-4" />,
  futuresExclusive: <Zap className="w-4 h-4" />,
  supportResistance: <DollarSign className="w-4 h-4" />,
  candlePatterns: <AlertTriangle className="w-4 h-4" />,
  sentimentOnChain: <Globe className="w-4 h-4" />,
};

const PRESET_ICONS: Record<string, string> = {
  preset_smart_money: '🧠',
  preset_price_action: '📈',
  preset_classic: '📊',
  preset_scalping: '⚡',
  preset_swing: '🌊',
  preset_full: '🔥',
};

export default function StrategyConfig() {
  const { toast } = useToast();
  const {
    profiles,
    activeProfile,
    isLoading,
    setActiveProfile,
    createProfile,
    updateProfile,
    deleteProfileById,
    duplicateProfile,
    setDefault,
    exportProfile,
    importProfile,
    updateIndicator,
  } = useStrategyProfile();

  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['smartMoney', 'marketStructure']));
  const [editingProfile, setEditingProfile] = useState<StrategyProfile | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [recommendations, setRecommendations] = useState<ReturnType<typeof analyzeProfilePerformance> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const presetProfiles = profiles.filter(p => p.isPreset);
  const customProfiles = profiles.filter(p => !p.isPreset);

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleIndicatorToggle = (key: IndicatorKey, active: boolean) => {
    if (!activeProfile) return;
    const current = activeProfile.indicators[key];
    const meta = INDICATOR_REGISTRY.find(m => m.key === key)!;
    const updated: IndicatorConfig = {
      active,
      weight: active ? (current.weight > 0 ? current.weight : meta.defaultWeight) : current.weight,
    };
    updateIndicator(activeProfile.id, key, updated);
  };

  const handleWeightChange = (key: IndicatorKey, weight: number) => {
    if (!activeProfile) return;
    const current = activeProfile.indicators[key];
    updateIndicator(activeProfile.id, key, { ...current, weight });
  };

  const handleSaveProfile = async () => {
    if (!activeProfile || activeProfile.isPreset) return;
    await updateProfile(activeProfile);
    toast({ title: 'Perfil salvo!', description: `"${activeProfile.name}" foi atualizado com sucesso.` });
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;
    const profile = await createProfile(newProfileName.trim());
    setActiveProfile(profile);
    setNewProfileName('');
    setShowNewDialog(false);
    toast({ title: 'Perfil criado!', description: `"${profile.name}" foi criado.` });
  };

  const handleDuplicate = async (source: StrategyProfile) => {
    const dup = await duplicateProfile(source);
    setActiveProfile(dup);
    toast({ title: 'Perfil duplicado!', description: `"${dup.name}" criado.` });
  };

  const handleDelete = async (id: string, name: string) => {
    await deleteProfileById(id);
    toast({ title: 'Perfil removido', description: `"${name}" foi deletado.` });
  };

  const handleExport = (profile: StrategyProfile) => {
    const json = exportProfile(profile);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Perfil exportado!' });
  };

  const handleImport = async () => {
    try {
      const profile = await importProfile(importJson.trim());
      setActiveProfile(profile);
      setImportJson('');
      setShowImportDialog(false);
      toast({ title: 'Perfil importado!', description: `"${profile.name}" importado.` });
    } catch (err) {
      toast({ title: 'Erro ao importar', description: String(err), variant: 'destructive' });
    }
  };

  const handleAnalyzeRecommendations = () => {
    if (!activeProfile) return;
    const saved = getSavedResults();
    if (saved.length === 0) {
      toast({ title: 'Nenhum backtest encontrado', description: 'Execute um backtest primeiro.', variant: 'destructive' });
      return;
    }
    const allTrades = saved[0].trades;
    const result = analyzeProfilePerformance(allTrades, activeProfile);
    setRecommendations(result);
  };

  const handleApplyRecommendations = async () => {
    if (!recommendations || !activeProfile) return;
    let updated = { ...activeProfile };
    for (const rec of recommendations.recommendations) {
      updated = {
        ...updated,
        indicators: {
          ...updated.indicators,
          [rec.indicatorKey]: {
            active: rec.suggestedActive,
            weight: rec.suggestedWeight,
          },
        },
      };
    }
    const final = computeProfileStats(updated);
    await updateProfile(final);
    setActiveProfile(final);
    setRecommendations(null);
    toast({ title: '✅ Sugestões aplicadas!', description: 'Perfil atualizado com os pesos sugeridos.' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Settings2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando perfis...</p>
        </div>
      </div>
    );
  }

  const activeIndicators = activeProfile ? Object.values(activeProfile.indicators).filter(i => i.active).length : 0;
  const totalIndicators = INDICATOR_REGISTRY.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Settings2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Configuração de Estratégia</h1>
              <p className="text-xs text-muted-foreground">Personalize quais indicadores geram seus sinais</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeProfile && !activeProfile.isPreset && (
              <Button size="sm" onClick={handleSaveProfile} className="gap-2">
                <CheckCircle className="w-3.5 h-3.5" />
                Salvar Perfil
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-6">

        {/* ── LEFT: Profile Selector Panel ── */}
        <div className="space-y-4">
          {/* Active Profile Stats */}
          {activeProfile && (
            <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{PRESET_ICONS[activeProfile.id] || '⚙️'}</span>
                <div>
                  <p className="font-semibold text-foreground">{activeProfile.name}</p>
                  <p className="text-xs text-muted-foreground">{activeProfile.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-background/60 text-center">
                  <p className="text-lg font-bold text-primary">{activeIndicators}</p>
                  <p className="text-[10px] text-muted-foreground">Ativos</p>
                </div>
                <div className="p-2 rounded-lg bg-background/60 text-center">
                  <p className="text-lg font-bold text-foreground">{activeProfile.avgWeight || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Peso Médio</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Cobertura</span>
                  <span>{activeIndicators}/{totalIndicators}</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${(activeIndicators / totalIndicators) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Preset Profiles */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Perfis Pré-configurados</p>
            {presetProfiles.map(profile => (
              <button
                key={profile.id}
                className={cn(
                  "w-full text-left p-3 rounded-xl border transition-all duration-200",
                  activeProfile?.id === profile.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                )}
                onClick={() => setActiveProfile(profile)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{PRESET_ICONS[profile.id] || '⚙️'}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{profile.name}</p>
                      <p className="text-[10px] text-muted-foreground">{profile.totalActiveIndicators} indicadores</p>
                    </div>
                  </div>
                  {profile.isDefault && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                  {activeProfile?.id === profile.id && (
                    <CheckCircle className="w-3.5 h-3.5 text-primary ml-auto" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Custom Profiles */}
          {customProfiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Meus Perfis</p>
              {customProfiles.map(profile => (
                <div
                  key={profile.id}
                  className={cn(
                    "w-full p-3 rounded-xl border transition-all duration-200",
                    activeProfile?.id === profile.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <button className="flex-1 text-left" onClick={() => setActiveProfile(profile)}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⚙️</span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{profile.name}</p>
                          <p className="text-[10px] text-muted-foreground">{profile.totalActiveIndicators} indicadores</p>
                        </div>
                      </div>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDefault(profile.id)}>
                          <Star className="w-3.5 h-3.5 mr-2" />Definir como padrão
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(profile)}>
                          <Copy className="w-3.5 h-3.5 mr-2" />Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(profile)}>
                          <Download className="w-3.5 h-3.5 mr-2" />Exportar JSON
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(profile.id, profile.name)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />Deletar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowNewDialog(true)}>
              <Plus className="w-3.5 h-3.5" />Novo
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowImportDialog(true)}>
              <Upload className="w-3.5 h-3.5" />Importar
            </Button>
            {activeProfile && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleDuplicate(activeProfile)}>
                  <Copy className="w-3.5 h-3.5" />Duplicar
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleExport(activeProfile)}>
                  <Download className="w-3.5 h-3.5" />Exportar
                </Button>
              </>
            )}
          </div>

          {/* Recommendations Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            onClick={handleAnalyzeRecommendations}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Analisar & Sugerir Otimizações
          </Button>
        </div>

        {/* ── RIGHT: Indicator Configurator ── */}
        <div className="space-y-3">
          {activeProfile ? (
            <>
              {INDICATOR_CATEGORIES.map(cat => {
                const categoryIndicators = INDICATOR_REGISTRY.filter(m => m.category === cat);
                const categoryLabel = categoryIndicators[0]?.categoryLabel || cat;
                const activeInCat = categoryIndicators.filter(m => activeProfile.indicators[m.key]?.active).length;
                const isOpen = openCategories.has(cat);

                return (
                  <Collapsible key={cat} open={isOpen} onOpenChange={() => toggleCategory(cat)}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span className="text-muted-foreground">{CATEGORY_ICONS[cat]}</span>
                          <span className="font-medium text-foreground text-sm">{categoryLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-2 py-0",
                              activeInCat > 0
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {activeInCat}/{categoryIndicators.length}
                          </Badge>
                          {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="mt-1 space-y-1 pl-2 pr-0.5">
                        {categoryIndicators.map(meta => {
                          const config = activeProfile.indicators[meta.key];
                          const isActive = config?.active || false;
                          const weight = config?.weight || 0;
                          const isPreset = activeProfile.isPreset;

                          return (
                            <div
                              key={meta.key}
                              className={cn(
                                "p-3 rounded-lg border transition-all",
                                isActive
                                  ? "border-primary/20 bg-primary/5"
                                  : "border-border bg-muted/20 opacity-60"
                              )}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <Switch
                                    checked={isActive}
                                    onCheckedChange={(v) => !isPreset && handleIndicatorToggle(meta.key, v)}
                                    disabled={isPreset}
                                    className="data-[state=checked]:bg-primary"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{meta.label}</p>
                                    <p className="text-[10px] text-muted-foreground">{meta.description}</p>
                                  </div>
                                </div>
                                {isActive && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 ml-2 shrink-0 font-mono">
                                    {weight}
                                  </Badge>
                                )}
                              </div>

                              {isActive && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span>Peso</span>
                                    <span className="font-mono">{weight}/100</span>
                                  </div>
                                  <Slider
                                    value={[weight]}
                                    min={10}
                                    max={100}
                                    step={5}
                                    disabled={isPreset}
                                    onValueChange={([v]) => handleWeightChange(meta.key, v)}
                                    className={cn("w-full", isPreset && "opacity-50 cursor-not-allowed")}
                                  />
                                  {/* Visual weight bar */}
                                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        weight >= 80 ? "bg-primary" : weight >= 50 ? "bg-amber-400" : "bg-muted-foreground"
                                      )}
                                      style={{ width: `${weight}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              {isPreset && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  Duplique o perfil para editar os pesos
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Settings2 className="w-12 h-12 mb-3 opacity-20" />
              <p>Selecione um perfil para configurar os indicadores</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Recommendations Panel ── */}
      {recommendations && recommendations.hasRecommendations && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-foreground">Sugestões de Otimização</h3>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
                  {recommendations.tradesAnalyzed} trades analisados
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setRecommendations(null)}>
                  Ignorar
                </Button>
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={handleApplyRecommendations}
                >
                  Aplicar Sugestões
                </Button>
              </div>
            </div>

            {/* Metrics comparison */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-background/60 text-center">
                <p className="text-xs text-muted-foreground">Win Rate Atual</p>
                <p className="text-lg font-bold text-foreground">{recommendations.currentWinRate.toFixed(1)}%</p>
              </div>
              <div className="p-3 rounded-lg bg-background/60 text-center">
                <p className="text-xs text-muted-foreground">Win Rate Simulado</p>
                <p className="text-lg font-bold text-primary">{recommendations.simulatedWinRate.toFixed(1)}%</p>
              </div>
              <div className="p-3 rounded-lg bg-background/60 text-center">
                <p className="text-xs text-muted-foreground">PF Atual</p>
                <p className="text-lg font-bold text-foreground">{recommendations.currentProfitFactor.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-lg bg-background/60 text-center">
                <p className="text-xs text-muted-foreground">PF Simulado</p>
                <p className="text-lg font-bold text-primary">{recommendations.simulatedProfitFactor.toFixed(2)}</p>
              </div>
            </div>

            {/* Individual recommendations */}
            <div className="space-y-2">
              {recommendations.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background/40 border border-border/50">
                  {rec.action === 'increase_weight' ? (
                    <ArrowUp className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  ) : rec.action === 'disable' ? (
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  ) : (
                    <ArrowDown className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{rec.indicatorLabel}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {rec.winRate.toFixed(0)}% win rate
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {rec.appearances} aparições
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{rec.reason}</p>
                    {rec.action !== 'disable' && (
                      <p className="text-[10px] text-primary mt-0.5">
                        Peso: {rec.currentWeight} → {rec.suggestedWeight}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          setImportJson(text);
          setShowImportDialog(true);
          e.target.value = '';
        }}
      />

      {/* New Profile Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Perfil de Estratégia</DialogTitle>
            <DialogDescription>Digite um nome para o novo perfil. Ele começará com todos os indicadores ativos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Ex: Minha Estratégia BTC"
              value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateProfile()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreateProfile} disabled={!newProfileName.trim()}>Criar Perfil</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar Perfil</DialogTitle>
            <DialogDescription>Cole o JSON do perfil exportado abaixo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea
              placeholder='{"name": "Meu Perfil", "indicators": {...}}'
              value={importJson}
              onChange={e => setImportJson(e.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Upload className="w-3.5 h-3.5" />Carregar .json
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancelar</Button>
                <Button onClick={handleImport} disabled={!importJson.trim()}>Importar</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
