// Telegram Service — Centralized message sending directly to Telegram API
// Rate limited, queued, with retry logic and message logging
// Token is stored in localStorage (entered by user via settings), never in source code

import { telegramConfigManager } from './telegramConfigManager';
import {
    TelegramSendResult,
    TelegramMessageLog,
    TelegramNotificationType,
    SignalNotificationData,
    TakeProfitNotificationData,
    StopLossNotificationData,
    RiskAlertNotificationData,
    DailySummaryData,
    MarketAlertData,
    FundingRateAlertData,
} from '@/types/telegram';
import {
    formatNewSignal,
    formatTakeProfit,
    formatStopLoss,
    formatRiskAlert,
    formatDailySummary,
    formatMarketAlert,
    formatFundingRateAlert,
    formatTestMessage,
} from './telegramFormatters';

// ──────────── Constants ────────────

const TELEGRAM_API = 'https://api.telegram.org';
const RATE_LIMIT_PER_MINUTE = 20;
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;
const TOKEN_STORAGE_KEY = 'telegram_bot_token';

// ──────────── Queue Item ────────────

interface QueueItem {
    chatId: string;
    text: string;
    type: TelegramNotificationType;
    symbol?: string;
    resolve: (result: TelegramSendResult) => void;
    attempts: number;
}

// ──────────── Service ────────────

class TelegramServiceClass {
    private queue: QueueItem[] = [];
    private processing = false;
    private sendTimestamps: number[] = [];
    private connectionStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';

    // ── Token Management ──

    getToken(): string {
        try {
            return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
        } catch {
            return '';
        }
    }

    setToken(token: string): void {
        try {
            if (token) {
                localStorage.setItem(TOKEN_STORAGE_KEY, token);
            } else {
                localStorage.removeItem(TOKEN_STORAGE_KEY);
            }
        } catch {
            // localStorage not available
        }
    }

    hasToken(): boolean {
        return this.getToken().length > 0;
    }

    // ── Core Send (Direct to Telegram API) ──

    // ── Core Send (Via Edge Function Proxy) ──

    private async sendDirect(chatId: string, text: string): Promise<TelegramSendResult> {
        // No client-side token check needed; proxy handles it.

        try {
            // Usa o proxy local ou de produção
            // Em dev: http://localhost:54321/functions/v1/telegram-proxy (se rodando supabase local)
            // Em prod: VITE_SUPABASE_URL/functions/v1/telegram-proxy
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
            const proxyUrl = `${supabaseUrl}/functions/v1/telegram-proxy`;

            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Adicione Authorization se sua Edge Function exigir RLS/JWT anonimo
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    action: 'sendMessage',
                    chat_id: chatId,
                    text,
                    parse_mode: 'HTML'
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    error: errorData.error || `Proxy Error: ${response.status}`
                };
            }

            const data = await response.json();

            if (data?.ok) {
                this.connectionStatus = 'connected';
                return { success: true, messageId: data.result?.message_id };
            }

