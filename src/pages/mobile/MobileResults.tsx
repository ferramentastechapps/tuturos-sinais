import { useState } from 'react';
import { useSignalHistory } from '@/hooks/useSignalHistory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Loader2, ChevronLeft, ChevronRight, Target, Clock } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { TradeSignal } from '@/types/trading';

type FilterTab = 'ACTIVE' | 'CLOSED_TP' | 'CLOSED_SL';

interface SignalResultCardProps {
  signal: TradeSignal;
  tab: FilterTab;
}

const SignalResultCard = ({ signal, tab }: SignalResultCardProps) => {
  const isLong = (signal.type as string).toUpperCase() === 'LONG';
  const isWin = (signal.status as string).toUpperCase() === 'CLOSED_TP';
  const isStop = (signal.status as string).toUpperCase() === 'CLOSED_SL';
  const isActive = (signal.status as string).toUpperCase() === 'ACTIVE';

  const statusColor = isWin
    ? 'border-l-signal-buy'
    : isStop
    ? 'border-l-signal-sell'
    : 'border-l-primary';

  return (
    <div className={cn(
      "bg-card border border-border/40 border-l-4 rounded-xl p-4 space-y-3 shadow-sm",
      statusColor
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base text-foreground">{signal.pair}</span>
          <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full",
            isLong ? "bg-signal-buy/15 text-signal-buy" : "bg-signal-sell/15 text-signal-sell"
          )}>
            {isLong ? '▲ LONG' : '▼ SHORT'}
          </span>
        </div>
        <div>
          {isWin && <Badge className="bg-signal-buy text-white text-[10px]">✅ WIN</Badge>}
          {isStop && <Badge className="bg-signal-sell text-white text-[10px]">🛑 STOP</Badge>}
          {isActive && <Badge className="bg-primary text-white text-[10px]">🔵 ATIVO</Badge>}
        </div>
      </div>

      {/* Price grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center bg-muted/30 rounded-lg p-2">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Entrada</p>
          <p className="text-xs font-mono font-bold text-foreground">{formatCurrency(signal.entry)}</p>
        </div>
        <div className="text-center bg-signal-buy/10 rounded-lg p-2">
          <p className="text-[9px] text-signal-buy uppercase tracking-wide mb-0.5">TP</p>
          <p className="text-xs font-mono font-bold text-signal-buy">
            {formatCurrency(signal.takeProfit1 ?? signal.takeProfit)}
          </p>
        </div>
        <div className="text-center bg-signal-sell/10 rounded-lg p-2">
          <p className="text-[9px] text-signal-sell uppercase tracking-wide mb-0.5">SL</p>
          <p className="text-xs font-mono font-bold text-signal-sell">{formatCurrency(signal.stopLoss)}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {format(new Date(signal.createdAt), 'dd/MM HH:mm')}
        </span>
        {signal.quality?.score != null && (
          <span className={cn(
            "font-bold",
            signal.quality.score >= 80 ? "text-signal-buy" : "text-warning"
          )}>
            ⚡ {signal.quality.score}/100
          </span>
        )}
      </div>
    </div>
  );
};

const tabConfig: { key: FilterTab; label: string; icon: string; status: string }[] = [
  { key: 'ACTIVE', label: 'Ativo', icon: '🔵', status: 'ACTIVE' },
  { key: 'CLOSED_TP', label: 'Win', icon: '✅', status: 'CLOSED_TP' },
  { key: 'CLOSED_SL', label: 'Stop', icon: '🛑', status: 'CLOSED_SL' },
];

const MobileResults = () => {
  const [activeTab, setActiveTab] = useState<FilterTab>('ACTIVE');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useSignalHistory({
    page,
    limit: 20,
    status: activeTab,
  });

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader />
      <div className="flex flex-col gap-4 px-3 pt-3 pb-24">
      <h1 className="text-xl font-bold text-foreground">Resultados</h1>

      {/* Tab selector */}
      <div className="flex bg-muted/40 rounded-xl p-1 gap-1">
        {tabConfig.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-all",
              activeTab === tab.key
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground"
            )}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {!isLoading && data && activeTab === tab.key && (
              <span className="text-[10px] bg-primary/15 text-primary rounded-full px-1.5 ml-0.5">
                {data.total}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm animate-pulse">Carregando...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12 text-signal-sell text-sm">
          Erro ao carregar histórico.
        </div>
      ) : !data?.signals.length ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
          <Target className="w-12 h-12 opacity-20" />
          <p className="text-sm">Nenhum sinal encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.signals.map(signal => (
            <SignalResultCard key={signal.id} signal={signal} tab={activeTab} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= data.totalPages || isLoading}
            className="gap-1"
          >
            Próximo
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      </div>
    </div>
  );
};

export default MobileResults;
