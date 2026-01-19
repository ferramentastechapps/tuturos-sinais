import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PortfolioAssetWithMetrics } from '@/types/portfolio';
import { PortfolioAssetRow } from './PortfolioAssetRow';
import { Briefcase } from 'lucide-react';

interface PortfolioTableProps {
  assets: PortfolioAssetWithMetrics[];
  onRemove: (id: string) => void;
}

export const PortfolioTable = ({ assets, onRemove }: PortfolioTableProps) => {
  if (assets.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum ativo no portfólio</p>
            <p className="text-sm">Adicione seus primeiros ativos para começar a acompanhar seu portfólio.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          Meus Ativos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Preço Médio</TableHead>
                <TableHead className="text-right">Preço Atual</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map(asset => (
                <PortfolioAssetRow
                  key={asset.id}
                  asset={asset}
                  onRemove={onRemove}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
