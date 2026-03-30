// Telegram Bot — Separate service for handling user commands via Telegram

import TelegramBot from 'node-telegram-bot-api';
import { config } from './lib/config.js';
import { botLogger as logger } from './lib/logger.js';

// Import shared modules for data access
import { bybitConnector } from './exchange/bybitConnector.js';
import { getActiveSignals, getEngineStats, calculateRSI, calculateEMA, calculateMACD, calculateATR, calculateADX } from './engine/signalEngine.js';
import { getActiveScalpingSignals, getScalpingStats } from './engine/scalpingEngine.js';
import { paperTradingEngine } from './trading/paperTradingEngine.js';
import { isModelLoaded } from './ml/mlPredictionService.js';
import { getUptime } from './notifications/systemAlerts.js';

export function initBot() {
    if (!config.telegram.botToken) {
        logger.error('TELEGRAM_BOT_TOKEN not configured. Bot commands cannot start.');
        return;
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
        '/analise SOLUSDT — Análise técnica de uma moeda',
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
        '/analise SOLUSDT — Análise técnica completa de uma moeda',
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

// ──── /analise ────

bot.onText(/\/analise(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;

    // Normalize symbol: "SOL" → "SOLUSDT", "SOLUSDT" stays
    const rawInput = match?.[1]?.trim().toUpperCase() || '';
    if (!rawInput) {
        bot.sendMessage(chatId, '⚠️ Uso: <code>/analise SOLUSDT</code>', { parse_mode: 'HTML' });
        return;
    }
    const symbol = rawInput.endsWith('USDT') ? rawInput : `${rawInput}USDT`;

    bot.sendMessage(chatId, `🔍 Buscando dados de <b>${symbol}</b>...`, { parse_mode: 'HTML' });

    try {
        // Fetch klines for multiple timeframes
        const [ohlc1h, ohlc4h, ohlc15m] = await Promise.all([
            bybitConnector.fetchKlines(symbol, '60', 200),
            bybitConnector.fetchKlines(symbol, '240', 200),
            bybitConnector.fetchKlines(symbol, '15', 50),
        ]);

        if (ohlc1h.length < 50) {
            bot.sendMessage(chatId, `❌ Par <b>${symbol}</b> não encontrado ou dados insuficientes.`, { parse_mode: 'HTML' });
            return;
        }

        // Fetch ticker for price/funding
        const fundingData = await bybitConnector.fetchFundingRate(symbol);
        const ticker = bybitConnector.getTicker(symbol);
        const currentPrice = ticker?.lastPrice || ohlc1h[ohlc1h.length - 1].close;
        const change24h = ticker ? (ticker.price24hPcnt * 100) : 0;
        const high24h = ticker?.highPrice24h || 0;
        const low24h = ticker?.lowPrice24h || 0;

        // ── Calculate indicators (1H) ──
        const closes1h = ohlc1h.map(c => c.close);
        const rsi = calculateRSI(closes1h);
        const macd = calculateMACD(closes1h);
        const ema20 = calculateEMA(closes1h, 20).at(-1) ?? currentPrice;
        const ema50 = calculateEMA(closes1h, 50).at(-1) ?? currentPrice;
        const ema200 = calculateEMA(closes1h, 200).at(-1) ?? currentPrice;
        const atr = calculateATR(ohlc1h);
        const adx = calculateADX(ohlc1h);

        // ── RSI 15m ──
        const rsi15m = ohlc15m.length >= 20 ? calculateRSI(ohlc15m.map(c => c.close)) : null;

        // ── Macro trend (4H EMA 200) ──
        let macroTrend = '⚪ Neutro';
        if (ohlc4h.length >= 50) {
            const ema200_4h = calculateEMA(ohlc4h.map(c => c.close), 200).at(-1) ?? currentPrice;
            macroTrend = currentPrice > ema200_4h ? '🟢 Alta (acima EMA 200 4H)' : '🔴 Baixa (abaixo EMA 200 4H)';
        }

        // ── Signal labels ──
        const rsiLabel = rsi < 30 ? '🟢 Sobrevendido' : rsi > 70 ? '🔴 Sobrecomprado' : rsi < 45 ? '🟡 Fraco' : rsi > 55 ? '🟡 Forte' : '⚪ Neutro';
        const macdLabel = macd.histogram > 0 ? '🟢 Bullish' : '🔴 Bearish';
        const ema20Label = currentPrice > ema20 ? '🟢 Acima' : '🔴 Abaixo';
        const ema50Label = currentPrice > ema50 ? '🟢 Acima' : '🔴 Abaixo';
        const ema200Label = currentPrice > ema200 ? '🟢 Acima' : '🔴 Abaixo';
        const adxLabel = adx > 40 ? '💪 Muito forte' : adx > 25 ? '💪 Forte' : '😴 Fraca';
        const fundingLabel = fundingData.fundingRatePercent > 0.05 ? '🔴 Alto (bearish)'
            : fundingData.fundingRatePercent < -0.05 ? '🟢 Negativo (bullish)' : '😐 Normal';

        // ── Overall bias ──
        const bullishSignals = [
            rsi < 50, macd.histogram > 0, currentPrice > ema20,
            currentPrice > ema50, currentPrice > ema200,
        ].filter(Boolean).length;
        const biasLabel = bullishSignals >= 4 ? '🟢 BULLISH' : bullishSignals <= 1 ? '🔴 BEARISH' : '🟡 NEUTRO/MISTO';

        // ── Price formatter ──
        const fmt = (p: number) => p < 0.01 ? p.toFixed(6) : p < 1 ? p.toFixed(4) : p < 100 ? p.toFixed(3) : p.toFixed(2);
        const changeEmoji = change24h >= 0 ? '🟢' : '🔴';

        const lines = [
            `📊 <b>Análise Técnica — ${symbol}</b>`,
            '',
            `💰 Preço: <b>$${fmt(currentPrice)}</b>  ${changeEmoji} ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}% (24h)`,
            `📈 Max 24h: $${fmt(high24h)}  |  📉 Min 24h: $${fmt(low24h)}`,
            '',
            `<b>📐 Indicadores (1H)</b>`,
            `├ RSI (14): ${rsi.toFixed(1)} — ${rsiLabel}`,
            `├ MACD Hist: ${macd.histogram >= 0 ? '+' : ''}${macd.histogram.toFixed(4)} — ${macdLabel}`,
            `├ EMA 20:  $${fmt(ema20)} — ${ema20Label}`,
            `├ EMA 50:  $${fmt(ema50)} — ${ema50Label}`,
            `├ EMA 200: $${fmt(ema200)} — ${ema200Label}`,
            `├ ADX: ${adx.toFixed(1)} — Tendência ${adxLabel}`,
            `└ ATR: $${fmt(atr)}`,
            '',
            `<b>🔮 Contexto Multi-Timeframe</b>`,
            `├ Macro (4H): ${macroTrend}`,
            ...(rsi15m !== null ? [`└ RSI 15m: ${rsi15m.toFixed(1)} — ${rsi15m < 30 ? '🟢 Sobrevendido' : rsi15m > 70 ? '🔴 Sobrecomprado' : '⚪ Neutro'}`] : []),
            '',
            `<b>📊 Dados de Mercado</b>`,
            `└ Funding Rate: ${fundingData.fundingRatePercent.toFixed(4)}% — ${fundingLabel}`,
            '',
            `⚡ <b>Viés Geral: ${biasLabel}</b> (${bullishSignals}/5 bullish)`,
        ];

        bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'HTML' });
    } catch (err) {
        logger.error(`/analise error for ${symbol}`, { error: err });
        bot.sendMessage(chatId, `❌ Erro ao analisar <b>${symbol}</b>. Verifique se o par existe na Bybit.`, { parse_mode: 'HTML' });
    }
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

// ──── /scalping ────

bot.onText(/\/scalping/, (msg) => {
    const chatId = msg.chat.id;
    const signals = getActiveScalpingSignals();
    const stats = getScalpingStats();

    if (signals.length === 0) {
        bot.sendMessage(chatId, `⚡ <b>Scalping Bot</b>\n\nNenhum sinal de scalping ativo no momento.\n📊 Hoje: ${stats.signalsToday} sinais | ✅ Enviados: ${stats.signalsSent}`, { parse_mode: 'HTML' });
        return;
    }

    const signalTexts = signals.slice(0, 5).map(s => {
        const emoji = s.type === 'long' ? '🟢' : '🔴';
        return [
            `${emoji} <b>${s.type.toUpperCase()} ${s.pair}</b> (5m)`,
            `  Score: ${s.confidence}/100`,
            `  Entry: $${s.entry.toFixed(4)}`,
            `  TP1: $${(s.takeProfit1 || s.takeProfit).toFixed(4)} | SL: $${s.stopLoss.toFixed(4)}`,
            `  R:R: 1:${s.riskReward}`,
        ].join('\n');
    });

    const text = [
        `⚡ <b>Scalping Ativos (${signals.length})</b>`,
        `📅 Hoje: ${stats.signalsToday} | ✅ Enviados: ${stats.signalsSent}`,
        '',
        ...signalTexts,
    ].join('\n\n');

    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// ──── Error Handling ────

bot.on('polling_error', (error) => {
    logger.error('Telegram polling error', { error: error.message });
});

    bot.on('error', (error) => {
        logger.error('Telegram bot error', { error: error.message });
    });

    logger.info('Telegram bot listener started');
}
