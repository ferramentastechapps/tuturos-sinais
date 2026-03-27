import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBacktest } from '@/hooks/useBacktest';
import BacktestWidget from '@/components/dashboard/BacktestWidget';
import { MobileHeader } from '@/components/layout/MobileHeader';

const MobileBacktest = () => {
  const { startQuickBacktest, isRunning, progress, error } = useBacktest();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader />
      <div className="px-3 pt-3 pb-24 space-y-4">
        <div className="flex flex-col gap-1 mb-2">
          <h1 className="text-xl font-bold text-foreground">Backtesting</h1>
          <p className="text-sm text-muted-foreground">
            Teste estratégias com dados históricos
          </p>
        </div>

        {/* Quick Backtest Action for Mobile */}
        <div className="bg-card border border-border/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Simulação Rápida</h3>
              <p className="text-xs text-muted-foreground">Últimos 90 dias com a configuração do robô</p>
            </div>
          </div>
          
          <Button 
            className="w-full font-semibold shadow-md shadow-primary/20" 
            onClick={() => startQuickBacktest()}
            disabled={isRunning}
          >
            {isRunning ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {progress?.percentComplete ? `${progress.percentComplete}% - Analisando...` : 'Iniciando...'}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Rodar Backtest (90 dias)
              </span>
            )}
          </Button>
          
          {error && (
            <p className="text-xs text-signal-sell mt-2 bg-signal-sell/10 p-2 rounded-md border border-signal-sell/20">
              {error}
            </p>
          )}
        </div>

        <BacktestWidget />
      </div>
    </div>
  );
};

export default MobileBacktest;
