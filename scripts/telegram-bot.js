/**
 * Telegram Bot Server — Script Node.js Opcional
 * 
 * Este script roda separado do dashboard e implementa os comandos
 * do bot via polling (long-polling com a API do Telegram).
 * 
 * ──────────── COMO USAR ────────────
 * 
 * 1. Instale a dependência:
 *    npm install telegraf
 * 
 * 2. Configure as variáveis de ambiente no .env:
 *    TELEGRAM_BOT_TOKEN=seu_token_aqui
 *    TELEGRAM_CHAT_ID=seu_chat_id_aqui
 * 
 * 3. Execute:
 *    node scripts/telegram-bot.js
 * 
 * ──────────── IMPORTANTE ────────────
 * 
 * Este script é OPCIONAL. O sistema de notificações do dashboard
 * funciona independentemente sem este script.
 * 
 * Este script adiciona COMANDOS INTERATIVOS ao bot, permitindo
 * que o usuário envie comandos como /sinais, /status, /resumo etc.
 */

import 'dotenv/config';

// Check for required env vars
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(id => id.trim()).filter(Boolean);

if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN não definido no .env');
    process.exit(1);
}

if (AUTHORIZED_CHAT_IDS.length === 0) {
    console.error('❌ TELEGRAM_CHAT_ID não definido no .env');
    process.exit(1);
}

// Dynamic import for telegraf (may not be installed)
let Telegraf;
try {
    const telegrafModule = await import('telegraf');
    Telegraf = telegrafModule.Telegraf;
} catch {
    console.error('❌ Pacote "telegraf" não encontrado. Instale com: npm install telegraf');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ──────────── Rate Limiting ────────────

const commandTimestamps = new Map();
const RATE_LIMIT_SECONDS = 5;

const isRateLimited = (userId) => {
    const now = Date.now();
    const last = commandTimestamps.get(userId) || 0;
    if (now - last < RATE_LIMIT_SECONDS * 1000) return true;
    commandTimestamps.set(userId, now);
    return false;
};

// ──────────── Whitelist Check ────────────

const isAuthorized = (chatId) => {
    return AUTHORIZED_CHAT_IDS.includes(String(chatId));
};

const authMiddleware = (ctx, next) => {
    const chatId = String(ctx.chat?.id || ctx.from?.id);
    if (!isAuthorized(chatId)) {
        console.log(`⚠️ Acesso não autorizado: ${chatId}`);
        return ctx.reply('❌ Acesso não autorizado.');
    }
    if (isRateLimited(chatId)) {
        return ctx.reply(`⏳ Aguarde ${RATE_LIMIT_SECONDS}s entre comandos.`);
    }
    console.log(`📥 [${new Date().toISOString()}] Comando de ${chatId}: ${ctx.message?.text}`);
    return next();
};

bot.use(authMiddleware);

// ──────────── Commands ────────────

bot.command('start', (ctx) => {
    ctx.reply(
        `🤖 *Bot Tuturos Sinais Ativo!*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Comandos disponíveis:\n` +
        `/sinais — Sinais ativos\n` +
        `/status — Status do sistema\n` +
        `/resumo — Resumo das últimas 24h\n` +
        `/top — Top 5 moedas por score\n` +
        `/parar — Pausar notificações\n` +
        `/retomar — Retomar notificações\n` +
        `/config — Configurações atuais\n` +
        `/score [número] — Alterar score mínimo\n` +
        `/moeda [symbol] — Detalhes de uma moeda\n` +
        `/help — Mostrar este menu`,
        { parse_mode: 'Markdown' }
    );
});

bot.command('help', (ctx) => {
    ctx.reply(
        `📖 *Comandos Disponíveis*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `/start — Menu principal\n` +
        `/sinais — Lista sinais ativos\n` +
        `/status — Status do sistema\n` +
        `/resumo — Resumo 24h\n` +
        `/top — Top 5 moedas\n` +
        `/parar — Pausar notificações\n` +
        `/retomar — Retomar notificações\n` +
        `/config — Ver configurações\n` +
        `/score 75 — Definir score mínimo\n` +
        `/moeda BTCUSDT — Detalhes da moeda\n` +
        `/help — Este menu`,
        { parse_mode: 'Markdown' }
    );
});

bot.command('sinais', (ctx) => {
    // In a real implementation, this would query the database/API
    ctx.reply(
        `📊 *Sinais Ativos*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `ℹ️ Para ver sinais em tempo real, acesse o dashboard.\n` +
        `Este comando estará completo quando o backend for implementado.\n\n` +
        `💡 Dica: As notificações automáticas são enviadas pelo dashboard quando novos sinais são gerados.`,
        { parse_mode: 'Markdown' }
    );
});

bot.command('status', (ctx) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    ctx.reply(
        `📡 *Status do Sistema*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ Bot: Online\n` +
        `⏱ Uptime: ${hours}h ${minutes}min\n` +
        `📊 Notificações: Ativas\n` +
        `🔐 Chat autorizado: Sim\n\n` +
        `🕐 ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`,
        { parse_mode: 'Markdown' }
    );
});

