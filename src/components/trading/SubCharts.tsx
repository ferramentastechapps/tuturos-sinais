import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface ChartDataPoint {
    date: number;
    price: number;
    rsi?: number;
    macd?: number;
    macdSignal?: number;
    macdHistogram?: number;
    stochK?: number;
    stochD?: number;
    [key: string]: any;
}

interface SubChartProps {
    data: ChartDataPoint[];
    height?: number;
    showXAxis?: boolean;
}

export const RSIChart = ({ data, height = 80, showXAxis = false }: SubChartProps) => {
    return (
        <div style={{ height }}>
            <div className="flex items-center justify-between mb-1 px-1">
                <p className="text-[10px] text-muted-foreground font-medium">RSI (14)</p>
                <div className="flex gap-2">
                    <span className="text-[9px] text-destructive">70</span>
                    <span className="text-[9px] text-success">30</span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                    {showXAxis && <XAxis dataKey="date" hide />}
                    <YAxis
                        domain={[0, 100]}
                        ticks={[30, 50, 70]}
                        fontSize={9}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                        width={30}
                    />
                    <ReferenceLine y={70} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <ReferenceLine y={30} stroke="hsl(var(--success))" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.3} />
                    <Line
                        type="monotone"
                        dataKey="rsi"
                        stroke="hsl(var(--primary))"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

export const MACDChart = ({ data, height = 80, showXAxis = false }: SubChartProps) => {
    return (
        <div style={{ height }}>
            <p className="text-[10px] text-muted-foreground mb-1 px-1 font-medium">MACD (12, 26, 9)</p>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                    {showXAxis && <XAxis dataKey="date" hide />}
                    <YAxis
                        fontSize={9}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                        width={30}
                        tickFormatter={(v) => v.toFixed(0)}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.3} />
                    <Bar
                        dataKey="macdHistogram"
                        fill="hsl(var(--primary))"
                        opacity={0.5}
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="macd"
                        stroke="hsl(var(--primary))"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="macdSignal"
                        stroke="hsl(var(--warning))"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

export const StochasticChart = ({ data, height = 80, showXAxis = false }: SubChartProps) => {
    return (
        <div style={{ height }}>
            <div className="flex items-center justify-between mb-1 px-1">
                <p className="text-[10px] text-muted-foreground font-medium">Stoch (14, 3)</p>
                <div className="flex gap-2">
                    <span className="text-[9px] text-destructive">80</span>
                    <span className="text-[9px] text-success">20</span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                    {showXAxis && <XAxis dataKey="date" hide />}
                    <YAxis
                        domain={[0, 100]}
                        ticks={[20, 50, 80]}
                        fontSize={9}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                        width={30}
                    />
                    <ReferenceLine y={80} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <ReferenceLine y={20} stroke="hsl(var(--success))" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.3} />
                    <Line
                        type="monotone"
                        dataKey="stochK"
                        stroke="hsl(var(--primary))"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="stochD"
                        stroke="hsl(var(--warning))"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};
