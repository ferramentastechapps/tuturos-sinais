import { Link } from 'react-router-dom';
import { TrendingUp, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const SimpleHeader = () => {
  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="h-full px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center glow-primary">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">CryptoFutures</h1>
              <p className="text-xs text-muted-foreground">Bybit Trading</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
