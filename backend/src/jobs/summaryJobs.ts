import cron from 'node-cron';
import { supabase } from '../lib/supabaseClient.js';
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
        scheduled: true,
        timezone: 'UTC'
    });

    // Semanal - 23:55 UTC aos domingos
    cron.schedule('55 23 * * 0', async () => {
        logger.info('[SummaryJobs] Executando job de sumário semanal...');
        await generateAndSendSummary('weekly');
    }, {
        scheduled: true,
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

        // Buscar sinais fechados no período
        const { data: closedSignals, error } = await supabase
            .from('active_signals')
            .select('*')
            .in('status', ['CLOSED_TP', 'CLOSED_SL'])
            .gte('updated_at', pastStr);

        if (error) throw error;

        const signals = (closedSignals || []) as any as ActiveSignal[];
        let total = signals.length;
        let winners = 0;
        let losers = 0;
        let totalPnl = 0;

        let bestTrade = { symbol: '', pnlPercent: -9999 };
        let worstTrade = { symbol: '', pnlPercent: 9999 };

        // Processa cada trade
        for (const signal of signals) {
            // Conta winners vs losers de forma simplificada: CLOSED_TP = win, CLOSED_SL = loss
            const isWinner = signal.status === 'CLOSED_TP';
            if (isWinner) winners++;
            else losers++;

            // PnL Aproximado (simplificação para o sumário)
            // Se win: a média das TPs atingidas vs Entrada
            // Se loss: SL atingido vs Entrada
            let tradePnl = 0;
            const entryAvg = (signal.entry_range_low + signal.entry_range_high) / 2;

            if (isWinner) {
                // Assumindo tp final atingido pelo status
                const lastTp = signal.take_profits && signal.take_profits.length > 0
                    ? signal.take_profits[signal.take_profits.length - 1].price
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
        await supabase.from('daily_summaries').insert({
            summary_date: dateLabel,
            total_signals: total,
            winners,
            losers,
            pnl: totalPnl,
            full_report_text: JSON.stringify(summaryData)
        });

        logger.info(`[SummaryJobs] Report ${period} gerado e enviado com sucesso (${total} trades).`);
    } catch (err) {
        logger.error(`[SummaryJobs] Falha ao gerar relatório ${period}:`, err);
    }
}
