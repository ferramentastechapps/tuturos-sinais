// Telegram Service — Server-side message sending with rate limiting and queue

import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import type {
    TelegramSendResult,
    TelegramNotificationType,
    SignalNotificationData,
    DailySummaryData,
    MarketAlertData,
    FundingRateAlertData,
    RiskAlertNotificationData,
} from '../types/telegram.js';
import { broadcastPushNotification } from './pushService.js';

const RATE_LIMIT_PER_MINUTE = 20;
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

const formatPrice = (rawPrice: number | string): string => {
    const price = typeof rawPrice === 'string' ? parseFloat(rawPrice) : rawPrice;
    if (isNaN(price)) return '0.00';
    if (price >= 1000) return price.toFixed(2);
    if (price >= 1) return price.toFixed(3);
    if (price >= 0.1) return price.toFixed(4);
    if (price >= 0.01) return price.toFixed(5);
    if (price >= 0.001) return price.toFixed(6);
    if (price >= 0.0001) return price.toFixed(7);
    return price.toFixed(8);
};

interface QueueItem {
    chatId: string;
    text: string;
    type: TelegramNotificationType;
    symbol?: string;
    resolve: (result: TelegramSendResult) => void;
    attempts: number;
}

class TelegramService {
    private queue: QueueItem[] = [];
    private processing = false;
    private sendTimestamps: number[] = [];
    private connectionStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';

    private get token(): string {
        return config.telegram.botToken;
    }

    private get chatId(): string {
        return config.telegram.chatId;
    }

    get isEnabled(): boolean {
        return config.telegram.enabled && !!this.token && !!this.chatId;
    }

    // ──── Direct Send ────

