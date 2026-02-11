// useRiskManagement — Hook React para consumir o sistema de risco
// Integra config manager, dynamic adjuster, risk guard, e logger

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
    AssetRiskConfig,
    AdjustedRiskConfig,
    GlobalRiskLimits,
    RiskLogEntry,
    DailyReport,
    RiskProfileType,
} from '@/types/riskProfiles';
import { riskConfigManager } from '@/services/riskConfigManager';
import { riskLogger } from '@/services/riskLogger';
import { adjustRiskForMarketConditions, MarketConditions } from '@/services/dynamicRiskAdjuster';
import { checkCanOpenPosition, validateTradeParameters, GuardCheckResult } from '@/services/riskGuard';
import { RISK_PROFILES } from '@/data/riskProfileDefaults';

// ──────────── Hook ────────────

export const useRiskManagement = () => {
    const [configs, setConfigs] = useState<AssetRiskConfig[]>([]);
    const [globalLimits, setGlobalLimitsState] = useState<GlobalRiskLimits>(riskConfigManager.getGlobalLimits());
    const [logs, setLogs] = useState<RiskLogEntry[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);

    // Carrega configs
    useEffect(() => {
        setConfigs(riskConfigManager.getAllConfigs());
        setLogs(riskLogger.getLogs({ limit: 100 }));
    }, [refreshKey]);

    const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

    // ──── Config Operations ────

    const getConfigForSymbol = useCallback((symbol: string): AssetRiskConfig => {
        return riskConfigManager.getConfig(symbol);
    }, []);

    const updateConfig = useCallback((symbol: string, partial: Partial<AssetRiskConfig>) => {
        riskConfigManager.updateConfig(symbol, partial);
        refresh();
    }, [refresh]);

    const resetConfig = useCallback((symbol: string) => {
        riskConfigManager.resetConfig(symbol);
        refresh();
    }, [refresh]);

    const toggleAsset = useCallback((symbol: string, enabled: boolean) => {
        riskConfigManager.toggleAsset(symbol, enabled);
        refresh();
    }, [refresh]);

    // ──── Global Limits ────

    const setGlobalLimits = useCallback((limits: Partial<GlobalRiskLimits>) => {
        const updated = riskConfigManager.setGlobalLimits(limits);
        setGlobalLimitsState(updated);
    }, []);

    const setPortfolioCapital = useCallback((amount: number) => {
        riskConfigManager.setPortfolioCapital(amount);
        setGlobalLimitsState(riskConfigManager.getGlobalLimits());
    }, []);

    // ──── Dynamic Adjustment ────

    const getAdjustedConfig = useCallback((
        symbol: string,
        conditions: MarketConditions
    ): AdjustedRiskConfig => {
        const config = riskConfigManager.getConfig(symbol);
        return adjustRiskForMarketConditions(config, conditions);
    }, []);

    // ──── Risk Guard ────

    const canOpenPosition = useCallback((
        symbol: string,
        currentOpenPositions?: number,
        currentOpenByCategory?: Record<string, number>,
        currentCapitalAllocated?: number
    ): GuardCheckResult => {
        return checkCanOpenPosition(
            symbol,
            currentOpenPositions || 0,
            currentOpenByCategory || {},
            currentCapitalAllocated || 0
        );
    }, []);

    const validateTrade = useCallback((
        symbol: string,
        leverage: number,
        stopLossPercent: number,
        riskRewardRatio: number,
        volume24h: number,
        fundingRate: number
    ): GuardCheckResult => {
        return validateTradeParameters(symbol, leverage, stopLossPercent, riskRewardRatio, volume24h, fundingRate);
    }, []);

    // ──── Logs ────

    const refreshLogs = useCallback(() => {
        setLogs(riskLogger.getLogs({ limit: 100 }));
    }, []);

    const todayLogs = useMemo(() => {
        return riskLogger.getTodayLogs();
    }, [logs]);

    const generateReport = useCallback((): DailyReport => {
        const report = riskLogger.generateDailyReport();
        refreshLogs();
        return report;
    }, [refreshLogs]);

    // ──── Stats ────

    const profileStats = useMemo(() => {
        return riskConfigManager.getProfileStats();
    }, [configs]);

    const enabledCount = useMemo(() => {
        return configs.filter(c => c.enabled).length;
    }, [configs]);

    const profiles = RISK_PROFILES;

    return {
        // Configs
        configs,
        getConfigForSymbol,
        updateConfig,
        resetConfig,
        toggleAsset,
        refresh,

        // Global
        globalLimits,
        setGlobalLimits,
        setPortfolioCapital,

        // Dynamic
        getAdjustedConfig,

        // Guard
        canOpenPosition,
        validateTrade,

        // Logs
        logs,
        todayLogs,
        refreshLogs,
        generateReport,

        // Stats
        profileStats,
        enabledCount,
        profiles,
    };
};
