import { tradeSignals } from '@/data/mockData';
import { SignalCard } from './SignalCard';
import { Zap, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const SignalsPanel = () => {
  const activeSignals = tradeSignals.filter(s => s.status === 'active');
  const completedSignals = tradeSignals.filter(s => s.status !== 'active');

  return (
    <div className="trading-card h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Sinais de Trade</h2>
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Filter className="w-4 h-4 mr-1" />
          Filtrar
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="w-full mb-4 bg-secondary">
          <TabsTrigger value="active" className="flex-1">
            Ativos ({activeSignals.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1">
            Histórico ({completedSignals.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="space-y-3 mt-0">
          {activeSignals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>Nenhum sinal ativo no momento</p>
            </div>
          ) : (
            activeSignals.map(signal => (
              <SignalCard key={signal.id} signal={signal} />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3 mt-0">
          {completedSignals.map(signal => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};
