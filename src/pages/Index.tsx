import { useState, useCallback, useEffect } from 'react';
import { useAlerts } from '@/hooks/useAlerts';
import { useMarketMonitor } from '@/hooks/useMarketMonitor';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useTrades } from '@/hooks/useTrades';
import { useWatchlist } from '@/hooks/useWatchlist';
import { Header } from '@/components/trading/Header';
import { MarketTicker } from '@/components/trading/MarketTicker';
import { PriceCard } from '@/components/trading/PriceCard';
import { TechnicalPanel } from '@/components/trading/TechnicalPanel';
import { SignalsPanel } from '@/components/trading/SignalsPanel';
import { RiskCalculator } from '@/components/trading/RiskCalculator';
import { SentimentGauge } from '@/components/trading/SentimentGauge';
import { RiskDisclaimer } from '@/components/trading/RiskDisclaimer';
import { MiniChart } from '@/components/trading/MiniChart';
import { AlertDemoPanel } from '@/components/trading/AlertDemoPanel';
import { HistoricalChart } from '@/components/trading/HistoricalChart';
import { PriceAlertsPanel } from '@/components/trading/PriceAlertsPanel';
import { WatchlistPanel } from '@/components/trading/WatchlistPanel';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { tradeSignals } from '@/data/mockData';
import { CryptoPair } from '@/types/trading';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { data: cryptoPairs = [], isLoading } = useCryptoPrices();
  const [selectedPair, setSelectedPair] = useState<CryptoPair | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Portfolio and trades for dashboard
  const { summary: portfolioSummary } = usePortfolio();
  const { trades: recentTrades } = useTrades();

  // Watchlist
  const {
    items: watchlistItems,
    addToWatchlist,
    removeFromWatchlist,
    toggleAlert,
    isInWatchlist,
  } = useWatchlist();

  // Update selectedPair when prices load or change
  useEffect(() => {
    if (cryptoPairs.length > 0) {
      setSelectedPair(prev => {
        if (!prev) return cryptoPairs[0];
        const updated = cryptoPairs.find(p => p.symbol === prev.symbol);
        return updated || cryptoPairs[0];
      });
    }
  }, [cryptoPairs]);

  const {
    alerts,
    unreadCount,
    triggerTPAlert,
    triggerSLAlert,
    triggerVolatilityAlert,
    triggerTrendChangeAlert,
    triggerEntrySignal,
    markAsRead,
    markAllAsRead,
    clearAlerts,
  } = useAlerts({ enableSound: soundEnabled });

  // Monitor market for alerts
  useMarketMonitor({
    pairs: cryptoPairs,
    signals: tradeSignals,
    onTPHit: triggerTPAlert,
    onSLHit: triggerSLAlert,
    onHighVolatility: triggerVolatilityAlert,
    onTrendChange: triggerTrendChangeAlert,
    volatilityThreshold: 3,
    enabled: cryptoPairs.length > 0,
  });

  // Price alerts monitoring
  const {
    activeAlerts,
    triggeredAlerts,
    addAlert,
    removeAlert,
    clearTriggeredAlerts,
  } = usePriceAlerts({
    pairs: cryptoPairs,
    enabled: cryptoPairs.length > 0,
  });

  const handleToggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  if (isLoading || !selectedPair) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando preços ao vivo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        alerts={alerts}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onClearAlerts={clearAlerts}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
      />
      <MarketTicker />
      
      <main className="container px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        {/* Dashboard Overview */}
        <div className="mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Visão Geral</h2>
          <DashboardOverview
            portfolioSummary={portfolioSummary}
            recentTrades={recentTrades}
            activeAlerts={activeAlerts}
          />
        </div>

        {/* Risk Disclaimer */}
        <div className="mb-4 sm:mb-6">
          <RiskDisclaimer />
        </div>

        {/* Demo Alert Panel */}
        <div className="mb-4 sm:mb-6">
          <AlertDemoPanel
            onTriggerTP={() => triggerTPAlert('BTCUSDT', 69500, 3.42)}
            onTriggerSL={() => triggerSLAlert('ETHUSDT', 3200, -4.2)}
            onTriggerVolatility={() => triggerVolatilityAlert('SOLUSDT', 5.8)}
            onTriggerTrend={() => triggerTrendChangeAlert('BTCUSDT', 'bullish', '4H')}
            onTriggerEntry={() => triggerEntrySignal('BTCUSDT', 'LONG', 67500, 82)}
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Left Column - Market Overview */}
          <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
            <div className="trading-card">
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Favoritos</h2>
              <div className="grid grid-cols-2 sm:grid-cols-1 gap-3">
                {cryptoPairs.filter(p => p.isFavorite).map(pair => (
                  <PriceCard
                    key={pair.symbol}
                    pair={pair}
                    isSelected={selectedPair?.symbol === pair.symbol}
                    onClick={() => setSelectedPair(pair)}
                  />
                ))}
              </div>
            </div>
            
            <SentimentGauge />

            <WatchlistPanel
              items={watchlistItems}
              livePrices={cryptoPairs}
              onRemove={removeFromWatchlist}
              onToggleAlert={toggleAlert}
              onAdd={addToWatchlist}
              isInWatchlist={isInWatchlist}
            />

            <PriceAlertsPanel
              pairs={cryptoPairs}
              activeAlerts={activeAlerts}
              triggeredAlerts={triggeredAlerts}
              onAdd={addAlert}
              onRemove={removeAlert}
              onClearTriggered={clearTriggeredAlerts}
            />
          </div>

          {/* Center Column - Chart & Technical */}
          <div className="lg:col-span-5 space-y-4 order-1 lg:order-2">
            {/* Selected Pair Header */}
            <div className="trading-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">{selectedPair.symbol}</h2>
                  <p className="text-sm text-muted-foreground">{selectedPair.name} Perpetual</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-2xl sm:text-3xl font-bold font-mono text-foreground">
                    ${selectedPair.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className={`text-base sm:text-lg font-mono ${selectedPair.change24h >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {selectedPair.change24h >= 0 ? '+' : ''}{selectedPair.change24h.toFixed(2)}%
                  </p>
                </div>
              </div>
              <MiniChart isPositive={selectedPair.change24h >= 0} />
            </div>

            <HistoricalChart symbol={selectedPair.symbol} name={selectedPair.name} />

            <TechnicalPanel />
          </div>

          {/* Right Column - Signals & Calculator */}
          <div className="lg:col-span-4 space-y-4 order-3">
            <SignalsPanel />
            <RiskCalculator />
          </div>
        </div>

        {/* All Pairs Section */}
        <div className="mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">Todos os Pares</h2>
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {cryptoPairs.map(pair => (
              <PriceCard
                key={pair.symbol}
                pair={pair}
                isSelected={selectedPair?.symbol === pair.symbol}
                onClick={() => setSelectedPair(pair)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-border text-center text-xs sm:text-sm text-muted-foreground">
          <p>CryptoFutures © 2024 - Ferramenta de apoio ao trading</p>
          <p className="mt-1">Não constitui aconselhamento financeiro. Use por sua conta e risco.</p>
        </footer>
      </main>
    </div>
  );
};

export default Index;
