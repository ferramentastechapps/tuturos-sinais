import { SimpleHeader } from '@/components/trading/SimpleHeader';
import { useTrades } from '@/hooks/useTrades';
import { AddTradeDialog } from '@/components/trades/AddTradeDialog';
import { TradesTable } from '@/components/trades/TradesTable';
import { TradesSummaryCard } from '@/components/trades/TradesSummaryCard';

const Trades = () => {
  const { trades, summary, addTrade, closeTrade, deleteTrade } = useTrades();

  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Registro de Operações</h1>
            <p className="text-muted-foreground">Acompanhe suas operações e P&L</p>
          </div>
          <AddTradeDialog onAdd={addTrade} />
        </div>

        <TradesSummaryCard summary={summary} />
        
        <TradesTable 
          trades={trades} 
          onClose={closeTrade} 
          onDelete={deleteTrade} 
        />
      </main>
    </div>
  );
};

export default Trades;
