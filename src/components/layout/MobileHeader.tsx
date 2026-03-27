import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  /** right slot — optional extra action */
  rightAction?: React.ReactNode;
}

const PAGE_TITLES: Record<string, string> = {
  '/m/sinais': 'Sinais',
  '/m/grafico': 'Gráfico',
  '/m/backtest': 'Backtesting',
  '/m/posicoes': 'Posições',
  '/m/resultados': 'Resultados',
};

export const MobileHeader = ({ rightAction }: MobileHeaderProps) => {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? 'Dashboard';

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-background/90 backdrop-blur-md border-b border-border/40">
      {/* Logo + Page Title */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Zap className="w-4 h-4 text-primary" />
        </div>
        <h1 className="text-base font-bold text-foreground tracking-tight">{title}</h1>
      </div>

      {/* Right action slot */}
      {rightAction ?? (
        <div className="w-8 h-8" />
      )}
    </header>
  );
};
