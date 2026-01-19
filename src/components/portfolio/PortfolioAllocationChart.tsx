import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart as PieChartIcon } from 'lucide-react';
import { PortfolioAssetWithMetrics } from '@/types/portfolio';

interface PortfolioAllocationChartProps {
  assets: PortfolioAssetWithMetrics[];
}

const COLORS = [
  'hsl(174, 72%, 50%)', // primary cyan
  'hsl(142, 72%, 45%)', // success green
  'hsl(38, 92%, 50%)',  // warning orange
  'hsl(280, 72%, 55%)', // purple
  'hsl(200, 72%, 50%)', // blue
  'hsl(0, 72%, 55%)',   // destructive red
  'hsl(60, 72%, 50%)',  // yellow
  'hsl(320, 72%, 50%)', // pink
];

export const PortfolioAllocationChart = ({ assets }: PortfolioAllocationChartProps) => {
  const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0);
  
  const chartData = assets
    .filter(a => a.currentValue > 0)
    .map((asset, index) => ({
      name: asset.symbol.toUpperCase(),
      value: asset.currentValue,
      percentage: totalValue > 0 ? (asset.currentValue / totalValue) * 100 : 0,
      color: COLORS[index % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-primary" />
            Alocação
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground text-sm">Adicione ativos para ver a alocação</p>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            ${data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm font-mono text-primary">{data.percentage.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = () => (
    <div className="flex flex-wrap justify-center gap-3 mt-2">
      {chartData.map((entry, index) => (
        <div key={entry.name} className="flex items-center gap-1.5">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground">
            {entry.name} ({entry.percentage.toFixed(1)}%)
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-primary" />
          Alocação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    stroke="hsl(220, 18%, 10%)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {renderLegend()}
      </CardContent>
    </Card>
  );
};
