import { Bell, Trash2, CheckCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PriceAlert } from '@/types/priceAlerts';
import { CryptoPair } from '@/types/trading';
import { AddPriceAlertDialog } from './AddPriceAlertDialog';
import { PriceAlertFormData } from '@/types/priceAlerts';

interface PriceAlertsPanelProps {
  pairs: CryptoPair[];
  activeAlerts: PriceAlert[];
  triggeredAlerts: PriceAlert[];
  onAdd: (data: PriceAlertFormData) => void;
  onRemove: (id: string) => void;
  onClearTriggered: () => void;
}

export function PriceAlertsPanel({
  pairs,
  activeAlerts,
  triggeredAlerts,
  onAdd,
  onRemove,
  onClearTriggered,
}: PriceAlertsPanelProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getProgressToTarget = (alert: PriceAlert) => {
    const pair = pairs.find(p => p.symbol === alert.symbol);
    if (!pair) return null;

    const currentPrice = pair.price;
    const target = alert.targetPrice;
    
    if (alert.condition === 'above') {
      const diff = ((target - currentPrice) / currentPrice) * 100;
      return { diff, label: `${diff > 0 ? '+' : ''}${diff.toFixed(2)}% até alvo` };
    } else {
      const diff = ((currentPrice - target) / currentPrice) * 100;
      return { diff, label: `${diff > 0 ? '-' : ''}${Math.abs(diff).toFixed(2)}% até alvo` };
    }
  };

  return (
    <div className="trading-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Alertas de Preço
        </h2>
        <AddPriceAlertDialog pairs={pairs} onAdd={onAdd} />
      </div>

      <ScrollArea className="h-[300px]">
        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Ativos ({activeAlerts.length})
            </h3>
            <div className="space-y-2">
              {activeAlerts.map(alert => {
                const progress = getProgressToTarget(alert);
                return (
                  <div
                    key={alert.id}
                    className="p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {alert.condition === 'above' ? (
                          <TrendingUp className="h-4 w-4 text-success" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        )}
                        <span className="font-medium">{alert.symbol}</span>
                        <Badge variant="outline" className="text-xs">
                          {alert.condition === 'above' ? 'Acima' : 'Abaixo'}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemove(alert.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Alvo: <span className="text-foreground font-mono">${alert.targetPrice.toLocaleString()}</span>
                      </span>
                      {progress && (
                        <span className="text-muted-foreground text-xs">
                          {progress.label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Triggered Alerts */}
        {triggeredAlerts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                Disparados ({triggeredAlerts.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={onClearTriggered}
              >
                Limpar
              </Button>
            </div>
            <div className="space-y-2">
              {triggeredAlerts.slice(0, 5).map(alert => (
                <div
                  key={alert.id}
                  className="p-3 rounded-lg bg-success/10 border border-success/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="font-medium">{alert.symbol}</span>
                      <span className="text-success text-sm">✓ Atingido</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(alert.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    ${alert.targetPrice.toLocaleString()} • {alert.triggeredAt && formatTime(alert.triggeredAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {activeAlerts.length === 0 && triggeredAlerts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Bell className="h-12 w-12 mb-4 opacity-30" />
            <p>Nenhum alerta configurado</p>
            <p className="text-sm">Crie alertas para ser notificado</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
