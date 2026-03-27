import { useState } from 'react';
import { useMobileDashboard } from '@/hooks/useMobileDashboard';
import { CandlestickChart } from '@/components/trading/CandlestickChart';
import { TechnicalPanel } from '@/components/trading/TechnicalPanel';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MobileChart = () => {
  const { cryptoPairs, isLoading, selectedPair, setSelectedPair, enrichedSignals } = useMobileDashboard();
  const [showTechnical, setShowTechnical] = useState(false);

  if (isLoading || !selectedPair) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm animate-pulse">Carregando gráfico...</p>
      </div>
    );
  }

  const activeSignal = enrichedSignals.find(
    s => s.pair === selectedPair.symbol
      && ['active', 'pending'].includes((s.status as string).toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      <MobileHeader />
      {/* Horizontal coin scroller */}
      <div className="flex gap-2 overflow-x-auto px-3 pt-3 pb-1 scrollbar-none">
        {cryptoPairs.map(pair => {
          const isSelected = selectedPair.symbol === pair.symbol;
          const change = pair.change24h;
          return (
            <button
              key={pair.symbol}
              onClick={() => setSelectedPair(pair)}
              className={cn(
                "flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border transition-all text-left min-w-[72px]",
                isSelected
                  ? "bg-primary/15 border-primary shadow-sm"
                  : "bg-card border-border/40"
              )}
            >
              <span className={cn("text-xs font-bold", isSelected ? "text-primary" : "text-foreground")}>
                {pair.symbol.replace('USDT', '')}
              </span>
              <span className={cn("text-[10px] font-mono font-semibold mt-0.5", change >= 0 ? "text-signal-buy" : "text-signal-sell")}>
                {change >= 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Current pair header */}
      <div className="px-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{selectedPair.symbol}</h2>
            {activeSignal && (
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                activeSignal.type === 'long' ? "bg-signal-buy/20 text-signal-buy" : "bg-signal-sell/20 text-signal-sell"
              )}>
                {activeSignal.type === 'long' ? '▲ LONG' : '▼ SHORT'}
              </span>
            )}
          </div>
          <p className="text-xl font-mono font-bold text-foreground">
            ${selectedPair.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <button
          onClick={() => setShowTechnical(v => !v)}
          className={cn(
            "text-xs px-3 py-1.5 rounded-lg border transition-all font-medium",
            showTechnical
              ? "bg-primary/15 border-primary text-primary"
              : "border-border/40 text-muted-foreground"
          )}
        >
          Indicadores
        </button>
      </div>

      {/* Chart */}
      <div className="px-2">
        <CandlestickChart symbol={selectedPair.symbol} name={selectedPair.name} />
      </div>

      {/* Technical panel (toggle) */}
      {showTechnical && (
        <div className="px-3">
          <TechnicalPanel symbol={selectedPair.symbol} />
        </div>
      )}
    </div>
  );
};

export default MobileChart;
