// useTelegram — React hook for Telegram integration in the dashboard

import { useState, useEffect, useCallback } from 'react';
import { telegramService } from '@/services/telegramService';
import { telegramConfigManager } from '@/services/telegramConfigManager';
import {
    TelegramConfig,
    TelegramMessageLog,
    TelegramNotificationType,
    TelegramDestination,
    NotificationFilters,
} from '@/types/telegram';

export const useTelegram = () => {
    const [config, setConfig] = useState<TelegramConfig>(telegramConfigManager.getConfig());
    const [logs, setLogs] = useState<TelegramMessageLog[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
    const [botName, setBotName] = useState<string>('');
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [hasToken, setHasToken] = useState(telegramService.hasToken());

    useEffect(() => {
        setLogs(telegramConfigManager.getMessageLogs(20));
    }, []);

    const refreshConfig = useCallback(() => {
        setConfig(telegramConfigManager.getConfig());
        setLogs(telegramConfigManager.getMessageLogs(20));
        setHasToken(telegramService.hasToken());
    }, []);

    // ── Token ──

    const saveToken = useCallback((token: string) => {
        telegramService.setToken(token);
        setHasToken(token.length > 0);
    }, []);

    const getToken = useCallback(() => {
        return telegramService.getToken();
    }, []);

    // ── Toggle Enabled ──

    const setEnabled = useCallback((enabled: boolean) => {
        telegramConfigManager.setEnabled(enabled);
        refreshConfig();
    }, [refreshConfig]);

    const setPaused = useCallback((paused: boolean) => {
        telegramConfigManager.setPaused(paused);
        refreshConfig();
    }, [refreshConfig]);

    const setTypeEnabled = useCallback((type: TelegramNotificationType, enabled: boolean) => {
        telegramConfigManager.setTypeEnabled(type, enabled);
        refreshConfig();
    }, [refreshConfig]);

    const updateFilters = useCallback((filters: Partial<NotificationFilters>) => {
        telegramConfigManager.updateFilters(filters);
        refreshConfig();
    }, [refreshConfig]);

    // ── Destinations ──

    const addDestination = useCallback((dest: Omit<TelegramDestination, 'id'>) => {
        telegramConfigManager.addDestination(dest);
        refreshConfig();
    }, [refreshConfig]);

    const updateDestination = useCallback((id: string, partial: Partial<TelegramDestination>) => {
        telegramConfigManager.updateDestination(id, partial);
        refreshConfig();
    }, [refreshConfig]);

    const removeDestination = useCallback((id: string) => {
        telegramConfigManager.removeDestination(id);
        refreshConfig();
    }, [refreshConfig]);

    // ── Test Connection ──

    const testConnection = useCallback(async (chatId: string) => {
        setTesting(true);
        setTestResult(null);

        try {
            const result = await telegramService.testConnection(chatId);
            setTestResult({
                success: result.success,
                message: result.success
                    ? 'Mensagem de teste enviada com sucesso! ✅'
                    : `Erro: ${result.error}`,
            });
            setConnectionStatus(result.success ? 'connected' : 'disconnected');
        } catch (err) {
            setTestResult({
                success: false,
                message: `Erro: ${(err as Error).message}`,
            });
            setConnectionStatus('disconnected');
        } finally {
            setTesting(false);
            refreshConfig();
        }
    }, [refreshConfig]);

    // ── Get Bot Info ──

    const checkBotInfo = useCallback(async () => {
        if (!telegramService.hasToken()) return { success: false, error: 'No token' };
        const info = await telegramService.getBotInfo();
        if (info.success && info.botName) {
            setBotName(info.botName);
            setConnectionStatus('connected');
        } else {
            setConnectionStatus('disconnected');
        }
        return info;
    }, []);

    const clearLogs = useCallback(() => {
        telegramConfigManager.clearMessageLogs();
        setLogs([]);
    }, []);

    return {
        config,
        logs,
        connectionStatus,
        botName,
        testing,
        testResult,
        hasToken,
        setEnabled,
        setPaused,
        setTypeEnabled,
        updateFilters,
        addDestination,
        updateDestination,
        removeDestination,
        testConnection,
        checkBotInfo,
        clearLogs,
        refreshConfig,
        saveToken,
        getToken,
    };
};