            return {
                success: false,
                error: data?.description || 'Unknown Telegram API error via Proxy',
            };
        } catch (err) {
            this.connectionStatus = 'disconnected';
            return { success: false, error: (err as Error).message };
        }
    }

    // ── Rate Limiting ──

    private canSendNow(): boolean {
        const now = Date.now();
        this.sendTimestamps = this.sendTimestamps.filter(t => now - t < 60_000);
        return this.sendTimestamps.length < RATE_LIMIT_PER_MINUTE;
    }

    private recordSend(): void {
        this.sendTimestamps.push(Date.now());
    }

    private getWaitTime(): number {
        if (this.sendTimestamps.length < RATE_LIMIT_PER_MINUTE) return 0;
        const oldest = this.sendTimestamps[0];
        return Math.max(0, 60_000 - (Date.now() - oldest) + 100);
    }

    // ── Queue Processing ──

    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        while (this.queue.length > 0) {
            const item = this.queue[0];

            if (!this.canSendNow()) {
                const waitMs = this.getWaitTime();
                await new Promise(r => setTimeout(r, waitMs));
                continue;
            }

            const result = await this.sendDirect(item.chatId, item.text);
            this.recordSend();

            const log: TelegramMessageLog = {
                id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                timestamp: Date.now(),
                type: item.type,
                chatId: item.chatId,
                symbol: item.symbol,
                preview: item.text.slice(0, 80),
                success: result.success,
                error: result.error,
            };
            telegramConfigManager.addMessageLog(log);

            if (result.success) {
                this.queue.shift();
                item.resolve(result);
            } else if (item.attempts < RETRY_MAX_ATTEMPTS) {
                item.attempts++;
                const delay = RETRY_BASE_DELAY_MS * Math.pow(2, item.attempts - 1);
                console.warn(`[Telegram] Retry ${item.attempts}/${RETRY_MAX_ATTEMPTS} in ${delay}ms:`, result.error);
                await new Promise(r => setTimeout(r, delay));
            } else {
                console.error(`[Telegram] Failed after ${RETRY_MAX_ATTEMPTS} attempts:`, result.error);
                this.queue.shift();
                item.resolve(result);
            }
        }

        this.processing = false;
    }

    // ── Public: Enqueue Message ──

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

    // ── Public: Send to All Destinations ──

    async sendToDestinations(
        text: string,
        type: TelegramNotificationType,
        score: number,
        symbol?: string,
    ): Promise<TelegramSendResult[]> {
        const destinations = telegramConfigManager.getDestinationsForType(type, score);

        if (destinations.length === 0) {
            return [{ success: false, error: 'Nenhum destino configurado para este tipo/score' }];
        }

        const results: TelegramSendResult[] = [];
        for (const dest of destinations) {
            const result = await this.enqueueMessage(dest.chatId, text, type, symbol);
            results.push(result);
        }
        return results;
    }

    // ── Notification Methods ──

    async sendNewSignal(data: SignalNotificationData): Promise<TelegramSendResult[]> {
        if (!telegramConfigManager.shouldNotify('new_signal', data.score, data.symbol, data.type)) {
            return [{ success: false, error: 'Notification filtered' }];
        }
        const text = formatNewSignal(data);
        return this.sendToDestinations(text, 'new_signal', data.score, data.symbol);
    }

    async sendTakeProfit(data: TakeProfitNotificationData): Promise<TelegramSendResult[]> {
        if (!telegramConfigManager.shouldNotify('take_profit', 100, data.symbol)) {
            return [{ success: false, error: 'Notification filtered' }];
        }
        return this.sendToDestinations(formatTakeProfit(data), 'take_profit', 100, data.symbol);
    }

    async sendStopLoss(data: StopLossNotificationData): Promise<TelegramSendResult[]> {
        if (!telegramConfigManager.shouldNotify('stop_loss', 100, data.symbol)) {
            return [{ success: false, error: 'Notification filtered' }];
        }
        return this.sendToDestinations(formatStopLoss(data), 'stop_loss', 100, data.symbol);
    }

    async sendRiskAlert(data: RiskAlertNotificationData): Promise<TelegramSendResult[]> {
        if (!telegramConfigManager.shouldNotify('risk_alert', 100)) {
            return [{ success: false, error: 'Notification filtered' }];
        }
        return this.sendToDestinations(formatRiskAlert(data), 'risk_alert', 100);
    }

    async sendDailySummary(data: DailySummaryData): Promise<TelegramSendResult[]> {
        if (!telegramConfigManager.shouldNotify('daily_summary', 100)) {
            return [{ success: false, error: 'Notification filtered' }];
        }
        return this.sendToDestinations(formatDailySummary(data), 'daily_summary', 100);
    }

    async sendMarketAlert(data: MarketAlertData): Promise<TelegramSendResult[]> {
        if (!telegramConfigManager.shouldNotify('market_alert', 100, data.symbol)) {
            return [{ success: false, error: 'Notification filtered' }];
        }
        return this.sendToDestinations(formatMarketAlert(data), 'market_alert', 100, data.symbol);
    }

    async sendFundingRateAlert(data: FundingRateAlertData): Promise<TelegramSendResult[]> {
        if (!telegramConfigManager.shouldNotify('funding_rate', 100, data.symbol)) {
            return [{ success: false, error: 'Notification filtered' }];
        }
        return this.sendToDestinations(formatFundingRateAlert(data), 'funding_rate', 100, data.symbol);
    }

    // ── Paper Trading Notifications ──

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
    }): Promise<TelegramSendResult[]> {
        const emoji = data.action === 'open' ? '📄' : (data.pnl && data.pnl > 0 ? '✅' : '❌');
        const dirEmoji = data.direction === 'long' ? '🟢' : '🔴';

        let text = `${emoji} <b>[PAPER] ${data.action === 'open' ? 'Nova Posição' : 'Posição Fechada'}</b>\n\n`;
        text += `${dirEmoji} <b>${data.symbol}</b> — ${data.direction.toUpperCase()} ${data.leverage}x\n`;
        text += `📌 Entrada: <code>$${data.entryPrice.toFixed(2)}</code>\n`;

        if (data.action === 'close' && data.exitPrice != null) {
            text += `🏁 Saída: <code>$${data.exitPrice.toFixed(2)}</code>\n`;
            text += `💰 PnL: <b>${(data.pnl || 0) >= 0 ? '+' : ''}$${(data.pnl || 0).toFixed(2)}</b> (${(data.pnlPercent || 0).toFixed(1)}%)\n`;
            text += `📎 Motivo: ${data.exitReason || 'Manual'}\n`;
        }

        text += `\n⚠️ <i>Simulação — sem capital real</i>`;

        return this.sendToDestinations(text, 'new_signal', 100, data.symbol);
    }

    // ── Test & Status ──

    async testConnection(chatId: string): Promise<TelegramSendResult> {
        const text = formatTestMessage();
        return this.sendDirect(chatId, text);
    }

    async getBotInfo(): Promise<{ success: boolean; botName?: string; error?: string }> {
        const token = this.getToken();
        if (!token) return { success: false, error: 'Token não configurado' };

        try {
            const response = await fetch(`${TELEGRAM_API}/bot${token}/getMe`);
            const data = await response.json();

            if (data?.ok) {
                this.connectionStatus = 'connected';
                return { success: true, botName: data.result?.username || data.result?.first_name };
            }
            return { success: false, error: data?.description || 'Unknown error' };
        } catch (err) {
            this.connectionStatus = 'disconnected';
            return { success: false, error: (err as Error).message };
        }
    }

    getConnectionStatus(): 'connected' | 'disconnected' | 'unknown' {
        return this.connectionStatus;
    }

    getQueueSize(): number {
        return this.queue.length;
    }
}

// Singleton
export const telegramService = new TelegramServiceClass();
