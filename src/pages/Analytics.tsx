import { SimpleHeader } from '@/components/trading/SimpleHeader';
import { useTrades } from '@/hooks/useTrades';
import { useAnalytics } from '@/hooks/useAnalytics';
import { PerformanceMetricsCard } from '@/components/analytics/PerformanceMetricsCard';
import { EquityCurveChart } from '@/components/analytics/EquityCurveChart';
import { PeriodPerformanceCard } from '@/components/analytics/PeriodPerformanceCard';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const Analytics = () => {
  const { trades } = useTrades();
  const [initialCapital, setInitialCapital] = useState(10000);
  const { performanceMetrics, equityCurve, periodPerformance } = useAnalytics(trades, initialCapital);

  const exportAnalytics = () => {
    const data = {
      initialCapital,
      performanceMetrics,
      equityCurve,
      periodPerformance,
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Análise de Performance</h1>
            <p className="text-muted-foreground">Métricas avançadas e estatísticas</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="capital">Capital Inicial:</Label>
              <Input
                id="capital"
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="w-32"
              />
            </div>
            <Button onClick={exportAnalytics} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        <PerformanceMetricsCard metrics={performanceMetrics} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <EquityCurveChart data={equityCurve} initialCapital={initialCapital} />
          </div>
          <div>
            <PeriodPerformanceCard periods={periodPerformance} />
          </div>
        </div>

        {trades.filter(t => t.status === 'closed').length === 0 && (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground">
              Feche alguns trades para ver suas métricas de performance
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Analytics;
