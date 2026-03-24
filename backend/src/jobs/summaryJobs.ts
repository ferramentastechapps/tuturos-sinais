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
        const past = new Date();
        if (period === 'daily') {
            past.setUTCDate(past.getUTCDate() - 1); // Últimas 24h
        } else {
            past.setUTCDate(past.getUTCDate() - 7); // Últimos 7 dias
        }
        const pastStr = past.toISOString();
        const nowStr = now.toISOString();

        logger.info(`[SummaryJobs] Buscando trades fechados entre ${pastStr} e ${nowStr}`);

        // Buscar sinais fechados no período
        let closedSignals: any[] = [];
        try {
            closedSignals = await db.activeSignal.findMany({
                where: {
                    status: { in: ['CLOSED_TP', 'CLOSED_SL'] },
                    updated_at: { gte: past, lte: now }
                }
            });
        } catch (error: any) {
            logger.error(`[SummaryJobs] Erro no Database DB: ${error.message}`);
            throw error;
        }

        const signals = (closedSignals || []) as unknown as ActiveSignal[];
        logger.info(`[SummaryJobs] Encontrados ${signals.length} trades fechados.`);
        
        const total = signals.length;
        let winners = 0;
        let losers = 0;
        let totalPnl = 0;

        let bestTrade = { symbol: '', pnlPercent: -9999 };
        let worstTrade = { symbol: '', pnlPercent: 9999 };

        // Processa cada trade
        for (const signal of signals) {
            // Conta winners vs losers: CLOSED_TP = win, CLOSED_SL = loss
            const isWinner = signal.status === 'CLOSED_TP';
            if (isWinner) winners++;
            else losers++;

            let tradePnl = 0;
            const entryAvg = (signal.entry_range_low + signal.entry_range_high) / 2;

            if (isWinner) {
                // Cálculo de Gain: Preço do último TP vs Entrada
                // Obs: Num trade real seria bom pegar de onde saiu, mas vamos pegar o TP 1 pelo menos
                const lastTp = signal.take_profits && signal.take_profits.length > 0 && signal.take_profits[0].hit
                    ? signal.take_profits.filter(t => t.hit).pop()?.price || entryAvg
                    : entryAvg;
                    
                tradePnl = signal.type === 'LONG'
                    ? ((lastTp - entryAvg) / entryAvg) * 100
                    : ((entryAvg - lastTp) / entryAvg) * 100;
            } else {
                // Cálculo de Loss real
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
            signalsGenerated: total,
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
                total_signals: total,
                winners,
                losers,
                pnl: totalPnl,
                full_report_text: JSON.stringify(summaryData)
            }
        });

        logger.info(`[SummaryJobs] Report ${period} gerado e enviado com sucesso (${total} trades).`);
    } catch (err) {
        logger.error(`[SummaryJobs] Falha ao gerar relatório ${period}:`, err);
    }
}
