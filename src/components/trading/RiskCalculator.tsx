import { useState, useMemo } from 'react';
import { Calculator, DollarSign, Percent, Scale, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const RiskCalculator = () => {
  const [isOpen, setIsOpen] = useState(false);
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
    <div className="trading-card transition-all duration-300">
      <div 
        className="flex items-center justify-between cursor-pointer group select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <h2 className="text-sm sm:text-base font-semibold text-foreground">Calculadora de Risco</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 hover:bg-muted/50">
          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </Button>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-3.5 animate-fade-up">
          {/* Warning */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/5 border border-warning/15">
            <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />
            <p className="text-[10px] sm:text-xs text-warning leading-normal">
              Futuros envolvem alto risco. Nunca opere com dinheiro que não pode perder.
            </p>
          </div>

          {/* Account Balance & Risk Percent */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-2.5 h-2.5" /> Saldo (USDT)
              </Label>
              <Input
                type="number"
                value={accountBalance}
                onChange={(e) => setAccountBalance(Number(e.target.value))}
                className="font-mono text-xs h-8 px-2 bg-secondary/30 border-border/50 focus-visible:ring-1"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Percent className="w-2.5 h-2.5" /> Risco
                </Label>
                <span className="text-[10px] font-mono text-primary font-bold">{riskPercent}%</span>
              </div>
              <Input
                type="number"
                value={riskPercent}
                onChange={(e) => setRiskPercent(Number(e.target.value))}
                className="font-mono text-xs h-8 px-2 bg-secondary/30 border-border/50 focus-visible:ring-1"
                min={0.5}
                max={10}
                step={0.5}
              />
            </div>
          </div>

          {/* Slider for Risk */}
          <div className="space-y-1">
            <Slider
              value={[riskPercent]}
              onValueChange={([value]) => setRiskPercent(value)}
              min={0.5}
              max={10}
              step={0.5}
              className="py-1"
            />
            <p className="text-[9px] text-muted-foreground text-right">
              Risco máx: <span className="font-mono font-bold text-foreground">${calculations.riskAmount.toFixed(2)}</span>
            </p>
          </div>

          {/* Price Inputs */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <div className="space-y-0.5">
              <Label className="text-[9px] text-muted-foreground">Entrada</Label>
              <Input
                type="number"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                className="font-mono text-xs h-7 px-1.5 bg-secondary/30 border-border/50"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px] text-destructive">Stop Loss</Label>
              <Input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(Number(e.target.value))}
                className="font-mono text-xs h-7 px-1.5 border-destructive/20 bg-destructive/5 text-destructive font-semibold"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px] text-success">Take Profit</Label>
              <Input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(Number(e.target.value))}
                className="font-mono text-xs h-7 px-1.5 border-success/20 bg-success/5 text-success font-semibold"
              />
            </div>
          </div>

          {/* Results Table */}
          <div className="pt-3.5 border-t border-border/45 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Tamanho da Posição</span>
              <span className="font-mono font-bold text-foreground">
                {calculations.positionSize.toFixed(6)} BTC
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Valor da Posição</span>
              <span className="font-mono font-semibold text-foreground">
                ${calculations.positionValue.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Lucro Potencial</span>
              <span className="font-mono font-bold text-success">
                +${calculations.potentialProfit.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">Risco/Retorno</span>
              </div>
              <span className="font-mono font-bold text-primary text-sm">
                1:{calculations.riskReward.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground text-xs">Alavancagem Recomendada</span>
              <span
                className={cn(
                  'font-mono font-bold text-xs',
                  calculations.leverageRecommended > 10 ? 'text-warning' : 'text-foreground'
                )}
              >
                {calculations.leverageRecommended}x
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
