// TelegramSettings — Dashboard component for Telegram bot configuration

import { useState, useEffect } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { TelegramNotificationType, TelegramDestination } from '@/types/telegram';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Send,
    Plus,
    Trash2,
    CheckCircle,
    XCircle,
    Wifi,
    WifiOff,
    Clock,
    Loader2,
    MessageSquare,
    Bot,
    Eye,
    EyeOff,
    Key,
} from 'lucide-react';

// ──────────── Notification Type Labels ────────────

const NOTIFICATION_LABELS: Record<TelegramNotificationType, { label: string; emoji: string }> = {
    new_signal: { label: 'Novos Sinais', emoji: '📊' },
    take_profit: { label: 'Take Profit', emoji: '✅' },
    stop_loss: { label: 'Stop Loss', emoji: '❌' },
    risk_alert: { label: 'Alertas de Risco', emoji: '⚠️' },
    daily_summary: { label: 'Resumo Diário', emoji: '📋' },
    market_alert: { label: 'Alertas de Mercado', emoji: '🚨' },
    funding_rate: { label: 'Funding Rate', emoji: '⚡' },
};

const ALL_NOTIFICATION_TYPES: TelegramNotificationType[] = [
    'new_signal', 'take_profit', 'stop_loss', 'risk_alert',
    'daily_summary', 'market_alert', 'funding_rate',
];

// ──────────── Component ────────────

