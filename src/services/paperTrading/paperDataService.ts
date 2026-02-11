// ═══════════════════════════════════════════════════════════
// Paper Data Service — Persistence (localStorage)
// ═══════════════════════════════════════════════════════════

import {
    PaperPortfolioState,
    PaperTradingConfig,
    DEFAULT_PAPER_CONFIG,
} from '@/types/paperTrading';

const STORAGE_KEYS = {
    STATE: 'paper_trading_state',
    CONFIG: 'paper_trading_config',
} as const;

// ──────────── State ────────────

export const saveState = (state: PaperPortfolioState): void => {
    try {
        localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(state));
    } catch (e) {
        console.warn('[PaperDataService] Failed to save state:', e);
    }
};

export const loadState = (): PaperPortfolioState | null => {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.STATE);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

// ──────────── Config ────────────

export const saveConfig = (config: PaperTradingConfig): void => {
    try {
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    } catch (e) {
        console.warn('[PaperDataService] Failed to save config:', e);
    }
};

export const loadConfig = (): PaperTradingConfig => {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
        return raw ? { ...DEFAULT_PAPER_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_PAPER_CONFIG };
    } catch {
        return { ...DEFAULT_PAPER_CONFIG };
    }
};

// ──────────── Clear ────────────

export const clearAllData = (): void => {
    localStorage.removeItem(STORAGE_KEYS.STATE);
    localStorage.removeItem(STORAGE_KEYS.CONFIG);
};
