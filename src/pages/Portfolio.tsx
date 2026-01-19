import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePortfolio } from '@/hooks/usePortfolio';
import { PortfolioSummaryCard } from '@/components/portfolio/PortfolioSummaryCard';
import { PortfolioTable } from '@/components/portfolio/PortfolioTable';
import { PortfolioAllocationChart } from '@/components/portfolio/PortfolioAllocationChart';
import { PortfolioPerformanceCard } from '@/components/portfolio/PortfolioPerformanceCard';
import { PortfolioPnLChart } from '@/components/portfolio/PortfolioPnLChart';
import { AddAssetDialog } from '@/components/portfolio/AddAssetDialog';

const Portfolio = () => {
  const { summary, addAsset, removeAsset, livePrices } = usePortfolio();
  const isLive = livePrices && livePrices.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Portfolio Tracker</h1>
              {isLive && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-success/10 text-success text-xs rounded-full">
                  <RefreshCw className="h-3 w-3" />
                  Ao vivo
                </span>
              )}
            </div>
          </div>
          <AddAssetDialog onAdd={addAsset} />
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <PortfolioSummaryCard summary={summary} />
        
        {/* Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <PortfolioAllocationChart assets={summary.assets} />
          <PortfolioPnLChart summary={summary} />
          <PortfolioPerformanceCard assets={summary.assets} />
        </div>
        
        <PortfolioTable assets={summary.assets} onRemove={removeAsset} />

        <footer className="pt-6 border-t border-border text-center text-sm text-muted-foreground">
          <p>Os dados são salvos localmente no seu navegador.</p>
          <p className="mt-1">
            {isLive ? 'Preços atualizados a cada 30 segundos via CoinGecko.' : 'Preços baseados em dados de demonstração.'}
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Portfolio;
