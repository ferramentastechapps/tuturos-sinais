// Telegram Bot — Separate service for handling user commands via Telegram

import TelegramBot from 'node-telegram-bot-api';
import { config } from './lib/config.js';
import { botLogger as logger } from './lib/logger.js';

// Import shared modules for data access
import { bybitConnector } from './exchange/bybitConnector.js';
import { getActiveSignals, getEngineStats } from './engine/signalEngine.js';
import { paperTradingEngine } from './trading/paperTradingEngine.js';
import { isModelLoaded } from './ml/mlPredictionService.js';
import { getUptime } from './notifications/systemAlerts.js';

if (!config.telegram.botToken) {
    logger.error('TELEGRAM_BOT_TOKEN not configured. Bot cannot start.');
    process.exit(1);
}

const bot = new TelegramBot(config.telegram.botToken, { polling: true });

logger.info('Telegram bot starting with polling...');

// ──── /start ────

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const text = [
        '🤖 <b>Signal Engine Bot</b>',
        '',
        'Comandos disponíveis:',
        '/sinais — Ver sinais ativos',
        '/status — Status do sistema',
        '/portfolio — Resumo do paper trading',
        '/mercado — Dados de mercado',
        '/help — Ajuda',
        '',
        `📊 Chat ID: <code>${chatId}</code>`,
    ].join('\n');

    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// ──── /help ────

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const text = [
        '📖 <b>Comandos do Bot</b>',
        '',
        '/start — Mensagem de boas-vindas',
        '/sinais — Sinais ativos no momento',
        '/status — Status completo do sistema',
        '/portfolio — Resumo da carteira paper trading',
        '/mercado — Dados de mercado (preços, funding)',
        '/help — Esta mensagem de ajuda',
    ].join('\n');

    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// ──── /sinais ────

bot.onText(/\/sinais/, (msg) => {
    const chatId = msg.chat.id;
    const signals = getActiveSignals();

    if (signals.length === 0) {
        bot.sendMessage(chatId, '📊 Nenhum sinal ativo no momento.', { parse_mode: 'HTML' });
        return;
    }

    const signalTexts = signals.slice(0, 5).map(s => {
        const emoji = s.type === 'long' ? '🟢' : '🔴';
        const dir = s.type.toUpperCase();
        return [
            `${emoji} <b>${dir} ${s.pair}</b>`,
            `  Score: ${s.quality?.score || s.confidence}/100`,
            `  Entry: $${s.entry.toFixed(2)}`,
            `  TP: $${s.takeProfit.toFixed(2)} | SL: $${s.stopLoss.toFixed(2)}`,
            `  R:R: ${s.riskReward}`,
        ].join('\n');
    });

    const text = [
        `📊 <b>Sinais Ativos (${signals.length})</b>`,
        '',
        ...signalTexts,
    ].join('\n\n');

    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// ──── /status ────

bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const stats = getEngineStats();
    const state = paperTradingEngine.getState();

    const text = [
        '🖥 <b>Status do Sistema</b>',
        '',
        `⏱ Uptime: ${getUptime()}`,
        `📡 Bybit: ${bybitConnector.isConnected() ? '✅ Conectado' : '❌ Desconectado'}`,
        `🤖 ML: ${isModelLoaded() ? '✅ Carregado' : '⚠️ N/A'}`,
        `📊 Engine: ${stats.running ? '✅ Rodando' : '❌ Parado'}`,
        '',
        `📈 Sinais hoje: ${stats.signalsToday}`,
        `📤 Enviados: ${stats.signalsSent}`,
        `📊 Sinais ativos: ${stats.activeCount}`,
        '',
        `💼 Paper Trading: ${state.mode}`,
        `💰 Balance: $${state.balance.toFixed(2)}`,
        `📊 Posições: ${state.positions.filter(p => p.status === 'open').length}`,
    ].join('\n');

    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// ──── /portfolio ────

bot.onText(/\/portfolio/, (msg) => {
    const chatId = msg.chat.id;
    const state = paperTradingEngine.getState();
    const metrics = paperTradingEngine.getMetrics();
    const positions = state.positions.filter(p => p.status === 'open');

    const positionsList = positions.map(p => {
        const emoji = p.unrealizedPnlPercent >= 0 ? '🟢' : '🔴';
        return `${emoji} ${p.symbol} ${p.direction.toUpperCase()} — ${p.unrealizedPnlPercent.toFixed(2)}%`;
    }).join('\n') || 'Nenhuma posição aberta';

    const text = [
        '💼 <b>Paper Trading Portfolio</b>',
        '',
        `💰 Balance: $${state.balance.toFixed(2)}`,
        `📊 Equity: $${state.equity.toFixed(2)}`,
        `📈 Modo: ${state.mode}`,
        '',
        `<b>Métricas:</b>`,
        `Trades: ${metrics.totalTrades}`,
        `Win Rate: ${metrics.winRate.toFixed(1)}%`,
        `PnL Total: $${metrics.totalPnL.toFixed(2)} (${metrics.totalPnLPercent.toFixed(1)}%)`,
        `Profit Factor: ${metrics.profitFactor.toFixed(2)}`,
        '',
        `<b>Posições Abertas:</b>`,
        positionsList,
    ].join('\n');

    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// ──── /mercado ────

bot.onText(/\/mercado/, (msg) => {
    const chatId = msg.chat.id;
    const tickers = bybitConnector.getTickers();

    const topSymbols = config.monitoredSymbols.slice(0, 10);
    const lines = topSymbols.map(symbol => {
        const ticker = tickers.get(symbol);
        if (!ticker) return `${symbol}: N/A`;
        const emoji = ticker.price24hPcnt >= 0 ? '🟢' : '🔴';
        const change = (ticker.price24hPcnt * 100).toFixed(2);
        return `${emoji} ${symbol}: $${ticker.lastPrice.toFixed(2)} (${change}%)`;
    });

    const text = [
        '📊 <b>Mercado — Top 10</b>',
        '',
        ...lines,
    ].join('\n');

    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// ──── Error Handling ────

bot.on('polling_error', (error) => {
    logger.error('Telegram polling error', { error: error.message });
});

bot.on('error', (error) => {
    logger.error('Telegram bot error', { error: error.message });
});

logger.info('Telegram bot started');
