import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Shield } from 'lucide-react';

export function UserMenu() {
  const { signOut, loading } = useAuth();

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <div className="h-4 w-4 animate-pulse bg-muted rounded-full" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2">
          {/* Admin avatar */}
          <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white select-none">
            AT
          </div>
          <div className="hidden sm:flex flex-col items-start leading-none">
            <span className="text-xs font-semibold text-foreground max-w-[120px] truncate">
              ferramentastech.apps
            </span>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
              ADMIN
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              AT
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                ferramentastech.apps@gmail.com
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Shield className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                  Acesso Total
                </span>
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={signOut}
          className="gap-2 text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair do Sistema</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
