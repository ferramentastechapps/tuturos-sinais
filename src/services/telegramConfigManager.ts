// Telegram Config Manager
// Manages Telegram integration settings via localStorage (follows riskConfigManager pattern)

import {
    TelegramConfig,
    TelegramDestination,
    NotificationFilters,
    TelegramNotificationType,
    TelegramMessageLog,
    DEFAULT_TELEGRAM_CONFIG,
} from '@/types/telegram';

// ──────────── Constants ────────────

const STORAGE_KEY_CONFIG = 'telegram_config';
const STORAGE_KEY_LOGS = 'telegram_message_logs';
const MAX_LOG_ENTRIES = 100;

// ──────────── Config Manager ────────────

class TelegramConfigManagerClass {
    private config: TelegramConfig;

    constructor() {
        this.config = this.load();
    }

    // ── Load/Save ──

    private load(): TelegramConfig {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...DEFAULT_TELEGRAM_CONFIG, ...parsed };
            }
        } catch (e) {
            console.error('Error loading Telegram config:', e);
        }
        return { ...DEFAULT_TELEGRAM_CONFIG };
    }

    private save(): void {
        try {
            localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
        } catch (e) {
            console.error('Error saving Telegram config:', e);
        }
    }

    // ── Getters ──

    getConfig(): TelegramConfig {
        return { ...this.config };
    }

    isEnabled(): boolean {
        return this.config.enabled && !this.config.paused;
    }

    isPaused(): boolean {
        return this.config.paused;
    }

    getDestinations(): TelegramDestination[] {
        return [...this.config.destinations];
    }

    getFilters(): NotificationFilters {
        return { ...this.config.filters };
    }

    isTypeEnabled(type: TelegramNotificationType): boolean {
        return this.config.enabledTypes[type] ?? true;
    }

    // ── Setters ──

    updateConfig(partial: Partial<TelegramConfig>): TelegramConfig {
        this.config = { ...this.config, ...partial };
        this.save();
        return this.getConfig();
    }

    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
        this.save();
    }

    setPaused(paused: boolean): void {
        this.config.paused = paused;
        this.save();
    }

    setTypeEnabled(type: TelegramNotificationType, enabled: boolean): void {
        this.config.enabledTypes[type] = enabled;
        this.save();
    }

    updateFilters(partial: Partial<NotificationFilters>): void {
        this.config.filters = { ...this.config.filters, ...partial };
        this.save();
    }

    // ── Destinations ──

    addDestination(destination: Omit<TelegramDestination, 'id'>): TelegramDestination {
        const id = `dest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const newDest: TelegramDestination = { ...destination, id };
        this.config.destinations.push(newDest);
        this.save();
        return newDest;
    }

    updateDestination(id: string, partial: Partial<TelegramDestination>): void {
        const index = this.config.destinations.findIndex(d => d.id === id);
        if (index !== -1) {
            this.config.destinations[index] = { ...this.config.destinations[index], ...partial };
            this.save();
        }
    }

    removeDestination(id: string): void {
        this.config.destinations = this.config.destinations.filter(d => d.id !== id);
        this.save();
    }

    // ── Filters Validation ──

    shouldNotify(
        type: TelegramNotificationType,
        score: number,
        symbol?: string,
        direction?: 'long' | 'short',
        category?: string,
        riskReward?: number,
    ): boolean {
        const config = this.config;
        const filters = config.filters;

        // Global checks
        if (!config.enabled || config.paused) return false;
        if (!config.enabledTypes[type]) return false;

        // Score check
        if (score < filters.minScore) return false;

        // Direction filter
        if (direction && filters.directions.length > 0 && !filters.directions.includes(direction)) {
            return false;
        }

        // Category filter
        if (category && filters.categories.length > 0 && !filters.categories.includes(category as any)) {
            return false;
        }

        // Risk/Reward filter
        if (riskReward !== undefined && riskReward < filters.minRiskReward) {
            return false;
        }

        // Silent hours
        if (filters.silentHoursEnabled) {
            const currentHour = new Date().getUTCHours();
            const { silentHoursStart, silentHoursEnd } = filters;
            if (silentHoursStart <= silentHoursEnd) {
                if (currentHour >= silentHoursStart && currentHour < silentHoursEnd) return false;
            } else {
                if (currentHour >= silentHoursStart || currentHour < silentHoursEnd) return false;
            }
        }

        // Frequency check (per coin per hour)
        if (symbol && filters.maxPerHourPerCoin > 0) {
            const logs = this.getMessageLogs();
            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            const recentForCoin = logs.filter(
                l => l.symbol === symbol && l.timestamp > oneHourAgo && l.success
            );
            if (recentForCoin.length >= filters.maxPerHourPerCoin) return false;
        }

        return true;
    }

    getDestinationsForType(type: TelegramNotificationType, score: number): TelegramDestination[] {
        return this.config.destinations.filter(d =>
            d.enabled &&
            d.enabledTypes.includes(type) &&
            score >= d.minScore
        );
    }

    // ── Message Logs ──

    getMessageLogs(limit?: number): TelegramMessageLog[] {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_LOGS);
            const logs: TelegramMessageLog[] = stored ? JSON.parse(stored) : [];
            return limit ? logs.slice(0, limit) : logs;
        } catch {
            return [];
        }
    }

    addMessageLog(log: TelegramMessageLog): void {
        try {
            const logs = this.getMessageLogs();
            logs.unshift(log);
            const trimmed = logs.slice(0, MAX_LOG_ENTRIES);
            localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(trimmed));
        } catch (e) {
            console.error('Error saving message log:', e);
        }
    }

    clearMessageLogs(): void {
        localStorage.removeItem(STORAGE_KEY_LOGS);
    }
}

// Singleton
export const telegramConfigManager = new TelegramConfigManagerClass();