export const TelegramSettings = () => {
    const {
        config,
        logs,
        connectionStatus,
        botName,
        testing,
        testResult,
        hasToken,
        setEnabled,
        setPaused,
        setTypeEnabled,
        updateFilters,
        addDestination,
        removeDestination,
        testConnection,
        checkBotInfo,
        clearLogs,
        saveToken,
        getToken,
    } = useTelegram();

    // Token input state
    const [tokenInput, setTokenInput] = useState('');
    const [showToken, setShowToken] = useState(false);
    const [tokenSaved, setTokenSaved] = useState(false);

    // New destination form state
    const [newChatId, setNewChatId] = useState('');
    const [newDestName, setNewDestName] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    // Load existing token on mount (masked)
    useEffect(() => {
        const existing = getToken();
        if (existing) {
            setTokenInput(existing);
        }
    }, [getToken]);

    // Check bot info when token exists and enabled
    useEffect(() => {
        if (config.enabled && hasToken) {
            checkBotInfo();
        }
    }, [config.enabled, hasToken, checkBotInfo]);

    const handleSaveToken = () => {
        saveToken(tokenInput.trim());
        setTokenSaved(true);
        setTimeout(() => setTokenSaved(false), 3000);
        if (tokenInput.trim()) {
            checkBotInfo();
        }
    };

    const handleAddDestination = () => {
        if (!newChatId.trim()) return;
        addDestination({
            chatId: newChatId.trim(),
            name: newDestName.trim() || `Chat ${newChatId.trim()}`,
            minScore: config.filters.minScore,
            enabledTypes: ALL_NOTIFICATION_TYPES,
            enabled: true,
        });
        setNewChatId('');
        setNewDestName('');
        setShowAddForm(false);
    };

    const handleTestConnection = () => {
        if (config.destinations.length > 0) {
            testConnection(config.destinations[0].chatId);
        }
    };

    const maskToken = (token: string) => {
        if (token.length <= 10) return '••••••••••';
        return token.slice(0, 5) + '•'.repeat(Math.min(token.length - 10, 20)) + token.slice(-5);
    };

    return (
        <div className="space-y-6">
            {/* Main Configuration Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        Telegram Bot
                        {connectionStatus === 'connected' && (
                            <Badge variant="outline" className="ml-2 text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                                <Wifi className="h-3 w-3 mr-1" />
                                Conectado
                            </Badge>
                        )}
                        {connectionStatus === 'disconnected' && (
                            <Badge variant="outline" className="ml-2 text-red-500 border-red-500/30 bg-red-500/10">
                                <WifiOff className="h-3 w-3 mr-1" />
                                Desconectado
                            </Badge>
                        )}
                    </CardTitle>
                    <CardDescription>
                        Configure o bot do Telegram para receber sinais e notificações em tempo real
                        {botName && <span className="block mt-1 text-xs text-emerald-500">🤖 Bot: @{botName}</span>}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    {/* Bot Token Input */}
                    <div className="space-y-2">
                        <Label htmlFor="botToken" className="flex items-center gap-1.5">
                            <Key className="h-3.5 w-3.5" />
                            Bot Token
                        </Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    id="botToken"
                                    type={showToken ? 'text' : 'password'}
                                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                                    value={showToken ? tokenInput : (tokenInput ? maskToken(tokenInput) : '')}
                                    onChange={(e) => {
                                        if (showToken) setTokenInput(e.target.value);
                                    }}
                                    onFocus={() => setShowToken(true)}
                                    className="pr-10 font-mono text-xs"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                    onClick={() => setShowToken(!showToken)}
                                >
                                    {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </Button>
                            </div>
                            <Button
                                onClick={handleSaveToken}
                                size="sm"
                                variant={tokenSaved ? 'default' : 'secondary'}
                                className="shrink-0"
                            >
                                {tokenSaved ? (
                                    <>
                                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                        Salvo
                                    </>
                                ) : (
                                    'Salvar'
                                )}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Crie um bot no <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary underline">@BotFather</a> e cole o token aqui. Armazenado apenas localmente.
                        </p>
                    </div>

                    {/* Enable/Disable Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Ativar Notificações Telegram</Label>
                            <p className="text-sm text-muted-foreground">
                                Enviar sinais e alertas para o Telegram
                            </p>
                        </div>
                        <Switch
                            checked={config.enabled}
                            onCheckedChange={setEnabled}
                            disabled={!hasToken}
                        />
                    </div>

                    {/* Pause Toggle */}
                    {config.enabled && (
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>
                                    {config.paused ? '⏸️ Notificações Pausadas' : '▶️ Notificações Ativas'}
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Pausar temporariamente sem desativar
                                </p>
                            </div>
                            <Switch
                                checked={!config.paused}
                                onCheckedChange={(checked) => setPaused(!checked)}
                            />
                        </div>
                    )}

                    {/* Test Connection Button */}
                    {config.enabled && hasToken && config.destinations.length > 0 && (
                        <Button
                            onClick={handleTestConnection}
                            disabled={testing}
                            variant="outline"
                            className="w-full"
                        >
                            {testing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Enviando teste...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4 mr-2" />
                                    Testar Conexão
                                </>
                            )}
                        </Button>
                    )}

                    {testResult && (
                        <Alert variant={testResult.success ? 'default' : 'destructive'}>
                            <AlertDescription className="flex items-center gap-2">
                                {testResult.success ? (
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                ) : (
                                    <XCircle className="h-4 w-4" />
                                )}
                                {testResult.message}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Destinations Card */}
            {config.enabled && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <MessageSquare className="h-4 w-4" />
                            Destinos
                        </CardTitle>
                        <CardDescription>
                            Adicione chats, grupos ou canais para receber notificações
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {config.destinations.map((dest: TelegramDestination) => (
                            <div
                                key={dest.id}
                                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{dest.name}</p>
                                    <p className="text-xs text-muted-foreground font-mono">ID: {dest.chatId}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Score ≥ {dest.minScore}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => removeDestination(dest.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}

                        {config.destinations.length === 0 && !showAddForm && (
                            <Alert>
                                <AlertDescription className="text-sm">
                                    Nenhum destino configurado. Adicione um Chat ID para começar a receber notificações.
                                    <br />
                                    <span className="text-xs text-muted-foreground">
                                        💡 Use <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-primary underline">@userinfobot</a> para descobrir seu Chat ID.
                                    </span>
                                </AlertDescription>
                            </Alert>
                        )}

                        {showAddForm ? (
                            <div className="space-y-3 p-3 border rounded-lg">
                                <div className="space-y-2">
                                    <Label htmlFor="chatId">Chat ID</Label>
                                    <Input
                                        id="chatId"
                                        placeholder="Ex: 5886909921 ou -1001234567890"
                                        value={newChatId}
                                        onChange={(e) => setNewChatId(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="destName">Nome (opcional)</Label>
                                    <Input
                                        id="destName"
                                        placeholder="Ex: Meu Canal, Grupo Privado"
                                        value={newDestName}
                                        onChange={(e) => setNewDestName(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={handleAddDestination} disabled={!newChatId.trim()}>
                                        Adicionar
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                                        Cancelar
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowAddForm(true)}
                                className="w-full"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar Destino
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Notification Types Card */}
            {config.enabled && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Tipos de Notificação</CardTitle>
                        <CardDescription>
                            Escolha quais tipos de alerta enviar pelo Telegram
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {ALL_NOTIFICATION_TYPES.map((type) => {
                            const info = NOTIFICATION_LABELS[type];
                            return (
                                <div key={type} className="flex items-center justify-between">
                                    <Label className="text-sm">{info.emoji} {info.label}</Label>
                                    <Switch
                                        checked={config.enabledTypes[type]}
                                        onCheckedChange={(checked) => setTypeEnabled(type, checked)}
                                    />
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* Filters Card */}
            {config.enabled && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Filtros</CardTitle>
                        <CardDescription>Ajuste os critérios para envio de notificações</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Min Score */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Score Mínimo</Label>
                                <Badge variant="secondary">{config.filters.minScore}</Badge>
                            </div>
                            <Slider
                                value={[config.filters.minScore]}
                                onValueChange={([value]) => updateFilters({ minScore: value })}
                                min={0}
                                max={100}
                                step={5}
                            />
                            <p className="text-xs text-muted-foreground">
                                Apenas sinais com score ≥ {config.filters.minScore} serão notificados
                            </p>
                        </div>

                        {/* Min RR */}
                        <div className="space-y-2">
                            <Label htmlFor="minRR">Risco/Retorno Mínimo</Label>
                            <Input
                                id="minRR"
                                type="number"
                                step="0.1"
                                value={config.filters.minRiskReward}
                                onChange={(e) => updateFilters({ minRiskReward: parseFloat(e.target.value) || 1 })}
                            />
                        </div>

                        {/* Max per hour per coin */}
                        <div className="space-y-2">
                            <Label htmlFor="maxPerHour">Máx. notificações por hora por moeda</Label>
                            <Input
                                id="maxPerHour"
                                type="number"
                                min="1"
                                max="10"
                                value={config.filters.maxPerHourPerCoin}
                                onChange={(e) => updateFilters({ maxPerHourPerCoin: parseInt(e.target.value) || 1 })}
                            />
                        </div>

                        {/* Silent Hours */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5" />
                                        Horário de Silêncio
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Não enviar notificações neste período (UTC)
                                    </p>
                                </div>
                                <Switch
                                    checked={config.filters.silentHoursEnabled}
                                    onCheckedChange={(checked) => updateFilters({ silentHoursEnabled: checked })}
                                />
                            </div>
                            {config.filters.silentHoursEnabled && (
                                <div className="flex gap-3 items-center">
                                    <div className="flex-1 space-y-1">
                                        <Label className="text-xs">De</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={23}
                                            value={config.filters.silentHoursStart}
                                            onChange={(e) => updateFilters({ silentHoursStart: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <span className="text-muted-foreground mt-5">—</span>
                                    <div className="flex-1 space-y-1">
                                        <Label className="text-xs">Até</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={23}
                                            value={config.filters.silentHoursEnd}
                                            onChange={(e) => updateFilters({ silentHoursEnd: parseInt(e.target.value) || 7 })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Message History Card */}
            {config.enabled && logs.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base">Histórico de Mensagens</CardTitle>
                                <CardDescription>Últimas {logs.length} mensagens</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" onClick={clearLogs}>Limpar</Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {logs.map((log) => (
                                <div key={log.id} className="flex items-start gap-2 p-2 rounded text-sm bg-muted/30">
                                    {log.success ? (
                                        <CheckCircle className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                                    ) : (
                                        <XCircle className="h-3.5 w-3.5 mt-0.5 text-red-500 shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs truncate">{log.preview}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(log.timestamp).toLocaleString('pt-BR')}
                                            {log.symbol && ` • ${log.symbol}`}
                                        </p>
                                        {log.error && <p className="text-xs text-red-500 mt-0.5">{log.error}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
