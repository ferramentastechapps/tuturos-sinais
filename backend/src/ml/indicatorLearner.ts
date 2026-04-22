import { db } from '../lib/dbClient.js';
import { logger } from '../lib/logger.js';

/**
 * IndicatorLearner
 * Analisa o histórico de TradeSignals (win/loss) e calcula o Win Rate
 * individual de cada indicador cruzado por par/moeda.
 */
export class IndicatorLearner {
    
    // Calcula as métricas atuais com base em todo o histórico de TradeSignal
    public async recalculatePerformance(): Promise<void> {
        logger.info('[IndicatorLearner] Iniciando recalculo de performance dos indicadores por moeda...');
        try {
            // Busca os trades fechados do banco
            const closedTrades = await db.tradeSignal.findMany({
                where: {
                    status: { in: ['CLOSED_TP', 'CLOSED_SL'] }
                },
                select: {
                    pair: true,
                    outcome: true,
                    pnl: true,
                    indicators: true,
                }
            });

            if (!closedTrades || closedTrades.length === 0) {
                logger.info('[IndicatorLearner] Nenhum trade finalizado encontrado para análise.');
                return;
            }

            // Estrutura de agregação
            // pair -> indicatorName -> metrics
            const stats: Record<string, Record<string, { wins: number; losses: number; totalPnl: number }>> = {};

            for (const trade of closedTrades) {
                if (!trade.indicators) continue;
                
                let indicatorsList: string[] = [];
                try {
                    indicatorsList = typeof trade.indicators === 'string' ? JSON.parse(trade.indicators) : trade.indicators;
                } catch(e) {
                    continue;
                }

                if (!Array.isArray(indicatorsList)) continue;
                
                const pair = trade.pair;
                if (!stats[pair]) stats[pair] = {};
                
                const isWin = trade.outcome === 'WIN';
                const pnl = trade.pnl ?? 0;

                for (const ind of indicatorsList) {
                    if (!ind) continue;
                    
                    // Limpa o nome (remove emojis se existirem p/ normalizar)
                    const cleanName = ind.replace(/[✅❌⚡🐋]/g, '').trim();
                    
                    if (!stats[pair][cleanName]) {
                        stats[pair][cleanName] = { wins: 0, losses: 0, totalPnl: 0 };
                    }
                    
                    if (isWin) {
                        stats[pair][cleanName].wins += 1;
                    } else {
                        stats[pair][cleanName].losses += 1;
                    }
                    stats[pair][cleanName].totalPnl += pnl;
                }
            }

            let updatedCount = 0;

            // Salvar no banco (upsert em IndicatorPerformance)
            for (const pair of Object.keys(stats)) {
                for (const ind of Object.keys(stats[pair])) {
                    const data = stats[pair][ind];
                    const totalEdges = data.wins + data.losses;
                    if (totalEdges === 0) continue;
                    
                    const win_rate = data.wins / totalEdges;
                    const avg_pnl = data.totalPnl / totalEdges;

                    await db.indicatorPerformance.upsert({
                        where: {
                            pair_indicator: { pair: pair, indicator: ind }
                        },
                        update: {
                            total_trades: totalEdges,
                            wins: data.wins,
                            losses: data.losses,
                            win_rate: win_rate,
                            avg_pnl: avg_pnl,
                        },
                        create: {
                            pair: pair,
                            indicator: ind,
                            total_trades: totalEdges,
                            wins: data.wins,
                            losses: data.losses,
                            win_rate: win_rate,
                            avg_pnl: avg_pnl,
                        }
                    });
                    updatedCount++;
                }
            }

            logger.info(`[IndicatorLearner] Recalculo finalizado! ${updatedCount} registros de performance atualizados/criados.`);
        } catch (error) {
            logger.error('[IndicatorLearner] Erro ao recalcular performance:', error);
        }
    }

    /**
     * Retorna a performance histórica para as confluências atuais de um determinado par.
     * Retorna um recorde onde a chave é o nome limpo do indicador e o valor é o Win Rate.
     */
    public async getPairPerformance(pair: string): Promise<Record<string, { winRate: number; avgPnl: number; totalTrades: number }>> {
        const perf: Record<string, { winRate: number; avgPnl: number; totalTrades: number }> = {};
        
        try {
            const data = await db.indicatorPerformance.findMany({
                where: { pair: pair }
            });
            
            for (const row of data) {
                perf[row.indicator] = {
                    winRate: row.win_rate,
                    avgPnl: row.avg_pnl ?? 0,
                    totalTrades: row.total_trades
                };
            }
        } catch (e) {
            // Se der erro de tabela (por ex migrate não rodou ainda), ignoramos silenciosamente
        }
        
        return perf;
    }
}

export const indicatorLearner = new IndicatorLearner();

// Executa automaticamente a cada hora se importado no index do server
setInterval(() => {
    indicatorLearner.recalculatePerformance().catch(console.error);
}, 60 * 60 * 1000);
