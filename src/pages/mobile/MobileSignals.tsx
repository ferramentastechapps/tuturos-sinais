import { useState, useMemo } from 'react';
import { useMobileDashboard } from '@/hooks/useMobileDashboard';
import { ActiveSignals } from '@/components/dashboard/ActiveSignals';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Loader2, Target, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const MobileSignals = () => {
  const { cryptoPairs, isLoading, selectedPair, setSelectedPair, enrichedSignals, activeSignals } = useMobileDashboard();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm animate-pulse">Carregando sinais...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader />
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border/40 rounded-xl p-3 flex flex-col items-center gap-1">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-xl font-bold text-foreground">{activeSignals.length}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Ativos</span>
        </div>
        <div className="bg-card border border-border/40 rounded-xl p-3 flex flex-col items-center gap-1">
          <TrendingUp className="w-4 h-4 text-signal-buy" />
          <span className="text-xl font-bold text-signal-buy">
            {activeSignals.filter(s => s.type === 'long').length}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Long</span>
        </div>
        <div className="bg-card border border-border/40 rounded-xl p-3 flex flex-col items-center gap-1">
          <TrendingDown className="w-4 h-4 text-signal-sell" />
          <span className="text-xl font-bold text-signal-sell">
            {activeSignals.filter(s => s.type === 'short').length}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Short</span>
        </div>
      </div>

      {/* Coin quick-select bar */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {cryptoPairs.slice(0, 10).map(pair => {
          const hasSignal = enrichedSignals.some(s => s.pair === pair.symbol && (s.status === 'active' || s.status === 'pending'));
          const isSelected = selectedPair?.symbol === pair.symbol;
          return (
            <button
              key={pair.symbol}
              onClick={() => setSelectedPair(pair)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-md"
                  : hasSignal
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-card text-muted-foreground border border-border/40"
              )}
            >
              {pair.symbol.replace('USDT', '')}
              {hasSignal && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-signal-buy align-middle" />}
            </button>
          );
        })}
      </div>

      {/* Signals List */}
      <ActiveSignals
        signals={enrichedSignals}
        onSelectSignal={(signal) => {
          const pair = cryptoPairs.find(p => p.symbol === signal.pair);
          if (pair) setSelectedPair(pair);
        }}
      />
    </div>
  );
};

export default MobileSignals;
