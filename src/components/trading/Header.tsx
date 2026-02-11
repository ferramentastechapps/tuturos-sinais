import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Settings, TrendingUp, Shield, Briefcase, ClipboardList, Menu, Moon, Sun, BarChart3, Receipt, FileText, BrainCircuit } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { AlertsPanel } from './AlertsPanel';
import { TradingAlert } from '@/types/alerts';
import { UserMenu } from '@/components/auth/UserMenu';

interface HeaderProps {
  alerts: TradingAlert[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAlerts: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  totalCapital?: number;
  dailyPnL?: number;
}

export const Header = ({
  alerts,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAlerts,
  soundEnabled,
  onToggleSound,
  totalCapital,
  dailyPnL,
}: HeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <header className="h-14 sm:h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="h-full px-3 sm:px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/20 flex items-center justify-center glow-primary">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div className="hidden xs:block">
              <h1 className="text-base sm:text-lg font-bold text-foreground">CryptoFutures</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Bybit Trading</p>
            </div>
          </div>

          {/* Financial Summary */}
          {(totalCapital !== undefined || dailyPnL !== undefined) && (
            <div className="hidden md:flex items-center gap-4 ml-6 px-4 py-1.5 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Patrimônio Total</span>
                <span className="text-sm font-mono font-bold text-foreground">
                  {totalCapital ? `$${totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '---'}
                </span>
              </div>
              <div className="h-6 w-px bg-border/50" />
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">PnL Diário</span>
                <span className={`text-sm font-mono font-bold ${dailyPnL && dailyPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {dailyPnL ? `${dailyPnL >= 0 ? '+' : ''}$${dailyPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '---'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning/10 border border-warning/20">
            <Shield className="w-4 h-4 text-warning" />
            <span className="text-xs text-warning font-medium">Modo Leitura</span>
          </div>

          <AlertsPanel
            alerts={alerts}
            unreadCount={unreadCount}
            onMarkAsRead={onMarkAsRead}
            onMarkAllAsRead={onMarkAllAsRead}
            onClearAlerts={onClearAlerts}
            soundEnabled={soundEnabled}
            onToggleSound={onToggleSound}
          />

          <Link to="/trades">
            <Button variant="ghost" size="icon" title="Operações">
              <ClipboardList className="w-5 h-5" />
            </Button>
          </Link>

          <Link to="/portfolio">
            <Button variant="ghost" size="icon" title="Portfolio">
              <Briefcase className="w-5 h-5" />
            </Button>
          </Link>

          <Link to="/analytics">
            <Button variant="ghost" size="icon" title="Análise">
              <BarChart3 className="w-5 h-5" />
            </Button>
          </Link>

          <Link to="/ml-analytics">
            <Button variant="ghost" size="icon" title="ML Analytics">
              <BrainCircuit className="w-5 h-5" />
            </Button>
          </Link>

          <Link to="/transactions">
            <Button variant="ghost" size="icon" title="Transações">
              <Receipt className="w-5 h-5" />
            </Button>
          </Link>

          <Link to="/tax-report">
            <Button variant="ghost" size="icon" title="Impostos">
              <FileText className="w-5 h-5" />
            </Button>
          </Link>

          <Link to="/settings">
            <Button variant="ghost" size="icon" title="Configurações">
              <Settings className="w-5 h-5" />
            </Button>
          </Link>

          {/* Theme Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Alterar tema">
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Alterar tema</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="mr-2 h-4 w-4" />
                Claro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="mr-2 h-4 w-4" />
                Escuro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <span className="mr-2">💻</span>
                Sistema
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <UserMenu />
        </div>

        {/* Mobile Navigation */}
        <div className="flex md:hidden items-center gap-1">
          <AlertsPanel
            alerts={alerts}
            unreadCount={unreadCount}
            onMarkAsRead={onMarkAsRead}
            onMarkAllAsRead={onMarkAllAsRead}
            onClearAlerts={onClearAlerts}
            soundEnabled={soundEnabled}
            onToggleSound={onToggleSound}
          />

          {/* Mobile Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Menu
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 mb-4">
                  <Shield className="w-4 h-4 text-warning" />
                  <span className="text-sm text-warning font-medium">Modo Leitura</span>
                </div>

                <Link to="/trades" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <ClipboardList className="w-5 h-5" />
                    Operações
                  </Button>
                </Link>

                <Link to="/portfolio" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <Briefcase className="w-5 h-5" />
                    Portfolio
                  </Button>
                </Link>

                <Link to="/analytics" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <BarChart3 className="w-5 h-5" />
                    Análise
                  </Button>
                </Link>

                <Link to="/ml-analytics" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <BrainCircuit className="w-5 h-5" />
                    ML Analytics
                  </Button>
                </Link>

                <Link to="/transactions" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <Receipt className="w-5 h-5" />
                    Transações
                  </Button>
                </Link>

                <Link to="/tax-report" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <FileText className="w-5 h-5" />
                    Impostos
                  </Button>
                </Link>

                <Link to="/settings" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <Settings className="w-5 h-5" />
                    Configurações
                  </Button>
                </Link>

                <div className="pt-4 border-t border-border">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                  </Button>
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Conta</span>
                  <UserMenu />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
