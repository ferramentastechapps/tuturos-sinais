import { useMemo } from 'react';
import { Transaction } from '@/types/transactions';
import { TradeWithMetrics } from '@/types/trades';

export interface TaxReport {
  year: number;
  totalGains: number;
  totalLosses: number;
  netGains: number;
  shortTermGains: number;
  longTermGains: number;
  taxableIncome: number;
  estimatedTax: number;
  transactions: TaxTransaction[];
}

export interface TaxTransaction {
  date: Date;
  asset: string;
  type: 'gain' | 'loss';
  amount: number;
  costBasis: number;
  proceeds: number;
  holdingPeriod: number; // days
  isLongTerm: boolean;
}

interface UseTaxCalculatorProps {
  transactions: Transaction[];
  trades: TradeWithMetrics[];
  taxRate?: number; // default 15% for crypto in Brazil
  longTermThreshold?: number; // days to be considered long-term
}

export const useTaxCalculator = ({
  transactions,
  trades,
  taxRate = 0.15,
  longTermThreshold = 365,
}: UseTaxCalculatorProps) => {
  const taxReport: TaxReport = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const taxTransactions: TaxTransaction[] = [];

    // Process closed trades
    const closedTrades = trades.filter(t => t.status === 'closed' && t.closedAt);
    
    closedTrades.forEach(trade => {
      if (!trade.closedAt) return;

      const holdingPeriod = Math.floor(
        (trade.closedAt.getTime() - trade.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      const isLongTerm = holdingPeriod >= longTermThreshold;
      const costBasis = trade.investedValue + (trade.entryFee || 0);
      const proceeds = trade.currentValue - (trade.exitFee || 0);
      const gainLoss = proceeds - costBasis;

      taxTransactions.push({
        date: trade.closedAt,
        asset: trade.symbol,
        type: gainLoss >= 0 ? 'gain' : 'loss',
        amount: Math.abs(gainLoss),
        costBasis,
        proceeds,
        holdingPeriod,
        isLongTerm,
      });
    });

    // Calculate totals
    const totalGains = taxTransactions
      .filter(t => t.type === 'gain')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalLosses = taxTransactions
      .filter(t => t.type === 'loss')
      .reduce((sum, t) => sum + t.amount, 0);

    const netGains = totalGains - totalLosses;

    const shortTermGains = taxTransactions
      .filter(t => t.type === 'gain' && !t.isLongTerm)
      .reduce((sum, t) => sum + t.amount, 0);

    const longTermGains = taxTransactions
      .filter(t => t.type === 'gain' && t.isLongTerm)
      .reduce((sum, t) => sum + t.amount, 0);

    // In Brazil, crypto gains under R$35k/month are tax-exempt
    // For simplicity, we'll apply a flat rate to net gains
    const taxableIncome = Math.max(0, netGains);
    const estimatedTax = taxableIncome * taxRate;

    return {
      year: currentYear,
      totalGains,
      totalLosses,
      netGains,
      shortTermGains,
      longTermGains,
      taxableIncome,
      estimatedTax,
      transactions: taxTransactions,
    };
  }, [transactions, trades, taxRate, longTermThreshold]);

  const exportTaxReport = () => {
    const report = {
      ...taxReport,
      generatedAt: new Date().toISOString(),
      disclaimer: 'Este relatório é apenas uma estimativa. Consulte um contador para cálculos precisos.',
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax_report_${taxReport.year}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportTaxCSV = () => {
    const headers = ['Data', 'Ativo', 'Tipo', 'Custo Base', 'Valor Venda', 'Ganho/Perda', 'Período (dias)', 'Longo Prazo'];
    const rows = taxReport.transactions.map(tx => [
      tx.date.toISOString().split('T')[0],
      tx.asset,
      tx.type === 'gain' ? 'Ganho' : 'Perda',
      tx.costBasis.toFixed(2),
      tx.proceeds.toFixed(2),
      (tx.type === 'gain' ? tx.amount : -tx.amount).toFixed(2),
      tx.holdingPeriod,
      tx.isLongTerm ? 'Sim' : 'Não',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax_report_${taxReport.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    taxReport,
    exportTaxReport,
    exportTaxCSV,
  };
};
