import { Target, AlertTriangle, TrendingUp, Activity, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AlertDemoPanelProps {
  onTriggerTP: () => void;
  onTriggerSL: () => void;
  onTriggerVolatility: () => void;
  onTriggerTrend: () => void;
  onTriggerEntry: () => void;
}

export function AlertDemoPanel({
  onTriggerTP,
  onTriggerSL,
  onTriggerVolatility,
  onTriggerTrend,
  onTriggerEntry,
}: AlertDemoPanelProps) {
  return (
    <div className="trading-card p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <h3 className="text-sm sm:text-base font-semibold text-foreground">Testar Alertas</h3>
        <span className="text-[10px] sm:text-xs text-muted-foreground">(Demo)</span>
      </div>
      
      <div className="grid grid-cols-2 xs:grid-cols-3 sm:flex sm:flex-wrap gap-2">
        <Button
          onClick={onTriggerTP}
          size="sm"
          className="bg-trading-profit/20 text-trading-profit hover:bg-trading-profit/30 border border-trading-profit/30 text-xs sm:text-sm h-8 sm:h-9"
        >
          <Target className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
          <span className="hidden xs:inline">Take Profit</span>
          <span className="xs:hidden">TP</span>
        </Button>
        
        <Button
          onClick={onTriggerSL}
          size="sm"
          variant="destructive"
          className="bg-trading-loss/20 text-trading-loss hover:bg-trading-loss/30 border border-trading-loss/30 text-xs sm:text-sm h-8 sm:h-9"
        >
          <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
          <span className="hidden xs:inline">Stop Loss</span>
          <span className="xs:hidden">SL</span>
        </Button>
        
        <Button
          onClick={onTriggerVolatility}
          size="sm"
          className="bg-trading-warning/20 text-trading-warning hover:bg-trading-warning/30 border border-trading-warning/30 text-xs sm:text-sm h-8 sm:h-9"
        >
          <Activity className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
          <span className="hidden sm:inline">Alta Volatilidade</span>
          <span className="sm:hidden">Volat.</span>
        </Button>
        
        <Button
          onClick={onTriggerTrend}
          size="sm"
          className="bg-trading-accent/20 text-trading-accent hover:bg-trading-accent/30 border border-trading-accent/30 text-xs sm:text-sm h-8 sm:h-9"
        >
          <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
          <span className="hidden sm:inline">Mudança Tendência</span>
          <span className="sm:hidden">Tendência</span>
        </Button>
        
        <Button
          onClick={onTriggerEntry}
          size="sm"
          className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 text-xs sm:text-sm h-8 sm:h-9 col-span-2 xs:col-span-1"
        >
          <Zap className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
          Novo Sinal
        </Button>
      </div>
    </div>
  );
}
