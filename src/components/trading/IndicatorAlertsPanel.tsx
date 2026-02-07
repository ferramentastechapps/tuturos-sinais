import { Bell, Check, Settings, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useState } from 'react';
import { IndicatorAlert, IndicatorAlertConfig, INDICATOR_ALERT_INFO } from '@/types/indicatorAlerts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface IndicatorAlertsPanelProps {
  alerts: IndicatorAlert[];
  unreadCount: number;
  config: IndicatorAlertConfig;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAlerts: () => void;
  onDeleteAlert: (id: string) => void;
  onUpdateConfig: (updates: Partial<IndicatorAlertConfig>) => void;
}

export function IndicatorAlertsPanel({
  alerts,
  unreadCount,
  config,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAlerts,
  onDeleteAlert,
  onUpdateConfig,
}: IndicatorAlertsPanelProps) {
  const [open, setOpen] = useState(false);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  const bullishAlerts = alerts.filter(a => a.direction === 'bullish');
  const bearishAlerts = alerts.filter(a => a.direction === 'bearish');

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="relative gap-2"
        >
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">Alertas Técnicos</span>
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] bg-card border-border">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-foreground flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alertas de Indicadores
            </SheetTitle>
          </div>
        </SheetHeader>

        <Tabs defaultValue="alerts" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="alerts" className="gap-2">
              <Bell className="h-4 w-4" />
              Alertas
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="mt-4">
            {alerts.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2 text-sm">
                  <Badge variant="outline" className="text-success border-success">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {bullishAlerts.length} alta
                  </Badge>
                  <Badge variant="outline" className="text-destructive border-destructive">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    {bearishAlerts.length} baixa
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onMarkAllAsRead}
                    className="text-xs"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Marcar lidos
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClearAlerts}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <ScrollArea className="h-[calc(100vh-280px)]">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Bell className="h-12 w-12 mb-4 opacity-30" />
                  <p>Nenhum alerta de indicador</p>
                  <p className="text-sm text-center mt-1">
                    Alertas serão gerados quando indicadores<br />
                    atingirem níveis configurados
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => {
                    const info = INDICATOR_ALERT_INFO[alert.type];
                    return (
                      <div
                        key={alert.id}
                        className={`p-4 rounded-lg border ${
                          alert.direction === 'bullish' 
                            ? 'bg-success/10 border-success/30' 
                            : 'bg-destructive/10 border-destructive/30'
                        } ${!alert.read ? 'ring-1 ring-primary/50' : 'opacity-70'} 
                        cursor-pointer transition-all hover:opacity-100 relative group`}
                        onClick={() => !alert.read && onMarkAsRead(alert.id)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAlert(alert.id);
                          }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-background/50 rounded"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                        
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{info.icon}</span>
                          <div className="flex-1 pr-6">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-foreground text-sm">
                                {info.label}
                              </h4>
                              {!alert.read && (
                                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {alert.message}
                            </p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {alert.symbol}
                              </Badge>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${info.color}`}
                              >
                                {alert.indicatorName}: {alert.value.toFixed(2)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(alert.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="space-y-6">
                {/* Master Toggle */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Alertas Automáticos</Label>
                        <p className="text-sm text-muted-foreground">
                          Ativar/desativar todos os alertas
                        </p>
                      </div>
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={(enabled) => onUpdateConfig({ enabled })}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* RSI Settings */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      📊 RSI (Relative Strength Index)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Sobrevendido (&lt;)</Label>
                        <Input
                          type="number"
                          value={config.rsiOversold}
                          onChange={(e) => onUpdateConfig({ rsiOversold: Number(e.target.value) })}
                          min={0}
                          max={50}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Sobrecomprado (&gt;)</Label>
                        <Input
                          type="number"
                          value={config.rsiOverbought}
                          onChange={(e) => onUpdateConfig({ rsiOverbought: Number(e.target.value) })}
                          min={50}
                          max={100}
                          className="h-8"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stochastic Settings */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      📈 Stochastic Oscillator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Sobrevendido (&lt;)</Label>
                        <Input
                          type="number"
                          value={config.stochOversold}
                          onChange={(e) => onUpdateConfig({ stochOversold: Number(e.target.value) })}
                          min={0}
                          max={50}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Sobrecomprado (&gt;)</Label>
                        <Input
                          type="number"
                          value={config.stochOverbought}
                          onChange={(e) => onUpdateConfig({ stochOverbought: Number(e.target.value) })}
                          min={50}
                          max={100}
                          className="h-8"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Cross Signals */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      ✨ Sinais de Cruzamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm">MACD Cross</Label>
                        <p className="text-xs text-muted-foreground">
                          Cruzamentos da linha MACD
                        </p>
                      </div>
                      <Switch
                        checked={config.enableMacdCross}
                        onCheckedChange={(enableMacdCross) => onUpdateConfig({ enableMacdCross })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm">EMA Golden/Death Cross</Label>
                        <p className="text-xs text-muted-foreground">
                          Cruzamentos EMA 20/50
                        </p>
                      </div>
                      <Switch
                        checked={config.enableEmaCross}
                        onCheckedChange={(enableEmaCross) => onUpdateConfig({ enableEmaCross })}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Other Indicators */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      🔔 Outros Indicadores
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm">Bollinger Bands</Label>
                        <p className="text-xs text-muted-foreground">
                          Toques nas bandas superior/inferior
                        </p>
                      </div>
                      <Switch
                        checked={config.enableBollingerTouch}
                        onCheckedChange={(enableBollingerTouch) => onUpdateConfig({ enableBollingerTouch })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm">Ichimoku Cloud</Label>
                        <p className="text-xs text-muted-foreground">
                          Sinais TK Cross e posição na nuvem
                        </p>
                      </div>
                      <Switch
                        checked={config.enableIchimokuSignals}
                        onCheckedChange={(enableIchimokuSignals) => onUpdateConfig({ enableIchimokuSignals })}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* ADX Settings */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      📊 ADX (Average Directional Index)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm">Cruzamento +DI/-DI</Label>
                        <p className="text-xs text-muted-foreground">
                          Alertas quando +DI cruza -DI
                        </p>
                      </div>
                      <Switch
                        checked={config.enableAdxCross}
                        onCheckedChange={(enableAdxCross) => onUpdateConfig({ enableAdxCross })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Limiar Tendência Forte (&gt;)</Label>
                      <Input
                        type="number"
                        value={config.adxStrongTrend}
                        onChange={(e) => onUpdateConfig({ adxStrongTrend: Number(e.target.value) })}
                        min={15}
                        max={50}
                        className="h-8"
                      />
                      <p className="text-xs text-muted-foreground">
                        ADX acima deste valor indica tendência forte
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* ATR Settings */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      ⚡ ATR (Average True Range)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm">Alertas de Volatilidade</Label>
                        <p className="text-xs text-muted-foreground">
                          Alertas baseados no ATR
                        </p>
                      </div>
                      <Switch
                        checked={config.enableAtrAlerts}
                        onCheckedChange={(enableAtrAlerts) => onUpdateConfig({ enableAtrAlerts })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Alta Volatilidade (&gt; %)</Label>
                        <Input
                          type="number"
                          value={config.atrHighVolatility}
                          onChange={(e) => onUpdateConfig({ atrHighVolatility: Number(e.target.value) })}
                          min={1}
                          max={10}
                          step={0.5}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Baixa Volatilidade (&lt; %)</Label>
                        <Input
                          type="number"
                          value={config.atrLowVolatility}
                          onChange={(e) => onUpdateConfig({ atrLowVolatility: Number(e.target.value) })}
                          min={0.1}
                          max={3}
                          step={0.1}
                          className="h-8"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Alta volatilidade sugere cautela; baixa volatilidade pode indicar acumulação
                    </p>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
