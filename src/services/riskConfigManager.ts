// Risk Config Manager — Gerenciador central de configurações de risco
// CRUD de configs por ativo com persistência em localStorage

import {
    AssetRiskConfig,
    GlobalRiskLimits,
    CategoryLimit,
} from '@/types/riskProfiles';
import { AssetCategory } from '@/types/trading';
import { getDefaultAssetRiskConfigs, generateAssetRiskConfig } from '@/data/assetRiskConfigs';

// ──────────── Constantes ────────────

const STORAGE_KEY_OVERRIDES = 'risk_config_overrides';
const STORAGE_KEY_GLOBAL = 'risk_global_limits';
const STORAGE_KEY_DISABLED = 'risk_disabled_assets';

// ──────────── Limites Globais Padrão ────────────

const DEFAULT_GLOBAL_LIMITS: GlobalRiskLimits = {
    maxOpenPositions: 5,
    maxCapitalAllocated: 50,    // % do capital total
    maxPositionsPerCategory: [
        { category: 'layer1', maxPositions: 3 },
        { category: 'layer2', maxPositions: 2 },
        { category: 'defi', maxPositions: 2 },
        { category: 'meme', maxPositions: 1 },
        { category: 'ai', maxPositions: 2 },
        { category: 'gaming', maxPositions: 1 },
        { category: 'infra', maxPositions: 1 },
        { category: 'exchange', maxPositions: 1 },
        { category: 'privacy', maxPositions: 1 },
        { category: 'rwa', maxPositions: 1 },
        { category: 'trending', maxPositions: 1 },
        { category: 'other', maxPositions: 1 },
    ] as CategoryLimit[],
    portfolioCapital: 10000,
    maxDailyDrawdown: 5,
    maxWeeklyDrawdown: 10,
    maxConsecutiveLosses: 3,
};

// ──────────── Helpers de Storage ────────────

const loadJSON = <T>(key: string, fallback: T): T => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};

const saveJSON = <T>(key: string, data: T): void => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error(`[RiskConfigManager] Failed to save ${key}:`, e);
    }
};

// ──────────── Risk Config Manager ────────────

class RiskConfigManagerClass {
    private defaults: Map<string, AssetRiskConfig>;
    private overrides: Map<string, Partial<AssetRiskConfig>>;
    private disabledAssets: Set<string>;
    private globalLimits: GlobalRiskLimits;

    constructor() {
        // Carregar defaults
        this.defaults = new Map();
        getDefaultAssetRiskConfigs().forEach(cfg => {
            this.defaults.set(cfg.symbol, cfg);
        });

        // Carregar overrides do localStorage
        const savedOverrides = loadJSON<Record<string, Partial<AssetRiskConfig>>>(STORAGE_KEY_OVERRIDES, {});
        this.overrides = new Map(Object.entries(savedOverrides));

        // Carregar assets desabilitados
        const savedDisabled = loadJSON<string[]>(STORAGE_KEY_DISABLED, []);
        this.disabledAssets = new Set(savedDisabled);

        // Carregar limites globais
        this.globalLimits = loadJSON<GlobalRiskLimits>(STORAGE_KEY_GLOBAL, DEFAULT_GLOBAL_LIMITS);
    }

    // ──── Queries ────

    /**
     * Retorna a config efetiva para um símbolo (default + overrides mesclados).
     */
    getConfig(symbol: string): AssetRiskConfig {
        const sym = symbol.toUpperCase();
        let base = this.defaults.get(sym);

        // Se não existe nos defaults, gera dinamicamente
        if (!base) {
            base = generateAssetRiskConfig({
                symbol: sym,
                name: sym.replace(/USDT$/i, ''),
                category: 'other',
            });
            this.defaults.set(sym, base);
        }

        const override = this.overrides.get(sym);
        const isDisabled = this.disabledAssets.has(sym);

        if (!override) {
            return { ...base, enabled: !isDisabled };
        }

        // Merge profundo dos overrides
        return {
            ...base,
            ...override,
            enabled: !isDisabled,
            leverage: { ...base.leverage, ...(override.leverage || {}) },
            stopLoss: { ...base.stopLoss, ...(override.stopLoss || {}) },
            takeProfit: {
                ...base.takeProfit,
                ...(override.takeProfit || {}),
                tp1: { ...base.takeProfit.tp1, ...(override.takeProfit?.tp1 || {}) },
                tp2: { ...base.takeProfit.tp2, ...(override.takeProfit?.tp2 || {}) },
                tp3: { ...base.takeProfit.tp3, ...(override.takeProfit?.tp3 || {}) },
            },
            position: { ...base.position, ...(override.position || {}) },
            filters: { ...base.filters, ...(override.filters || {}) },
        } as AssetRiskConfig;
    }

