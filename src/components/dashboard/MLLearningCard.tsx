import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, ArrowUpRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useMLLearning, MLLearningItem } from '@/hooks/useMLLearning';

function LearningItem({ learning, index }: { learning: MLLearningItem; index: number }) {
  const isWin = learning.result === 'WIN';
  const wasCorrect = learning.ml_was_correct;
  
  return (
    <div className={`
      p-3 rounded-lg border-l-4
      ${isWin 
        ? 'bg-green-500/5 border-green-500' 
        : 'bg-red-500/5 border-red-500'
      }
    `}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/60 font-mono">#{index + 1}</span>
          <span className="font-semibold text-sm">{learning.symbol}</span>
          <span className={`
            text-[10px] px-1.5 py-0.5 rounded font-bold
            ${isWin ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}
          `}>
            {learning.result}
          </span>
        </div>
        <span className={`text-xs font-bold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
          {learning.profit_percent >= 0 ? '+' : ''}{learning.profit_percent.toFixed(2)}%
        </span>
      </div>
      
      <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1.5">
        {wasCorrect ? (
          <>
            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
            <span>IA acertou - conhecimento reforçado</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
            <span>IA errou - parâmetros ajustados</span>
          </>
        )}
      </div>
      
      {learning.key_indicators.length > 0 && (
        <div className="text-[10px] text-muted-foreground/70 mt-1.5 font-medium">
          {learning.key_indicators.join(', ')}
        </div>
      )}
    </div>
  );
}

export function MLLearningCard() {
  const navigate = useNavigate();
  const { learnings, stats, loading } = useMLLearning(5);

  return (
    <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-500/20">
      <CardHeader className="pb-3 px-4 pt-4">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-400" />
            Aprendizado Recente da IA
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 text-xs text-blue-400 hover:text-blue-300"
            onClick={() => navigate('/ml-analytics')}
          >
            Ver todos <ArrowUpRight className="ml-1 h-3 w-3" />
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="px-4 pb-4">
        {loading && learnings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs">Carregando histórico...</span>
          </div>
        ) : learnings.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            Nenhuma operação finalizada ainda.
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              {learnings.map((learning, idx) => (
                <LearningItem key={learning.id} learning={learning} index={idx} />
              ))}
            </div>
            
            <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Accuracy da IA
                </div>
                <div className="text-lg font-bold text-green-400 mt-0.5">
                  {stats.accuracy}%
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Op. Analisadas
                </div>
                <div className="text-lg font-bold text-blue-400 mt-0.5">
                  {stats.total}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
