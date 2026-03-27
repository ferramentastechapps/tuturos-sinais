import { Target, BarChart2, FlaskConical, Wallet, ClipboardList } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated || location.pathname === '/login') return null;

  const tabs = [
    { name: 'Sinais', path: '/m/sinais', icon: Target },
    { name: 'Gráfico', path: '/m/grafico', icon: BarChart2 },
    { name: 'Backtest', path: '/m/backtest', icon: FlaskConical },
    { name: 'Posições', path: '/m/posicoes', icon: Wallet },
    { name: 'Resultados', path: '/m/resultados', icon: ClipboardList },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full h-[68px] bg-card/95 backdrop-blur-md border-t border-border z-50 md:hidden flex justify-around items-center px-2 pb-safe shadow-[0_-5px_20px_-10px_rgba(0,0,0,0.5)]">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path || (tab.path !== '/' && location.pathname.startsWith(tab.path));
        const Icon = tab.icon;
        
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={cn(
              "relative flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 active:scale-95",
              isActive ? "text-primary translate-y-[-2px]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("w-[22px] h-[22px]", isActive && "drop-shadow-md")} />
            <span className={cn(
              "text-[10px] font-medium transition-all duration-200", 
              isActive && "font-bold"
            )}>
              {tab.name}
            </span>
            {/* Active Indicator Bar */}
            <div className={cn(
              "absolute top-0 w-8 h-1 rounded-b-full bg-primary transition-all duration-300 opacity-0",
              isActive && "opacity-100"
            )} />
          </button>
        );
      })}
    </div>
  );
};
