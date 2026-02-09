import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AuthDialog } from './AuthDialog';
import { LogIn, LogOut, User, Bell, Cloud } from 'lucide-react';

export function UserMenu() {
  const { user, profile, isAuthenticated, signOut, loading } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const navigate = useNavigate();

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <div className="h-4 w-4 animate-pulse bg-muted rounded-full" />
      </Button>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setAuthDialogOpen(true)}
          className="gap-2"
        >
          <LogIn className="h-4 w-4" />
          <span className="hidden sm:inline">Entrar</span>
        </Button>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      </>
    );
  }

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Usuário';
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline max-w-[100px] truncate text-sm">
            {displayName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
          <Cloud className="h-4 w-4" />
          <span>Alertas sincronizados</span>
          <span className="ml-auto text-xs text-success">✓</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/profile')} className="gap-2">
          <User className="h-4 w-4" />
          <span>Perfil</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/profile')} className="gap-2">
          <Bell className="h-4 w-4" />
          <span>Notificações</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
