import { Bell, Check, Trash2, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { TradingAlert, ALERT_CONFIG } from '@/types/alerts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface AlertsPanelProps {
  alerts: TradingAlert[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAlerts: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function AlertsPanel({
  alerts,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAlerts,
  soundEnabled,
  onToggleSound,
}: AlertsPanelProps) {
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

  const getPriorityColor = (priority: TradingAlert['priority']) => {
    switch (priority) {
      case 'critical': return 'bg-trading-loss/20 border-trading-loss';
      case 'high': return 'bg-trading-warning/20 border-trading-warning';
      case 'medium': return 'bg-trading-accent/20 border-trading-accent';
      default: return 'bg-muted/20 border-muted';
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-trading-loss text-xs font-bold flex items-center justify-center text-white animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] bg-card border-border">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-foreground flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alertas
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount} novo{unreadCount > 1 ? 's' : ''}
                </Badge>
              )}
            </SheetTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleSound}
                className="h-8 w-8"
                title={soundEnabled ? 'Desativar som' : 'Ativar som'}
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              {alerts.length > 0 && (
                <>
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
                    className="h-8 w-8 text-muted-foreground hover:text-trading-loss"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Bell className="h-12 w-12 mb-4 opacity-30" />
              <p>Nenhum alerta no momento</p>
              <p className="text-sm">Você será notificado sobre eventos importantes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const config = ALERT_CONFIG[alert.type];
                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border ${getPriorityColor(alert.priority)} ${
                      !alert.read ? 'ring-1 ring-primary/50' : 'opacity-70'
                    } cursor-pointer transition-all hover:opacity-100`}
                    onClick={() => !alert.read && onMarkAsRead(alert.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{config.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-foreground text-sm">
                              {alert.title}
                            </h4>
                            {!alert.read && (
                              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {alert.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {alert.symbol}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(alert.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
