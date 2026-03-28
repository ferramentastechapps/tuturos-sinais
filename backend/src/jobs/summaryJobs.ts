import cron from 'node-cron';
import { db } from '../lib/dbClient.js';
import { telegramService } from '../notifications/telegramService.js';
import { DailySummaryData } from '../types/telegram.js';
import { logger } from '../lib/logger.js';
import { ActiveSignal } from '../trading/tradeTracker.js';

export function startSummaryJobs() {
    logger.info('[SummaryJobs] Inicializando cron jobs (Diário e Semanal)');

    // Diário - 23:55 UTC todos os dias
    cron.schedule('55 23 * * *', async () => {
        logger.info('[SummaryJobs] Executando job de sumário diário...');
        await generateAndSendSummary('daily');
    }, {
        timezone: 'UTC'
    });

    // Semanal - 23:55 UTC aos domingos
    cron.schedule('55 23 * * 0', async () => {
        logger.info('[SummaryJobs] Executando job de sumário semanal...');
        await generateAndSendSummary('weekly');
    }, {
        timezone: 'UTC'
    });
}

async function generateAndSendSummary(period: 'daily' | 'weekly') {
    try {
        const now = new Date();

        // Usar limites exatos do dia/semana UTC em vez de janela rolante de 24h
        // Isso garante que o resumo represente o dia calendário correto
        let periodStart: Date;
        if (period === 'daily') {
            // Início do dia atual em UTC (00:00:00)
            periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        } else {
            // Últimos 7 dias
            periodStart = new Date(now);
            periodStart.setUTCDate(periodStart.getUTCDate() - 7);
        }

        logger.info(`[SummaryJobs] Período: ${periodStart.toISOString()} → ${now.toISOString()}`);

        // 1. Total de sinais GERADOS no período (todos os status — criados hoje)
        let allSignalsToday: any[] = [];
        try {
            allSignalsToday = await db.activeSignal.findMany({
                where: {
                    created_at: { gte: periodStart, lte: now }
                }
            });
        } catch (error: any) {
            logger.error(`[SummaryJobs] Erro ao buscar sinais gerados: ${error.message}`);
            throw error;
        }

        const signalsGenerated = allSignalsToday.length;
        logger.info(`[SummaryJobs] Encontrados ${signalsGenerated} sinais gerados no período.`);

        // 2. Trades FECHADOS no período (para cálculo de PnL, wins e losses)
        let closedSignals: any[] = [];
        try {
            closedSignals = await db.activeSignal.findMany({
                where: {
                    status: { in: ['CLOSED_TP', 'CLOSED_SL'] },
                    updated_at: { gte: periodStart, lte: now }
                }
            });
        } catch (error: any) {
            logger.error(`[SummaryJobs] Erro ao buscar trades fechados: ${error.message}`);
            throw error;
        }

        const signals = (closedSignals || []) as unknown as ActiveSignal[];
        logger.info(`[SummaryJobs] Encontrados ${signals.length} trades fechados.`);

        let winners = 0;
        let losers = 0;
        let totalPnl = 0;

        let bestTrade = { symbol: '', pnlPercent: -9999 };
        let worstTrade = { symbol: '', pnlPercent: 9999 };

        // Processa cada trade fechado
        for (const signal of signals) {
            const isWinner = signal.status === 'CLOSED_TP';
            if (isWinner) winners++;
            else losers++;

            let tradePnl = 0;
            const entryAvg = (signal.entry_range_low + signal.entry_range_high) / 2;

            if (isWinner) {
                const lastTp = signal.take_profits && signal.take_profits.length > 0 && signal.take_profits[0].hit
                    ? signal.take_profits.filter((t: any) => t.hit).pop()?.price || entryAvg
                    : entryAvg;
                    
                tradePnl = signal.type === 'LONG'
                    ? ((lastTp - entryAvg) / entryAvg) * 100
                    : ((entryAvg - lastTp) / entryAvg) * 100;
            } else {
                tradePnl = signal.type === 'LONG'
                    ? ((signal.stop_loss - entryAvg) / entryAvg) * 100
                    : ((entryAvg - signal.stop_loss) / entryAvg) * 100;
            }

            totalPnl += tradePnl;

            if (tradePnl > bestTrade.pnlPercent) {
                bestTrade = { symbol: signal.pair, pnlPercent: tradePnl };
            }
            if (tradePnl < worstTrade.pnlPercent) {
                worstTrade = { symbol: signal.pair, pnlPercent: tradePnl };
            }
        }

        const dateLabel = period === 'daily'
            ? now.toISOString().split('T')[0]
            : `Semana ${now.toISOString().split('T')[0]}`;

        // Top signals (apenas como fallback sem lógica AI extra no cron para não pesar)
        const summaryData: DailySummaryData = {
            date: dateLabel,
            signalsGenerated,
            winners,
            losers,
            pnlPercent: totalPnl,
            bestTrade: bestTrade.symbol ? bestTrade : undefined,
            worstTrade: worstTrade.symbol ? worstTrade : undefined,
            topSignals: [],
            alerts: []
        };

        // Enviar report
        await telegramService.sendDailySummary(summaryData);

        // Salvar em banco de dados para dashboard / relatórios
        await db.dailySummary.create({
            data: {
                summary_date: dateLabel,
                total_signals: signals.length,
                winners,
                losers,
                pnl: totalPnl,
                full_report_text: JSON.stringify(summaryData)
            }
        });

        logger.info(`[SummaryJobs] Report ${period} gerado e enviado com sucesso (${signals.length} trades fechados).`);
    } catch (err) {
        logger.error(`[SummaryJobs] Falha ao gerar relatório ${period}:`, err);
    }
}
