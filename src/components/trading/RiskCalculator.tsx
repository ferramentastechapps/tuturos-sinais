import { useState, useMemo } from 'react';
import { Calculator, DollarSign, Percent, Scale, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export const RiskCalculator = () => {
  const [accountBalance, setAccountBalance] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(2);
  const [entryPrice, setEntryPrice] = useState(67500);
  const [stopLoss, setStopLoss] = useState(66500);
  const [takeProfit, setTakeProfit] = useState(70000);

  const calculations = useMemo(() => {
    const riskAmount = (accountBalance * riskPercent) / 100;
    const stopDistance = Math.abs(entryPrice - stopLoss);
    const tpDistance = Math.abs(takeProfit - entryPrice);
    const riskReward = stopDistance > 0 ? tpDistance / stopDistance : 0;
    const positionSize = stopDistance > 0 ? riskAmount / stopDistance : 0;
    const positionValue = positionSize * entryPrice;
    const potentialProfit = positionSize * tpDistance;
    const leverageRecommended = Math.min(Math.floor(positionValue / accountBalance), 20);

    return {
      riskAmount,
      positionSize,
      positionValue,
      potentialProfit,
      riskReward,
      leverageRecommended,
    };
  }, [accountBalance, riskPercent, entryPrice, stopLoss, takeProfit]);

  return (
    <div className="trading-card h-full">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Calculadora de Risco</h2>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-warning/10 border border-warning/20">
        <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
        <p className="text-xs text-warning">
          Trading de futuros envolve alto risco. Nunca opere com dinheiro que não pode perder.
        </p>
      </div>

      <div className="space-y-4">
        {/* Account Balance */}
        <div className="space-y-2">
          <Label className="text-muted-foreground flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            Saldo da Conta (USDT)
          </Label>
          <Input
            type="number"
            value={accountBalance}
            onChange={(e) => setAccountBalance(Number(e.target.value))}
            className="font-mono"
          />
        </div>

        {/* Risk Percent */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground flex items-center gap-1">
              <Percent className="w-3 h-3" />
              Risco por Trade
            </Label>
            <span className="text-sm font-mono text-primary">{riskPercent}%</span>
          </div>
          <Slider
            value={[riskPercent]}
            onValueChange={([value]) => setRiskPercent(value)}
            min={0.5}
            max={10}
            step={0.5}
            className="py-2"
          />
          <p className="text-xs text-muted-foreground">
            Risco máximo: ${calculations.riskAmount.toFixed(2)}
          </p>
        </div>

        {/* Price Inputs */}
        <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Entrada</Label>
            <Input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(Number(e.target.value))}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-destructive">Stop Loss</Label>
            <Input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(Number(e.target.value))}
              className="font-mono text-sm border-destructive/30"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-success">Take Profit</Label>
            <Input
              type="number"
              value={takeProfit}
              onChange={(e) => setTakeProfit(Number(e.target.value))}
              className="font-mono text-sm border-success/30"
            />
          </div>
        </div>

        {/* Results */}
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Tamanho da Posição</span>
            <span className="font-mono font-semibold text-foreground">
              {calculations.positionSize.toFixed(6)} BTC
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Valor da Posição</span>
            <span className="font-mono font-semibold text-foreground">
              ${calculations.positionValue.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Lucro Potencial</span>
            <span className="font-mono font-semibold text-success">
              +${calculations.potentialProfit.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center p-2 rounded-lg bg-primary/10">
            <div className="flex items-center gap-1">
              <Scale className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary">Risco/Retorno</span>
            </div>
            <span className="font-mono font-bold text-primary">
              1:{calculations.riskReward.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Alavancagem Recomendada</span>
            <span
              className={cn(
                'font-mono font-semibold',
                calculations.leverageRecommended > 10 ? 'text-warning' : 'text-foreground'
              )}
            >
              {calculations.leverageRecommended}x
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
