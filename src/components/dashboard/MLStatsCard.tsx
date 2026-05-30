import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { useMLStats } from '@/hooks/useMLStats';

export function MLStatsCard() {
  const { stats, loading } = useMLStats();

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-warning/10 to-orange-500/5 border-warning/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-warning" />
            ML Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalSignals === 0) {
    return (
      <Card className="bg-gradient-to-br from-warning/10 to-orange-500/5 border-warning/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-warning" />
            ML Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aguardando dados de treinamento...
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Os dados são coletados quando trades fecham
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-warning/10 to-orange-500/5 border-warning/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-warning" />
          ML Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Win Rate Principal */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">
              {stats.winRate.toFixed(1)}%
            </span>
            <span className="text-sm text-muted-foreground">win rate</span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs">
            <div className="flex items-center gap-1 text-green-500">
              <TrendingUp className="h-3 w-3" />
              <span>{stats.wins} wins</span>
            </div>
            <div className="flex items-center gap-1 text-red-500">
              <TrendingDown className="h-3 w-3" />
              <span>{stats.losses} losses</span>
            </div>
          </div>
        </div>

        {/* Separador */}
        <div className="border-t border-border/40"></div>

        {/* Take Profits Alcançados */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Target className="h-3 w-3" />
            <span>Take Profits Alcançados</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-background/50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-400">{stats.tp1Hits}</div>
              <div className="text-xs text-muted-foreground">TP1</div>
            </div>
            <div className="bg-background/50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-500">{stats.tp2Hits}</div>
              <div className="text-xs text-muted-foreground">TP2</div>
            </div>
            <div className="bg-background/50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-600">{stats.tp3Hits}</div>
              <div className="text-xs text-muted-foreground">TP3</div>
            </div>
          </div>
        </div>

        {/* PnL Médio */}
        <div className="bg-background/50 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">PnL Médio</span>
            <span className={`text-sm font-bold ${stats.avgPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stats.avgPnl >= 0 ? '+' : ''}{stats.avgPnl.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Total de Sinais */}
        <div className="text-center pt-2 border-t border-border/40">
          <span className="text-xs text-muted-foreground">
            {stats.totalSignals} sinais analisados
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
