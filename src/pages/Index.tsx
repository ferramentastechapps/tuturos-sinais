import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAlerts } from '@/hooks/useAlerts';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useTrades } from '@/hooks/useTrades';
import { useTechnicalIndicators } from '@/hooks/useTechnicalIndicators';
import { useMarketMonitor } from '@/hooks/useMarketMonitor';
import { useIndicatorAlerts } from '@/hooks/useIndicatorAlerts';
import { useIndicatorAlertsDB } from '@/hooks/useIndicatorAlertsDB';
import { useRealTimeSignals } from '@/hooks/useRealTimeSignals';
import { useAuth } from '@/hooks/useAuth';
import { startTelegramMonitor, stopTelegramMonitor, updatePortfolioCapital } from '@/services/telegramNotificationMonitor';

// Components
import { Header } from '@/components/trading/Header';
import { MarketTicker } from '@/components/trading/MarketTicker';
import { ActiveSignals } from '@/components/dashboard/ActiveSignals';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CoinSidebar } from '@/components/dashboard/CoinSidebar';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { CandlestickChart } from '@/components/trading/CandlestickChart';
import { AdvancedChart } from '@/components/trading/AdvancedChart';
import { TechnicalPanel } from '@/components/trading/TechnicalPanel';
import { SignalsPanel } from '@/components/trading/SignalsPanel';
import { RiskCalculator } from '@/components/trading/RiskCalculator';
import { IndicatorAlertsPanel } from '@/components/trading/IndicatorAlertsPanel';
import { PriceAlertsPanel } from '@/components/trading/PriceAlertsPanel';
import { AlertDemoPanel } from '@/components/trading/AlertDemoPanel';
import { Loader2 } from 'lucide-react';
import { RiskDisclaimer } from '@/components/trading/RiskDisclaimer';
import BacktestWidget from '@/components/dashboard/BacktestWidget';

// Data & Types
import { tradeSignals } from '@/data/mockData';
import { CryptoPair, TechnicalIndicator } from '@/types/trading';
import { getCoinSignalScores } from '@/services/dashboardDataService';