    /**
     * Retorna todas as configs (defaults + overrides aplicados).
     */
    getAllConfigs(): AssetRiskConfig[] {
        const symbols = new Set([...this.defaults.keys(), ...this.overrides.keys()]);
        return Array.from(symbols).map(sym => this.getConfig(sym));
    }

    /**
     * Retorna configs filtradas por categoria.
     */
    getConfigsByCategory(category: AssetCategory): AssetRiskConfig[] {
        return this.getAllConfigs().filter(cfg => cfg.category === category);
    }

    /**
     * Retorna apenas configs habilitadas.
     */
    getEnabledConfigs(): AssetRiskConfig[] {
        return this.getAllConfigs().filter(cfg => cfg.enabled);
    }

    /**
     * Retorna a contagem de configs por perfil de risco.
     */
    getProfileStats(): Record<string, number> {
        const stats: Record<string, number> = { conservative: 0, moderate: 0, aggressive: 0, speculative: 0 };
        this.getAllConfigs().forEach(cfg => {
            stats[cfg.riskProfile] = (stats[cfg.riskProfile] || 0) + 1;
        });
        return stats;
    }

    // ──── Mutations ────

    /**
     * Atualiza parcialmente a config de um símbolo.
     */
    updateConfig(symbol: string, partial: Partial<AssetRiskConfig>): AssetRiskConfig {
        const sym = symbol.toUpperCase();
        const existing = this.overrides.get(sym) || {};
        const merged = { ...existing, ...partial };
        this.overrides.set(sym, merged);
        this.persistOverrides();
        return this.getConfig(sym);
    }

    /**
     * Remove todos os overrides de um símbolo (volta ao default do perfil).
     */
    resetConfig(symbol: string): AssetRiskConfig {
        const sym = symbol.toUpperCase();
        this.overrides.delete(sym);
        this.disabledAssets.delete(sym);
        this.persistOverrides();
        this.persistDisabled();
        return this.getConfig(sym);
    }

    /**
     * Ativa ou desativa um ativo.
     */
    toggleAsset(symbol: string, enabled: boolean): void {
        const sym = symbol.toUpperCase();
        if (enabled) {
            this.disabledAssets.delete(sym);
        } else {
            this.disabledAssets.add(sym);
        }
        this.persistDisabled();
    }

    // ──── Global Limits ────

    getGlobalLimits(): GlobalRiskLimits {
        return { ...this.globalLimits };
    }

    setGlobalLimits(limits: Partial<GlobalRiskLimits>): GlobalRiskLimits {
        this.globalLimits = { ...this.globalLimits, ...limits };
        saveJSON(STORAGE_KEY_GLOBAL, this.globalLimits);
        return this.globalLimits;
    }

    getPortfolioCapital(): number {
        return this.globalLimits.portfolioCapital;
    }

    setPortfolioCapital(amount: number): void {
        this.globalLimits.portfolioCapital = amount;
        saveJSON(STORAGE_KEY_GLOBAL, this.globalLimits);
    }

    // ──── Persistence ────

    private persistOverrides(): void {
        const obj: Record<string, Partial<AssetRiskConfig>> = {};
        this.overrides.forEach((v, k) => { obj[k] = v; });
        saveJSON(STORAGE_KEY_OVERRIDES, obj);
    }

    private persistDisabled(): void {
        saveJSON(STORAGE_KEY_DISABLED, Array.from(this.disabledAssets));
    }
}

// Singleton
export const riskConfigManager = new RiskConfigManagerClass();
