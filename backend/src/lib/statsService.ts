import { db } from './dbClient.js';
import { logger } from './logger.js';

export async function getPairStatsRanking(options: { tradeType?: string; dateRange?: string; type?: string }) {
    const { tradeType, dateRange, type } = options;
    const filter: any = { status: { in: ['CLOSED_TP', 'CLOSED_SL'] } };

    if (type && type !== 'ALL') filter.type = type.toLowerCase();

    if (tradeType && tradeType !== 'ALL') {
        if (tradeType === 'Scalping') filter.trade_type = 'Scalping';
        else if (tradeType === 'Main') filter.trade_type = { not: 'Scalping' };
    }

    if (dateRange && dateRange !== 'ALL') {
        const now = new Date();
        let fromDate: Date;
        if (dateRange === 'day') fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        else if (dateRange === 'week') { fromDate = new Date(now); fromDate.setDate(now.getDate() - now.getDay()); fromDate.setHours(0,0,0,0); }
        else if (dateRange === 'month') fromDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        else fromDate = new Date(0);
        filter.created_at = { gte: fromDate };
    }

    const closedSignals = await db.tradeSignal.findMany({
        where: filter,
        select: { pair: true, status: true, entry_range_low: true, entry_range_high: true, stop_loss: true, take_profits: true }
    });

    // Aggregate per pair
    const pairMap: Record<string, { pair: string; wins: number; losses: number; pnl: number }> = {};
    for (const s of closedSignals) {
        if (!pairMap[s.pair]) pairMap[s.pair] = { pair: s.pair, wins: 0, losses: 0, pnl: 0 };
        const entry = (s.entry_range_low + s.entry_range_high) / 2;

        if (s.status === 'CLOSED_TP') {
            pairMap[s.pair].wins++;
            try {
                const tps = JSON.parse(s.take_profits);
                const tpPrice = tps?.[0]?.price ?? entry;
                pairMap[s.pair].pnl += Math.abs((tpPrice - entry) / entry) * 100;
            } catch(_) { pairMap[s.pair].pnl += 0; }
        } else {
            pairMap[s.pair].losses++;
            pairMap[s.pair].pnl -= Math.abs((entry - s.stop_loss) / entry) * 100;
        }
    }

    const allPairs = Object.values(pairMap).map(p => ({
        ...p,
        total: p.wins + p.losses,
        winRate: p.wins + p.losses > 0 ? (p.wins / (p.wins + p.losses)) * 100 : 0,
    }));

    const topWinners = [...allPairs]
        .filter(p => p.wins > 0)
        .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);

    const topLosers = [...allPairs]
        .filter(p => p.losses > 0)
        .sort((a, b) => b.losses - a.losses || a.winRate - b.winRate);

    return { topWinners, topLosers };
}