    private async sendDirect(chatId: string, text: string): Promise<TelegramSendResult> {
        if (!this.token) {
            return { success: false, error: 'No bot token configured' };
        }

        try {
            const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text,
                    parse_mode: 'HTML',
                    disable_web_page_preview: true,
                }),
            });

            const data = await response.json() as any;

            if (data.ok) {
                this.connectionStatus = 'connected';
                return { success: true, messageId: data.result?.message_id };
            } else {
                logger.warn('Telegram send failed', { error: data.description });
                return { success: false, error: data.description };
            }
        } catch (error: any) {
            this.connectionStatus = 'disconnected';
            logger.error('Telegram send error', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ──── Rate Limiting ────

    private canSendNow(): boolean {
        const now = Date.now();
        this.sendTimestamps = this.sendTimestamps.filter(t => now - t < 60000);
        return this.sendTimestamps.length < RATE_LIMIT_PER_MINUTE;
    }

    private recordSend(): void {
        this.sendTimestamps.push(Date.now());
    }

    private getWaitTime(): number {
        if (this.sendTimestamps.length === 0) return 0;
        const oldest = this.sendTimestamps[0];
        return Math.max(0, 60000 - (Date.now() - oldest));
    }

    // ──── Queue Processing ────

    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        while (this.queue.length > 0) {
            if (!this.canSendNow()) {
                const wait = this.getWaitTime();
                await new Promise(resolve => setTimeout(resolve, wait + 100));
                continue;
            }

            const item = this.queue.shift()!;
            const result = await this.sendDirect(item.chatId, item.text);

            if (!result.success && item.attempts < RETRY_MAX_ATTEMPTS) {
                const delay = RETRY_BASE_DELAY_MS * Math.pow(2, item.attempts);
                await new Promise(resolve => setTimeout(resolve, delay));
                item.attempts++;
                this.queue.unshift(item);
            } else {
                this.recordSend();
                item.resolve(result);
            }
        }

        this.processing = false;
    }

    // ──── Enqueue ────

    private enqueueMessage(
        chatId: string,
        text: string,
        type: TelegramNotificationType,
        symbol?: string,
    ): Promise<TelegramSendResult> {
        return new Promise(resolve => {
            this.queue.push({ chatId, text, type, symbol, resolve, attempts: 0 });
            this.processQueue();
        });
    }

    // ──── Public API ────

    async send(text: string, type: TelegramNotificationType = 'new_signal', symbol?: string): Promise<TelegramSendResult> {
        if (!this.isEnabled) {
            return { success: false, error: 'Telegram not enabled' };
        }
        return this.enqueueMessage(this.chatId, text, type, symbol);
    }

    async sendNewSignal(data: SignalNotificationData): Promise<TelegramSendResult> {
        const emoji = data.type === 'long' ? '🟢' : '🔴';
        const dir = data.type.toUpperCase();
        const tps = data.takeProfits.map(tp =>
            `  TP${tp.level}: $${formatPrice(tp.price)} (+${tp.percent.toFixed(1)}%)`
        ).join('\n');

        const indNames = data.confluences?.map(c => c.name) || [];
        const hasFVG = indNames.some(n => n?.includes('FVG'));
        const hasSweep = indNames.some(n => n?.includes('Liquidity Sweep'));
        const hasAnchoredVWAP = indNames.some(n => n?.includes('Anchored VWAP'));

        const textLines = [
            `${emoji} <b>ORDEM PENDENTE ${dir} — ${data.symbol}</b>`,
            `⚠️ <i>Aguardando entrada na zona...</i>`,
            data.tradeType ? `⏱️ Estilo: ${data.tradeType} (Aprox. ${data.expectedDuration})` : null,
            `🎯 Score: ${data.score}/100 (${data.scoreLabel})`,
            data.mtfContext ? `` : null,
            data.mtfContext ? `<b>🔍 Análise Multi-Timeframe</b>` : null,
            data.mtfContext ? `  <b>Macro:</b> ${data.mtfContext.macro.join(' | ') || 'Neutro'}` : null,
            data.mtfContext ? `  <b>Médio:</b> ${data.mtfContext.medium.join(' | ') || 'Neutro'}` : null,
            data.mtfContext ? `  <b>Micro:</b> ${data.mtfContext.micro.join(' | ') || 'Neutro'}` : null,
            ``,
            `<b>🐋 Filtros Smart Money (ICT)</b>`,
            `• Caça aos Stops (Sweep): ${hasSweep ? '✅ ATIVO' : '❌ Inativo'}`,
            `• Fair Value Gap (FVG): ${hasFVG ? '✅ ATIVO' : '❌ Inativo'}`,
            `• VWAP Ancorada (Macro): ${hasAnchoredVWAP ? '✅ A FAVOR' : '❌ Inativo/Contra'}`,
            ``,
            `💰 Preço: $${formatPrice(data.currentPrice)}`,
            `📥 Entrada: $${formatPrice(data.entryZone.min)} - $${formatPrice(data.entryZone.max)}`,
            `❌ Stop Loss: $${formatPrice(data.stopLoss.price)} (-${data.stopLoss.percent.toFixed(1)}%)`,
            ``,
            `🎯 Take Profits:`,
            tps,
            ``,
            `📈 R:R 1:${data.riskReward.toFixed(1)}`,
            `⚡ Alavancagem: ${data.leverage}x`,
            `💼 Posição: ${data.positionSizePercent.toFixed(1)}%`,
            `🔥 Risco: ${data.riskPercent.toFixed(1)}%`,
            data.contextNarrative ? `` : null,
            data.contextNarrative ? `📝 <b>Contexto:</b> <i>${data.contextNarrative}</i>` : null,
            data.performanceSummary ? `` : null,
            data.performanceSummary ? `🏆 <b>Performance Histórica (Eficácia)</b>:\n${data.performanceSummary}` : null,
            ``,
            `🕐 ${new Date(data.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
        ];

        const text = textLines.filter(line => line !== null).join('\n');

        // Dispara o Push Notification paralelamente
        broadcastPushNotification({
            title: `Pendente ${dir} — ${data.symbol}`,
            body: `Entrada: $${formatPrice(data.entryZone.min)} | Alvo: $${formatPrice(data.takeProfits[0]?.price)} | Risco: ${data.riskPercent.toFixed(1)}%`,
        }).catch(err => logger.error('Web Push failed to broadcast', { error: err.message }));

        return this.send(text, 'new_signal', data.symbol);
    }

    async sendDailySummary(data: DailySummaryData): Promise<TelegramSendResult> {
        const text = [
            `📊 <b>RESUMO DIÁRIO — ${data.date}</b>`,
            ``,
            `📈 Sinais: ${data.signalsGenerated}`,
            `✅ Wins: ${data.winners} | ❌ Losses: ${data.losers}`,
            `💰 PnL: ${data.pnlPercent > 0 ? '+' : ''}${data.pnlPercent.toFixed(2)}%`,
            data.bestTrade ? `🏆 Melhor: ${data.bestTrade.symbol} (+${data.bestTrade.pnlPercent.toFixed(2)}%)` : '',
            data.worstTrade ? `💔 Pior: ${data.worstTrade.symbol} (${data.worstTrade.pnlPercent.toFixed(2)}%)` : '',
        ].filter(Boolean).join('\n');

        // Dispara o Push Notification paralelamente
        broadcastPushNotification({
            title: `Resumo Diário — ${data.date}`,
            body: `PnL: ${data.pnlPercent > 0 ? '+' : ''}${data.pnlPercent.toFixed(2)}% | Wins: ${data.winners} | Losses: ${data.losers}`,
        }).catch(err => logger.error('Web Push failed to broadcast', { error: err.message }));

        return this.send(text, 'daily_summary');
    }

    async sendMarketAlert(data: MarketAlertData): Promise<TelegramSendResult> {
        const text = [
            `⚠️ <b>ALERTA DE MERCADO — ${data.symbol}</b>`,
            ``,
            `${data.description}`,
            `📊 Variação: ${data.changePercent > 0 ? '+' : ''}${data.changePercent.toFixed(2)}% (${data.period})`,
            data.liquidations ? `💥 Liquidações: $${(data.liquidations / 1e6).toFixed(1)}M` : '',
            `💡 ${data.recommendation}`,
        ].filter(Boolean).join('\n');

        broadcastPushNotification({
            title: `Alerta de Mercado — ${data.symbol}`,
            body: `${data.description} | ${data.recommendation}`,
        }).catch(err => logger.error('Web Push failed to broadcast', { error: err.message }));

        return this.send(text, 'market_alert', data.symbol);
    }

    async sendFundingRateAlert(data: FundingRateAlertData): Promise<TelegramSendResult> {
        const text = [
            `📊 <b>FUNDING RATE — ${data.symbol}</b>`,
            ``,
            `Rate: ${(data.fundingRate * 100).toFixed(4)}%`,
            `Bias: ${data.bias === 'long' ? '🟢 Long' : '🔴 Short'}`,
            `💡 ${data.recommendation}`,
        ].join('\n');

        return this.send(text, 'funding_rate', data.symbol);
    }

    async sendRiskAlert(data: RiskAlertNotificationData): Promise<TelegramSendResult> {
        const text = [
            `🚨 <b>ALERTA DE RISCO</b>`,
            ``,
            `Tipo: ${data.alertType}`,
            `Valor atual: ${data.currentValue.toFixed(2)}`,
            `Limite: ${data.limit.toFixed(2)}`,
            `💡 ${data.recommendation}`,
            `🕐 ${new Date(data.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
        ].join('\n');

        return this.send(text, 'risk_alert');
    }

    async sendPaperTradeNotification(data: {
        action: 'open' | 'close';
        symbol: string;
        direction: 'long' | 'short';
        entryPrice: number;
        exitPrice?: number;
        pnl?: number;
        pnlPercent?: number;
        exitReason?: string;
        leverage: number;
    }): Promise<TelegramSendResult> {
        const emoji = data.action === 'open' ? '📥' : '📤';
        const dir = data.direction === 'long' ? '🟢 LONG' : '🔴 SHORT';
        const pnlEmoji = (data.pnl ?? 0) >= 0 ? '✅' : '❌';

        const lines = [
            `${emoji} <b>PAPER ${data.action.toUpperCase()} — ${data.symbol}</b>`,
            `${dir} | ${data.leverage}x`,
        ];

        if (data.action === 'open') {
            lines.push(`💰 Entrada: $${formatPrice(data.entryPrice)}`);
        } else {
            lines.push(`💰 Entrada: $${formatPrice(data.entryPrice)}`);
            lines.push(`📤 Saída: $${data.exitPrice ? formatPrice(data.exitPrice) : 'N/A'}`);
            lines.push(`${pnlEmoji} PnL: ${(data.pnlPercent || 0) > 0 ? '+' : ''}${(data.pnlPercent || 0).toFixed(2)}%`);
            if (data.exitReason) lines.push(`📋 Motivo: ${data.exitReason}`);
        }

        return this.send(lines.join('\n'), 'new_signal', data.symbol);
    }

    async testConnection(): Promise<TelegramSendResult> {
        return this.sendDirect(this.chatId, '✅ Signal Engine conectado com sucesso!');
    }

    getConnectionStatus(): string {
        return this.connectionStatus;
    }

    getQueueSize(): number {
        return this.queue.length;
    }

    async sendTakeProfitNotification(signal: any, tp: any, currentPrice: number): Promise<TelegramSendResult> {
        const text = [
            `✅ <b>TAKE PROFIT ATINGIDO — ${signal.pair}</b>`,
            `🎯 <b>Alvo ${tp.level} alcançado!</b>`,
            ``,
            `💰 Preço Atual: $${formatPrice(currentPrice)}`,
            signal.trade_type ? `📈 Estilo: ${signal.trade_type}` : null,
            tp.level === 1 ? `🛡️ Stop Loss movido para o Breakeven ou trailing ativado.` : null,
            ``,
            `🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
        ].filter(line => line !== null).join('\n');
        return this.send(text, 'take_profit', signal.pair);
    }

    async sendStopLossNotification(signal: any, currentPrice: number): Promise<TelegramSendResult> {
        const text = [
            `❌ <b>STOP LOSS ATINGIDO — ${signal.pair}</b>`,
            `Trade encerrado.`,
            ``,
            `💰 Preço de Saída: $${formatPrice(currentPrice)}`,
            ``,
            `🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
        ].join('\n');
        return this.send(text, 'stop_loss', signal.pair);
    }

    async sendTrailingStopUpdate(signal: any, currentPrice: number, oldSl: number, newSl: number): Promise<TelegramSendResult> {
        const text = [
            `🛡️ <b>TRAILING STOP ATUALIZADO — ${signal.pair}</b>`,
            `O preço moveu a favor da operação.`,
            ``,
            `💰 Preço Atual: $${formatPrice(currentPrice)}`,
            `🔒 Novo Stop: $${formatPrice(newSl)} (Anterior: $${formatPrice(oldSl)})`,
            ``,
            `🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
        ].join('\n');
        return this.send(text, 'take_profit', signal.pair);
    }

    async sendActivationNotification(signal: any, currentPrice: number): Promise<TelegramSendResult> {
        const dir = signal.type;
        const emoji = dir === 'LONG' ? '🟢' : '🔴';
        let tpText = '';
        if (signal.take_profits && Array.isArray(signal.take_profits)) {
            tpText = '\\n🎯 Take Profits:\\n' + signal.take_profits.map((tp: any) => 
                `  TP${tp.level}: $${formatPrice(tp.price)}`
            ).join('\\n');
        }

        const text = [
            `🚨 <b>ORDEM ATIVADA — ${signal.pair}</b>`,
            `${emoji} O preço atingiu a zona de entrada!`,
            ``,
            `💰 Preço de Entrada: $${formatPrice(currentPrice)}`,
            signal.stop_loss ? `❌ Stop Loss: $${formatPrice(signal.stop_loss)}` : null,
            tpText ? tpText : `🎯 Alvos e Stop Loss sendo rastreados.`,
            ``,
            `🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
        ].filter(Boolean).join('\\n');
        
        broadcastPushNotification({
            title: `Ordem Ativada — ${signal.pair}`,
            body: `Entrada acionada em $${formatPrice(currentPrice)}`,
        }).catch(err => logger.error('Web Push failed to broadcast', { error: err.message }));

        return this.send(text, 'new_signal', signal.pair);
    }
}

export const telegramService = new TelegramService();

export const sendTPNotification = (signal: any, tp: any, currentPrice: number) => telegramService.sendTakeProfitNotification(signal, tp, currentPrice);
export const sendSLNotification = (signal: any, currentPrice: number) => telegramService.sendStopLossNotification(signal, currentPrice);
export const sendTrailingStopUpdate = (signal: any, currentPrice: number, oldSl: number, newSl: number) => telegramService.sendTrailingStopUpdate(signal, currentPrice, oldSl, newSl);
export const sendActivationNotification = (signal: any, currentPrice: number) => telegramService.sendActivationNotification(signal, currentPrice);
