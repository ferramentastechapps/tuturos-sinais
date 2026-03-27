import React, { useState } from 'react';
import { Pencil, ChevronDown, Share, FileText, Settings2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { usePaperTrading } from '@/hooks/usePaperTrading';
import { PaperPosition } from '@/types/paperTrading';

export const ActivePositionsList = () => {
  const { state, closePosition } = usePaperTrading();
  const [activeTab, setActiveTab] = useState('positions');

  const positions = state?.positions || [];
  const openOrdersCount = 0; // Replace when open orders/limits are implemented

  // Utility to format currency
  const formatCurrency = (val: number, decimals: number = 4) => {
    return val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatPercentage = (val: number) => {
    return val.toFixed(2) + '%';
  };

  const renderPositionCard = (pos: PaperPosition) => {
    const isLong = pos.direction === 'long';
    const isProfit = pos.unrealizedPnl >= 0;
    const pnlColorClass = isProfit ? 'text-signal-buy' : 'text-signal-sell';
    
    // Value = margin * leverage or quantity * entryPrice
    const positionValue = pos.quantity * pos.currentPrice;

    return (
      <div key={pos.id} className="border-b border-border/40 p-4 space-y-4 hover:bg-muted/10 transition-colors">
        {/* Header Row */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground leading-none">{pos.symbol}</h3>
            </div>
            <div className="flex items-center gap-1 mt-1.5 text-xs font-medium">
              <span className={isLong ? 'text-signal-buy' : 'text-signal-sell'}>
                {isLong ? 'Long' : 'Short'}
              </span>
              <span className="text-muted-foreground px-1">|</span>
              <span className="text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">
                Cruzar {pos.leverage}x <Pencil className="w-3 h-3" />
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-muted-foreground flex items-center justify-end gap-1 cursor-pointer hover:text-foreground transition-colors">
              PnL não realizado (USDT) <Share className="w-3 h-3 ml-1" />
            </div>
            <div className={`text-base font-mono font-bold mt-1 ${pnlColorClass}`}>
              {isProfit ? '+' : ''}{formatCurrency(pos.unrealizedPnl, 2)}({isProfit ? '+' : ''}{formatPercentage(pos.unrealizedPnlPercent)})
            </div>
          </div>
        </div>

        {/* Data Grid */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="space-y-1">
            <p className="text-muted-foreground">Valor(USDT) ⇄</p>
            <p className="font-mono text-sm font-medium">{formatCurrency(positionValue, 4)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Preço de entrada</p>
            <p className="font-mono text-sm font-medium">{formatCurrency(pos.entryPrice, 4)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Preço de mercado</p>
            <p className="font-mono text-sm font-medium">{formatCurrency(pos.currentPrice, 4)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground truncate" title="Preço de liq. estimado">Preço de liq. est...</p>
            <p className="font-mono text-sm font-medium text-[#FF9900]">{formatCurrency(pos.liquidationPrice, 4)}</p>
          </div>
        </div>

        {/* TP / SL Bar */}
        <div className="bg-muted/30 rounded-md p-2 flex justify-between items-center text-xs">
          <span className="text-muted-foreground font-medium">TP/SL</span>
          <div className="flex items-center gap-4">
            <span>
              Posição inteira:{' '}
              <span className="text-signal-buy font-mono">{pos.takeProfit1 ? formatCurrency(pos.takeProfit1) : '--'}</span>
              <span className="text-muted-foreground mx-0.5">/</span>
              <span className="text-signal-sell font-mono">{pos.stopLoss ? formatCurrency(pos.stopLoss) : '--'}</span>
            </span>
            <span>Posição parcial: 0</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" className="h-8 flex-1 text-xs border-border/50 bg-background/50 hover:bg-muted">
            Configurar TP/SL
          </Button>
          <Button variant="outline" size="sm" className="h-8 flex-1 text-xs border-border/50 bg-background/50 hover:bg-muted">
            Trailing-Stop
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 flex-1 text-xs border-border/50 bg-background/50 hover:bg-muted"
            onClick={() => closePosition(pos.id)}
          >
            Fechamento a Mercado
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between border-b border-border/40 px-2 bg-muted/10">
          <TabsList className="bg-transparent h-12 p-0 space-x-6">
            <TabsTrigger 
              value="orders" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-2 text-sm text-muted-foreground data-[state=active]:text-foreground"
            >
              Ordens({openOrdersCount})
            </TabsTrigger>
            <TabsTrigger 
              value="positions" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-2 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
            >
              Posições({positions.length})
            </TabsTrigger>
            <TabsTrigger 
              value="assets" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-2 text-sm text-muted-foreground data-[state=active]:text-foreground"
            >
              Ativos
            </TabsTrigger>
            <TabsTrigger 
              value="tools" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-2 text-sm text-muted-foreground data-[state=active]:text-foreground"
            >
              Ferramentas
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
              <span className="w-3 h-3 border border-current rounded-sm flex items-center justify-center">
                <span className="w-1.5 h-1.5 bg-current rounded-sm"></span>
              </span>
              Todos os mercados <ChevronDown className="w-3 h-3 ml-0.5" />
            </div>
            <span className="text-muted-foreground">⇌</span>
            <Button variant="ghost" size="sm" className="h-8 text-xs font-medium cursor-pointer hover:bg-muted/50 rounded-md">
              Fechar tudo
            </Button>
          </div>
        </div>

        <TabsContent value="positions" className="m-0 border-none outline-none p-0 overflow-x-auto min-h-[300px]">
          {positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <FileText className="w-12 h-12 mb-4 opacity-20" />
              <p>Você não tem posições abertas</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setActiveTab('orders')}>
                Ver Ordens
              </Button>
            </div>
          ) : (
            <div className="flex flex-col min-w-[700px]">
              {positions.map(renderPositionCard)}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="orders" className="m-0 border-none outline-none p-0 min-h-[300px] flex items-center justify-center">
          <div className="text-muted-foreground text-sm text-center">
            <FileText className="w-12 h-12 mb-4 opacity-20 mx-auto" />
            <p>Nenhuma ordem ativa encontrada</p>
          </div>
        </TabsContent>

        <TabsContent value="assets" className="m-0 border-none outline-none p-0 min-h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Resumo de Ativos não disponível</p>
        </TabsContent>

        <TabsContent value="tools" className="m-0 border-none outline-none p-0 min-h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Ferramentas avançadas indisponíveis em simulação</p>
        </TabsContent>
      </Tabs>
    </div>
  );
};
