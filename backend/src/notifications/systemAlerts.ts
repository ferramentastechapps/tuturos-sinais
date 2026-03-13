// System Alerts — Telegram notifications for system events

import { logger } from '../lib/logger.js';
import { telegramService } from './telegramService.js';
import os from 'os';

let startTime = Date.now();

function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60) % 60;
    const hours = Math.floor(seconds / 3600) % 24;
    const days = Math.floor(seconds / 86400);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(' ');
}

export async function sendSystemStartAlert(): Promise<void> {
    startTime = Date.now();
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const text = [
        `🚀 <b>SISTEMA INICIADO</b>`,
        ``,
        `✅ Signal Engine online`,
        `📊 Monitoramento ativo`,
        `🕐 ${now}`,
    ].join('\n');

    try {
        await telegramService.send(text, 'market_alert');
        logger.info('System start alert sent');
    } catch (error) {
        logger.error('Failed to send system start alert', { error });
    }
}

export async function sendSystemRestartAlert(previousUptime: number): Promise<void> {
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const text = [
        `🔧 <b>SISTEMA — signal-engine reiniciado</b>`,
        ``,
        `⏱ Uptime anterior: ${formatUptime(previousUptime)}`,
        `✅ Todos os serviços reconectados`,
        `🕐 ${now}`,
    ].join('\n');

    try {
        await telegramService.send(text, 'market_alert');
        logger.info('System restart alert sent');
    } catch (error) {
        logger.error('Failed to send restart alert', { error });
    }
}

export async function sendWebSocketReconnectAlert(provider: string, attempt: number): Promise<void> {
    const text = [
        `⚠️ <b>WEBSOCKET RECONECTANDO</b>`,
        ``,
        `📡 ${provider}`,
        `🔄 Tentativa: ${attempt}`,
        `⏱ Uptime: ${formatUptime(Date.now() - startTime)}`,
    ].join('\n');

    try {
        await telegramService.send(text, 'risk_alert');
    } catch (error) {
        logger.error('Failed to send WebSocket reconnect alert', { error });
    }
}

export async function sendCriticalErrorAlert(error: string, context?: string): Promise<void> {
    const text = [
        `🚨 <b>ERRO CRÍTICO</b>`,
        ``,
        `❌ ${error}`,
        context ? `📋 Contexto: ${context}` : '',
        `⏱ Uptime: ${formatUptime(Date.now() - startTime)}`,
    ].filter(Boolean).join('\n');

    try {
        await telegramService.send(text, 'risk_alert');
    } catch (err) {
        logger.error('Failed to send critical error alert', { error: err });
    }
}

export async function sendMemoryAlert(): Promise<void> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedPercent = ((totalMem - freeMem) / totalMem * 100).toFixed(1);

    const text = [
        `⚠️ <b>ALERTA DE MEMÓRIA</b>`,
        ``,
        `💾 Uso: ${usedPercent}%`,
        `📊 Livre: ${(freeMem / 1024 / 1024 / 1024).toFixed(1)} GB`,
        `⏱ Uptime: ${formatUptime(Date.now() - startTime)}`,
    ].join('\n');

    try {
        await telegramService.send(text, 'risk_alert');
    } catch (error) {
        logger.error('Failed to send memory alert', { error });
    }
}

// Health monitoring — checks memory usage periodically
export function startSystemMonitor(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(() => {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedPercent = (totalMem - freeMem) / totalMem * 100;

        if (usedPercent > 80) {
            sendMemoryAlert();
        }

        // Log system stats
        const memUsage = process.memoryUsage();
        logger.debug('System stats', {
            memoryUsedPercent: usedPercent.toFixed(1),
            heapUsedMB: (memUsage.heapUsed / 1024 / 1024).toFixed(1),
            rssUsedMB: (memUsage.rss / 1024 / 1024).toFixed(1),
            uptime: formatUptime(Date.now() - startTime),
        });
    }, intervalMs);
}

export function getUptime(): string {
    return formatUptime(Date.now() - startTime);
}

export function getUptimeMs(): number {
    return Date.now() - startTime;
}
