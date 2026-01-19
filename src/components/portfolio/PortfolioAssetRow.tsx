import { Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { PortfolioAssetWithMetrics } from '@/types/portfolio';

interface PortfolioAssetRowProps {
  asset: PortfolioAssetWithMetrics;
  onRemove: (id: string) => void;
}

export const PortfolioAssetRow = ({ asset, onRemove }: PortfolioAssetRowProps) => {
  const isPnlPositive = asset.pnl >= 0;
  const isChange24hPositive = asset.change24h >= 0;

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-semibold text-foreground">{asset.symbol}</p>
          <p className="text-sm text-muted-foreground">{asset.name}</p>
        </div>
      </TableCell>
      <TableCell className="text-right font-mono">
        {asset.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}
      </TableCell>
      <TableCell className="text-right font-mono">
        ${asset.averageBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </TableCell>
      <TableCell className="text-right">
        <div className="font-mono">
          ${asset.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`text-sm ${isChange24hPositive ? 'text-success' : 'text-destructive'}`}>
          {isChange24hPositive ? '+' : ''}{asset.change24h.toFixed(2)}%
        </div>
      </TableCell>
      <TableCell className="text-right font-mono font-semibold">
        ${asset.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </TableCell>
      <TableCell className="text-right">
        <div className={`flex items-center justify-end gap-1 font-mono ${isPnlPositive ? 'text-success' : 'text-destructive'}`}>
          {isPnlPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span>{isPnlPositive ? '+' : ''}${asset.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className={`text-sm ${isPnlPositive ? 'text-success' : 'text-destructive'}`}>
          {isPnlPositive ? '+' : ''}{asset.pnlPercentage.toFixed(2)}%
        </div>
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(asset.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};