const Index = () => {
  const { isAuthenticated } = useAuth();
  const { data: cryptoPairs = [], isLoading } = useCryptoPrices();
  const [selectedPair, setSelectedPair] = useState<CryptoPair | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Portfolio and layout data
  const { summary: portfolioSummary } = usePortfolio();
  const totalValue = portfolioSummary?.totalValue || 0;
  const totalPnL = portfolioSummary?.totalPnL || 0;

  const { trades: recentTrades } = useTrades();

  // Signals for all coins (limit 50 for sidebar scores)
  const { data: allSignals = [] } = useRealTimeSignals({ limit: 50 });

  // Compute scores for sidebar
  const coinScores = useMemo(() =>
    getCoinSignalScores(cryptoPairs, allSignals),
    [cryptoPairs, allSignals]
  );

  // Filter signals for selected pair
  const selectedPairSignal = useMemo(() =>
    allSignals.find(s => s.pair === selectedPair?.symbol && s.status === 'active'),
    [allSignals, selectedPair]
  );

  // Indicator alerts
  const localIndicatorAlerts = useIndicatorAlerts();
  const dbIndicatorAlerts = useIndicatorAlertsDB();

  const {
    alerts: indicatorAlerts,
    unreadCount: indicatorUnreadCount,
    config: indicatorAlertConfig,
    checkIndicators,
    markAsRead: markIndicatorAsRead,
    markAllAsRead: markAllIndicatorAsRead,
    clearAlerts: clearIndicatorAlerts,
    deleteAlert: deleteIndicatorAlert,
    updateConfig: updateIndicatorAlertConfig,
    requestNotificationPermission,
    getNotificationStatus,
  } = isAuthenticated ? dbIndicatorAlerts : localIndicatorAlerts;

  // Technical indicators for selected pair
  const { data: technicalIndicators } = useTechnicalIndicators(selectedPair?.symbol || '');
  const prevIndicatorsRef = useRef<TechnicalIndicator[]>([]);

  // Initialize selected pair
  useEffect(() => {
    if (cryptoPairs.length > 0 && !selectedPair) {
      setSelectedPair(cryptoPairs[0]);
    }
  }, [cryptoPairs, selectedPair]);

  // Start Telegram notification monitor
  useEffect(() => {
    startTelegramMonitor(totalValue || 10000);
    return () => stopTelegramMonitor();
  }, []);

  // Update portfolio capital for risk calculations
  useEffect(() => {
    if (totalValue > 0) {
      updatePortfolioCapital(totalValue);
    }
  }, [totalValue]);

  // Check indicators for alerts
  useEffect(() => {
    if (selectedPair && technicalIndicators && technicalIndicators.length > 0) {
      checkIndicators(
        selectedPair.symbol,
        technicalIndicators,
        selectedPair.price,
        prevIndicatorsRef.current.length > 0 ? prevIndicatorsRef.current : undefined
      );
      prevIndicatorsRef.current = technicalIndicators;
    }
  }, [selectedPair, technicalIndicators, checkIndicators]);

  // General System Alerts
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

  // Market Monitor
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

  // Price Alerts
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
          <p className="text-muted-foreground animate-pulse">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        alerts={alerts}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onClearAlerts={clearAlerts}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        totalCapital={totalValue}
        dailyPnL={totalPnL}
      />

      <DashboardLayout
        // ── Sidebar: Coin List ──
        sidebar={
          <CoinSidebar
            pairs={cryptoPairs}
            scores={coinScores}
            selectedSymbol={selectedPair.symbol}
            onSelectPair={setSelectedPair}
          />
        }

        // ── Center: Chart & Analysis ──
        center={
          <div className="space-y-4 pb-20 lg:pb-0">
            {/* Top Stats Overview */}
            <DashboardOverview
              portfolioSummary={portfolioSummary}
              recentTrades={recentTrades}
              activeAlerts={activeAlerts}
            />

            {/* Selected Pair Info & Chart */}
            <div className="trading-card animate-fade-up">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-foreground">{selectedPair.symbol}</h2>
                    {selectedPairSignal && (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${selectedPairSignal.type === 'long'
                        ? 'bg-signal-buy text-white'
                        : 'bg-signal-sell text-white'
                        }`}>
                        {selectedPairSignal.type.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedPair.name} Perpetual</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-3xl font-bold font-mono text-foreground tracking-tight">
                    ${selectedPair.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className={`text-lg font-mono ${selectedPair.change24h >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
                    {selectedPair.change24h >= 0 ? '+' : ''}{selectedPair.change24h.toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Main Charts */}
              <div className="space-y-6">
                <CandlestickChart symbol={selectedPair.symbol} name={selectedPair.name} />
                <AdvancedChart
                  symbol={selectedPair.symbol}
                  name={selectedPair.name}
                  activeSignal={selectedPairSignal}
                />

                <ActiveSignals
                  signals={allSignals}
                  onSelectSignal={(signal) => {
                    const pair = cryptoPairs.find(p => p.symbol === signal.pair);
                    if (pair) setSelectedPair(pair);
                  }}
                />
              </div>
            </div>

            {/* Technical Analysis */}
            <TechnicalPanel symbol={selectedPair.symbol} />

            {/* Dev Tools */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AlertDemoPanel
                onTriggerTP={() => triggerTPAlert('BTCUSDT', 69500, 3.42)}
                onTriggerSL={() => triggerSLAlert('ETHUSDT', 3200, -4.2)}
                onTriggerVolatility={() => triggerVolatilityAlert('SOLUSDT', 5.8)}
                onTriggerTrend={() => triggerTrendChangeAlert('BTCUSDT', 'bullish', '4H')}
                onTriggerEntry={() => triggerEntrySignal('BTCUSDT', 'LONG', 67500, 82)}
              />
            </div>
          </div>
        }

        // ── Right: Tools & Alerts ──
        rightPanel={
          <div className="p-3 space-y-4">
            <BacktestWidget />

            <SignalsPanel symbol={selectedPair.symbol} />

            <RiskCalculator
              currentPrice={selectedPair.price}
              balance={totalValue}
            />

            <IndicatorAlertsPanel
              alerts={indicatorAlerts}
              unreadCount={indicatorUnreadCount}
              config={indicatorAlertConfig}
              onMarkAsRead={markIndicatorAsRead}
              onMarkAllAsRead={markAllIndicatorAsRead}
              onClearAlerts={clearIndicatorAlerts}
              onDeleteAlert={deleteIndicatorAlert}
              onUpdateConfig={updateIndicatorAlertConfig}
              onRequestNotificationPermission={requestNotificationPermission}
              notificationStatus={getNotificationStatus()}
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
        }

        // ── Bottom: Ticker ──
        bottomBar={<MarketTicker onSelectPair={(symbol) => {
          const pair = cryptoPairs.find(p => p.symbol === symbol);
        }} />}
      />
    </div>
  );
};

export default Index;
