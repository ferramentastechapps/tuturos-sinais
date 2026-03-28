import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Thermometer, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fetchFearGreedIndex, FearGreedData } from '@/services/fearGreedIndex';

export function FearGreedCard() {
  const [data, setData] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // Atualiza a cada 5 minutos
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const result = await fetchFearGreedIndex();
      setData(result);
    } catch (error) {
      console.error('Erro ao buscar Fear & Greed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getColor = (value: number) => {
    if (value <= 25) return 'text-red-500';
    if (value <= 45) return 'text-orange-500';
    if (value <= 55) return 'text-yellow-500';
    if (value <= 75) return 'text-green-500';
    return 'text-emerald-500';
  };

  const getGradient = (value: number) => {
    if (value <= 25) return 'from-red-500/20 to-red-500/5';
    if (value <= 45) return 'from-orange-500/20 to-orange-500/5';
    if (value <= 55) return 'from-yellow-500/20 to-yellow-500/5';
    if (value <= 75) return 'from-green-500/20 to-green-500/5';
    return 'from-emerald-500/20 to-emerald-500/5';
  };

  const getBorderColor = (value: number) => {
    if (value <= 25) return 'border-red-500/30';
    if (value <= 45) return 'border-orange-500/30';
    if (value <= 55) return 'border-yellow-500/30';
    if (value <= 75) return 'border-green-500/30';
    return 'border-emerald-500/30';
  };

  const getLabel = (value: number) => {
    if (value <= 25) return 'Medo Extremo';
    if (value <= 45) return 'Medo';
    if (value <= 55) return 'Neutro';
    if (value <= 75) return 'Ganância';
    return 'Ganância Extrema';
  };

  const getIcon = (value: number) => {
    if (value <= 45) return <TrendingDown className="h-4 w-4" />;
    if (value <= 55) return <Minus className="h-4 w-4" />;
    return <TrendingUp className="h-4 w-4" />;
  };

  const getAdvice = (value: number) => {
    if (value <= 25) return 'Oportunidade de compra';
    if (value <= 45) return 'Cautela, mas pode ser entrada';
    if (value <= 55) return 'Mercado equilibrado';
    if (value <= 75) return 'Cuidado com topos';
    return 'Risco de correção alta';
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-blue-400" />
            Ganância do Mercado
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

  if (!data) {
    return (
      <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-blue-400" />
            Ganância do Mercado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Dados indisponíveis
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-gradient-to-br ${getGradient(data.value)} ${getBorderColor(data.value)}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Thermometer className="h-4 w-4 text-muted-foreground" />
          Ganância do Mercado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Valor Principal */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${getColor(data.value)}`}>
                {data.value}
              </span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <div className={getColor(data.value)}>
              {getIcon(data.value)}
            </div>
          </div>
          <p className={`text-sm font-medium mt-1 ${getColor(data.value)}`}>
            {getLabel(data.value)}
          </p>
        </div>

        {/* Termômetro Visual */}
        <div className="space-y-2">
          <div className="relative h-3 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full overflow-hidden">
            <div 
              className="absolute top-0 bottom-0 w-1 bg-white shadow-lg transition-all duration-500"
              style={{ left: `${data.value}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>

        {/* Separador */}
        <div className="border-t border-border/40"></div>

        {/* Conselho */}
        <div className="bg-background/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Interpretação:</p>
          <p className="text-sm font-medium">{getAdvice(data.value)}</p>
        </div>

        {/* Última Atualização */}
        <div className="text-center">
          <span className="text-xs text-muted-foreground">
            Atualizado {new Date(data.timestamp).toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
