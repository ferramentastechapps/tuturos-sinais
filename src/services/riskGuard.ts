// Risk Guard — Sistema de bloqueio de operações
// Verifica condições que impedem abertura de novas posições

import { GlobalRiskLimits } from '@/types/riskProfiles';
import { riskLogger } from './riskLogger';
import { riskConfigManager } from './riskConfigManager';

// ──────────── Tipos ────────────

export interface GuardCheckResult {
    canOpen: boolean;
    reasons: string[];
    warnings: string[];
}

// ──────────── Risk Guard ────────────

/**
 * Verifica se pode abrir uma nova posição baseado nos limites globais e estado da conta.
 */
export const checkCanOpenPosition = (
    symbol: string,
    currentOpenPositions: number,
    currentOpenByCategory: Record<string, number>,
    currentCapitalAllocated: number // % do capital alocado atualmente
): GuardCheckResult => {
    const limits = riskConfigManager.getGlobalLimits();
    const config = riskConfigManager.getConfig(symbol);
    const reasons: string[] = [];
    const warnings: string[] = [];

    // 1. Ativo desabilitado
    if (!config.enabled) {
        reasons.push(`${symbol} está desabilitado para operações`);
    }

    // 2. Drawdown diário
    const dailyDD = riskLogger.getDailyDrawdown(limits.portfolioCapital);
    if (dailyDD >= limits.maxDailyDrawdown) {
        reasons.push(`Drawdown diário atingiu ${dailyDD.toFixed(2)}% (limite: ${limits.maxDailyDrawdown}%)`);
        riskLogger.logBlock(symbol, `Drawdown diário: ${dailyDD.toFixed(2)}%`, { limit: limits.maxDailyDrawdown });
    } else if (dailyDD >= limits.maxDailyDrawdown * 0.8) {
        warnings.push(`Drawdown diário em ${dailyDD.toFixed(2)}% (limite: ${limits.maxDailyDrawdown}%)`);
        riskLogger.logAlert(symbol, 'drawdown_warning', `DD diário em ${dailyDD.toFixed(2)}% — próximo do limite`);
    }

    // 3. Drawdown semanal
    const weeklyDD = riskLogger.getWeeklyDrawdown(limits.portfolioCapital);
    if (weeklyDD >= limits.maxWeeklyDrawdown) {
        reasons.push(`Drawdown semanal atingiu ${weeklyDD.toFixed(2)}% (limite: ${limits.maxWeeklyDrawdown}%)`);
        riskLogger.logBlock(symbol, `Drawdown semanal: ${weeklyDD.toFixed(2)}%`, { limit: limits.maxWeeklyDrawdown });
    } else if (weeklyDD >= limits.maxWeeklyDrawdown * 0.8) {
        warnings.push(`Drawdown semanal em ${weeklyDD.toFixed(2)}% (limite: ${limits.maxWeeklyDrawdown}%)`);
    }

    // 4. Perdas consecutivas
    const consecutiveLosses = riskLogger.getConsecutiveLosses();
    if (consecutiveLosses >= limits.maxConsecutiveLosses) {
        reasons.push(`${consecutiveLosses} operações perdedoras consecutivas (limite: ${limits.maxConsecutiveLosses})`);
        riskLogger.logBlock(symbol, `${consecutiveLosses} perdas consecutivas`, { limit: limits.maxConsecutiveLosses });
    } else if (consecutiveLosses >= limits.maxConsecutiveLosses - 1) {
        warnings.push(`${consecutiveLosses} perdas consecutivas — próximo do limite`);
    }

    // 5. Máximo de posições abertas
    if (currentOpenPositions >= limits.maxOpenPositions) {
        reasons.push(`Máximo de ${limits.maxOpenPositions} posições abertas atingido`);
    }

    // 6. Capital alocado
    if (currentCapitalAllocated >= limits.maxCapitalAllocated) {
        reasons.push(`Capital alocado em ${currentCapitalAllocated.toFixed(1)}% (limite: ${limits.maxCapitalAllocated}%)`);
    }

    // 7. Máximo por categoria
    const category = config.category;
    const categoryLimit = limits.maxPositionsPerCategory.find(c => c.category === category);
    if (categoryLimit) {
        const currentInCategory = currentOpenByCategory[category] || 0;
        if (currentInCategory >= categoryLimit.maxPositions) {
            reasons.push(`Máximo de ${categoryLimit.maxPositions} posições na categoria "${category}" atingido`);
        }
    }

    return {
        canOpen: reasons.length === 0,
        reasons,
        warnings,
    };
};

/**
 * Verifica se uma operação específica atende os critérios mínimos de risco.
 * Retorna warnings se os parâmetros estão fora dos limites recomendados.
 */
export const validateTradeParameters = (
    symbol: string,
    leverage: number,
    stopLossPercent: number,
    riskRewardRatio: number,
    volume24h: number,
    fundingRate: number
): GuardCheckResult => {
    const config = riskConfigManager.getConfig(symbol);
    const reasons: string[] = [];
    const warnings: string[] = [];

    // Alavancagem
    if (leverage > config.leverage.max) {
        reasons.push(`Alavancagem ${leverage}x excede máximo de ${config.leverage.max}x para ${symbol}`);
    } else if (leverage > config.leverage.suggested) {
        warnings.push(`Alavancagem ${leverage}x acima do sugerido (${config.leverage.suggested}x)`);
    }

    // Stop Loss
    if (stopLossPercent < config.stopLoss.min) {
        warnings.push(`Stop Loss ${stopLossPercent}% abaixo do mínimo recomendado (${config.stopLoss.min}%)`);
    }

    // Risk/Reward
    if (riskRewardRatio < config.position.minRiskReward) {
        reasons.push(`R:R ${riskRewardRatio.toFixed(2)} abaixo do mínimo (${config.position.minRiskReward}:1)`);
    }

    // Volume
    if (volume24h < config.filters.minVolume24h) {
        warnings.push(`Volume 24h ${formatVolume(volume24h)} abaixo do mínimo (${formatVolume(config.filters.minVolume24h)})`);
    }

    // Funding Rate
    if (config.filters.avoidHighFunding && Math.abs(fundingRate) > config.filters.maxFundingRate) {
        warnings.push(`Funding Rate ${fundingRate.toFixed(4)}% acima do limite (${config.filters.maxFundingRate}%)`);
    }

    return {
        canOpen: reasons.length === 0,
        reasons,
        warnings,
    };
};

// ──────────── Helpers ────────────

const formatVolume = (volume: number): string => {
    if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(1)}B`;
    if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`;
    if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}K`;
    return volume.toFixed(0);
};
