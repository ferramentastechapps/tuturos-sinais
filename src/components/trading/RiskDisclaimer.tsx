import { AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const RiskDisclaimer = () => {
  return (
    <Alert className="bg-warning/5 border-warning/20">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle className="text-warning">Aviso de Risco</AlertTitle>
      <AlertDescription className="text-muted-foreground text-sm">
        Trading de criptomoedas e futuros envolve riscos significativos. 
        Este aplicativo é uma ferramenta de apoio à decisão e não constitui 
        aconselhamento financeiro. Nunca opere com capital que não pode perder.
        Resultados passados não garantem resultados futuros.
      </AlertDescription>
    </Alert>
  );
};
