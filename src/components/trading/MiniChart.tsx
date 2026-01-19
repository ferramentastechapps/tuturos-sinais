import { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

interface MiniChartProps {
  data?: number[];
  isPositive?: boolean;
}

export const MiniChart = ({ data, isPositive = true }: MiniChartProps) => {
  const chartData = useMemo(() => {
    if (data) return data.map((value, index) => ({ value, index }));
    
    // Generate mock data for demo
    const mockData = [];
    let value = 67000;
    for (let i = 0; i < 24; i++) {
      value = value + (Math.random() - 0.45) * 500;
      mockData.push({ value, index: i });
    }
    return mockData;
  }, [data]);

  const color = isPositive ? 'hsl(142, 72%, 45%)' : 'hsl(0, 72%, 55%)';

  return (
    <div className="h-20 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`gradient-${isPositive ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${isPositive ? 'up' : 'down'})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
