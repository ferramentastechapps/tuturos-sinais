import { BacktestTrade } from '@/types/backtestTypes';

export const DEFAULT_OPTIMIZATION_PARAMS = [
    {
        name: 'Score Mínimo',
        field: 'signal.minScore',
        values: [60, 65, 70, 75, 80],
    },
    {
        name: 'Capital Máximo por Posição (%)',
        field: 'signal.maxCapitalPerPosition',
        values: [10, 15, 20, 25],
    },
    {
        name: 'Max Posições Simultâneas',
        field: 'signal.maxSimultaneousPositions',
        values: [3, 5, 7, 10],
    },
];

export const exportTradesToCSV = (trades: BacktestTrade[]): string => {
    const headers = [
        'ID', 'Symbol', 'Type', 'Entry Time', 'Exit Time', 'Entry Price', 'Exit Price',
        'Quantity', 'Leverage', 'Gross PnL', 'Fees', 'Funding', 'Net PnL', 'PnL %',
        'Exit Reason', 'Signal Score', 'Confidence', 'Risk Score', 'MFE %', 'MAE %',
        'Duration (h)', 'Signals',
    ];

    const rows = trades.map(t => [
        t.id,
        t.symbol,
        t.type,
        new Date(t.entryTime).toISOString(),
        new Date(t.exitTime).toISOString(),
        t.entryPrice.toFixed(4),
        t.exitPrice.toFixed(4),
        t.quantity.toFixed(6),
        t.leverage,
        t.grossPnl.toFixed(2),
        t.fees.toFixed(2),
        t.fundingPaid.toFixed(2),
        t.netPnl.toFixed(2),
        t.pnlPercent.toFixed(2),
        t.exitReason,
        t.signalScore,
        t.signalConfidence,
        t.riskScore,
        t.maxFavorableExcursion.toFixed(2),
        t.maxAdverseExcursion.toFixed(2),
        (t.duration / (60 * 60 * 1000)).toFixed(1),
        t.signalIndicators.join('; '),
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
};
