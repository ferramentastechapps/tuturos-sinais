// Cleanup Job — Desativa diariamente sinais que não progrediram
// Sinais com status PENDING ou ACTIVE por mais de 24h são marcados como CANCELLED

import cron from 'node-cron';
import { db } from '../lib/dbClient.js';
import { logger } from '../lib/logger.js';
import { telegramService } from '../notifications/telegramService.js';

const JOB_TAG = '[CleanupJob]';

export function startCleanupJob() {
    // Executa todo dia à meia-noite (00:00 UTC)
    cron.schedule('0 0 * * *', async () => {
        logger.info(`${JOB_TAG} Iniciando limpeza diária de sinais inativos...`);
        await cancelStaleSignals();
    }, {
        timezone: 'UTC'
    });

    logger.info(`${JOB_TAG} Agendado para rodar todo dia às 00:00 UTC.`);
}

/**
 * Cancela sinais PENDING ou ACTIVE que não foram resolvidos no dia anterior.
 * "Inativo" = criado antes de 00:00 UTC de hoje e ainda com status aberto.
 */
async function cancelStaleSignals() {
    try {
        const now = new Date();

        // Início do dia atual em UTC (00:00:00)
        const todayStart = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            0, 0, 0, 0
        ));

        logger.info(`${JOB_TAG} Buscando sinais abertos criados antes de ${todayStart.toISOString()}...`);

        // Buscar sinais PENDING ou ACTIVE criados antes de hoje
        const staleSignals = await db.activeSignal.findMany({
            where: {
                status: { in: ['PENDING', 'ACTIVE'] },
                created_at: { lt: todayStart }
            }
        });

        if (staleSignals.length === 0) {
            logger.info(`${JOB_TAG} Nenhum sinal inativo encontrado. Nada a fazer.`);
            return;
        }

        logger.info(`${JOB_TAG} Encontrados ${staleSignals.length} sinais inativos para cancelar.`);

        // Cancelar todos de uma vez
        const result = await db.activeSignal.updateMany({
            where: {
                status: { in: ['PENDING', 'ACTIVE'] },
                created_at: { lt: todayStart }
            },
            data: {
                status: 'CANCELLED',
                updated_at: now
            }
        });

        logger.info(`${JOB_TAG} ✅ ${result.count} sinais cancelados com sucesso.`);

        // Notificar via Telegram se houver algo cancelado
        if (telegramService.isEnabled && result.count > 0) {
            const pairs = staleSignals.map(s => s.pair).join(', ');
            const message =
                `🧹 <b>Limpeza Diária de Sinais</b>\n\n` +
                `Foram cancelados <b>${result.count}</b> sinal(is) que permaneceram abertos sem resolução:\n` +
                `<code>${pairs}</code>\n\n` +
                `<i>Referência: criados antes de ${todayStart.toISOString().split('T')[0]}</i>`;

            await telegramService.send(message, 'daily_summary');
        }
    } catch (err) {
        logger.error(`${JOB_TAG} Falha ao executar limpeza de sinais:`, err);
    }
}