bot.command('resumo', (ctx) => {
    ctx.reply(
        `📊 *Resumo 24h*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `ℹ️ O resumo completo é enviado automaticamente às 00:00 UTC.\n` +
        `Para ver o resumo detalhado, acesse o dashboard.`,
        { parse_mode: 'Markdown' }
    );
});

bot.command('top', (ctx) => {
    ctx.reply(
        `🏆 *Top 5 Moedas*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `ℹ️ Para ver os top scores em tempo real, acesse o dashboard.\n` +
        `As notificações de sinais fortes (score >= mínimo) são enviadas automaticamente.`,
        { parse_mode: 'Markdown' }
    );
});

let notificationsPaused = false;

bot.command('parar', (ctx) => {
    notificationsPaused = true;
    ctx.reply(
        `⏸️ *Notificações Pausadas*\n\n` +
        `As notificações foram silenciadas.\n` +
        `Use /retomar para voltar a receber.`,
        { parse_mode: 'Markdown' }
    );
});

bot.command('retomar', (ctx) => {
    notificationsPaused = false;
    ctx.reply(
        `▶️ *Notificações Retomadas*\n\n` +
        `Você voltará a receber sinais e alertas.`,
        { parse_mode: 'Markdown' }
    );
});

let currentMinScore = parseInt(process.env.TELEGRAM_MIN_SCORE || '70', 10);

bot.command('config', (ctx) => {
    ctx.reply(
        `⚙️ *Configurações Atuais*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📊 Score Mínimo: ${currentMinScore}\n` +
        `📡 Notificações: ${notificationsPaused ? '⏸️ Pausadas' : '▶️ Ativas'}\n` +
        `🔐 Chat IDs autorizados: ${AUTHORIZED_CHAT_IDS.length}\n` +
        `⏰ Rate limit: ${RATE_LIMIT_SECONDS}s entre comandos`,
        { parse_mode: 'Markdown' }
    );
});

bot.command('score', (ctx) => {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 2) {
        return ctx.reply(
            `📊 Score mínimo atual: *${currentMinScore}*\n\nUso: /score 75`,
            { parse_mode: 'Markdown' }
        );
    }

    const newScore = parseInt(parts[1], 10);
    if (isNaN(newScore) || newScore < 0 || newScore > 100) {
        return ctx.reply('❌ Score deve ser um número entre 0 e 100.');
    }

    currentMinScore = newScore;
    ctx.reply(
        `✅ Score mínimo alterado para *${currentMinScore}*`,
        { parse_mode: 'Markdown' }
    );
});

bot.command('moeda', (ctx) => {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 2) {
        return ctx.reply('Uso: /moeda BTCUSDT');
    }

    const symbol = parts[1].toUpperCase();
    ctx.reply(
        `📊 *${symbol}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `ℹ️ Detalhes em tempo real disponíveis no dashboard.\n` +
        `As notificações de sinais para ${symbol} serão enviadas automaticamente quando geradas.`,
        { parse_mode: 'Markdown' }
    );
});

// ──────────── Launch ────────────

console.log('🤖 Iniciando Telegram Bot...');
console.log(`📡 Chat IDs autorizados: ${AUTHORIZED_CHAT_IDS.join(', ')}`);
console.log(`📊 Score mínimo: ${currentMinScore}`);

bot.launch()
    .then(() => {
        console.log('✅ Bot iniciado com sucesso!');
    })
    .catch((err) => {
        console.error('❌ Erro ao iniciar bot:', err.message);
        process.exit(1);
    });

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
