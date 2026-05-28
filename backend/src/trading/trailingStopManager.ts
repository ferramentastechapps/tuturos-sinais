// Trailing Stop Manager — Gestão avançada de posições com trailing stop
// FASE 2: Implementa break-even automático, parcial close e trailing stop dinâmico

import { logger } from '../lib/logger.js';
import type { TradeSignal } from '../types/trading.js';

export interface TrailingStopConfig {
    symbol: string;
    type: 'long' | 'short';
    entry: number;
    currentPrice: number;
    stopLoss: number;
    tp1: number;
    tp2: number;
    tp3: number;
    atr: number;
    tp1Hit: boolean;
    tp2Hit: boolean;
    tp3Hit: boolean;
    positionRemaining: number; // % da posição ainda aberta (100 = total)
}

export interface TrailingStopResult {
    action: 'NONE' | 'CLOSE_PARTIAL' | 'MOVE_SL' | 'TRAILING_STOP' | 'STOP_HIT';
    newStopLoss?: number;
    closePercent?: number; // % da posição a fechar
    reason: string;
    trailingActive: boolean;
}

/**
 * Calcula trailing stop dinâmico baseado nos TPs atingidos.
 *
 * Lógica por nível:
 * 1. TP1 atingido → Stop vai para ENTRADA (breakeven, zero risco)
 * 2. TP2 atingido → Stop vai para TP1 (lucro mínimo garantido)
 * 3. TP3 atingido → Stop vai para TP3 + alvo extendido em +3%
 *
 * Entre TPs: trailing dinâmico por ATR para não perder o lucro.
 */
export function calculateTrailingStop(config: TrailingStopConfig): TrailingStopResult {
    const {
        symbol,
        type,
        entry,
        currentPrice,
        stopLoss,
        tp1,
        tp2,
        tp3,
        atr,
        tp1Hit,
        tp2Hit,
        tp3Hit,
        positionRemaining,
    } = config;

    // ──── VERIFICAR SE STOP LOSS FOI ATINGIDO ────
    const stopHit = type === 'long' 
        ? currentPrice <= stopLoss 
        : currentPrice >= stopLoss;

    if (stopHit) {
        return {
            action: 'STOP_HIT',
            reason: `Stop Loss atingido em ${currentPrice.toFixed(2)}`,
            trailingActive: false,
        };
    }

    // ──── FASE 1: TP1 ATINGIDO ────
    const tp1Reached = type === 'long' 
        ? currentPrice >= tp1 
        : currentPrice <= tp1;

    if (tp1Reached && !tp1Hit) {
        // TP1 atingido: stop vai para entrada (breakeven)
        // O fechamento parcial e a notificação são geridos pelo handleTakeProfit
        const newStopLoss = entry;
        
        logger.info(`[TrailingStop] ${symbol} TP1 atingido! SL → breakeven (${entry.toFixed(2)})`);
        
        return {
            action: 'MOVE_SL',
            newStopLoss,
            reason: 'TP1 atingido: Stop movido para entrada (breakeven)',
            trailingActive: true,
        };
    }

    // ──── FASE 2: TP2 ATINGIDO ────
    const tp2Reached = type === 'long' 
        ? currentPrice >= tp2 
        : currentPrice <= tp2;

    if (tp2Reached && tp1Hit && !tp2Hit) {
        // TP2 atingido: stop vai para TP1
        const newStopLoss = tp1;
        
        logger.info(`[TrailingStop] ${symbol} TP2 atingido! SL → TP1 (${tp1.toFixed(2)})`);
        
        return {
            action: 'MOVE_SL',
            newStopLoss,
            reason: 'TP2 atingido: Stop movido para TP1 (lucro garantido)',
            trailingActive: true,
        };
    }

    // ──── FASE 3: TP3 ATINGIDO ────
    const tp3Reached = type === 'long' 
        ? currentPrice >= tp3 
        : currentPrice <= tp3;

    if (tp3Reached && tp2Hit && !tp3Hit) {
        // TP3 atingido: stop vai para TP3, alvo extendido +3%
        const newStopLoss = tp3;
        
        logger.info(`[TrailingStop] ${symbol} TP3 atingido! SL → TP3 (${tp3.toFixed(2)}), alvo extendido`);
        
        return {
            action: 'MOVE_SL',
            newStopLoss,
            reason: 'TP3 atingido: Stop movido para TP3, deixe correr!',
            trailingActive: true,
        };
    }

    // ──── TRAILING STOP ATIVO ────
    // Após TP1: trailing de 50% ATR
    // Após TP2: trailing de 30% ATR
    // Após TP3: trailing livre (segue o preço)

    if (tp1Hit && !tp2Hit) {
        // Trailing após TP1: 50% ATR
        const trailingDistance = atr * 0.5;
        const potentialNewSL = type === 'long'
            ? currentPrice - trailingDistance
            : currentPrice + trailingDistance;

        // Só move o SL se for melhor que o atual (nunca piora)
        const shouldUpdate = type === 'long'
            ? potentialNewSL > stopLoss
            : potentialNewSL < stopLoss;

        if (shouldUpdate) {
            logger.debug(`[TrailingStop] ${symbol} Trailing ativo (50% ATR): SL ${stopLoss.toFixed(2)} → ${potentialNewSL.toFixed(2)}`);
            
            return {
                action: 'TRAILING_STOP',
                newStopLoss: potentialNewSL,
                reason: `Trailing stop ativo (50% ATR = ${trailingDistance.toFixed(2)})`,
                trailingActive: true,
            };
        }
    }

    if (tp2Hit && !tp3Hit) {
        // Trailing após TP2: 30% ATR (mais apertado)
        const trailingDistance = atr * 0.3;
        const potentialNewSL = type === 'long'
            ? currentPrice - trailingDistance
            : currentPrice + trailingDistance;

        const shouldUpdate = type === 'long'
            ? potentialNewSL > stopLoss
            : potentialNewSL < stopLoss;

        if (shouldUpdate) {
            logger.debug(`[TrailingStop] ${symbol} Trailing ativo (30% ATR): SL ${stopLoss.toFixed(2)} → ${potentialNewSL.toFixed(2)}`);
            
            return {
                action: 'TRAILING_STOP',
                newStopLoss: potentialNewSL,
                reason: `Trailing stop ativo (30% ATR = ${trailingDistance.toFixed(2)})`,
                trailingActive: true,
            };
        }
    }

    if (tp3Hit) {
        // Trailing livre após TP3: segue o preço de perto (20% ATR)
        const trailingDistance = atr * 0.2;
        const potentialNewSL = type === 'long'
            ? currentPrice - trailingDistance
            : currentPrice + trailingDistance;

        const shouldUpdate = type === 'long'
            ? potentialNewSL > stopLoss
            : potentialNewSL < stopLoss;

        if (shouldUpdate) {
            logger.debug(`[TrailingStop] ${symbol} Trailing LIVRE (20% ATR): SL ${stopLoss.toFixed(2)} → ${potentialNewSL.toFixed(2)}`);
            
            return {
                action: 'TRAILING_STOP',
                newStopLoss: potentialNewSL,
                reason: `Trailing livre ativo (20% ATR = ${trailingDistance.toFixed(2)})`,
                trailingActive: true,
            };
        }
    }

    // Nenhuma ação necessária
    return {
        action: 'NONE',
        reason: 'Aguardando próximo TP ou movimento de preço',
        trailingActive: tp1Hit, // Trailing ativo após TP1
    };
}

/**
 * FASE 2: Calcula o lucro parcial acumulado
 */
export function calculatePartialProfit(
    entry: number,
    tp1: number,
    tp2: number,
    currentPrice: number,
    type: 'long' | 'short',
    tp1Hit: boolean,
    tp2Hit: boolean
): number {
    let profit = 0;

    if (tp1Hit) {
        // 40% fechado no TP1
        const tp1Profit = type === 'long'
            ? ((tp1 - entry) / entry) * 100
            : ((entry - tp1) / entry) * 100;
        profit += tp1Profit * 0.4;
    }

    if (tp2Hit) {
        // 30% fechado no TP2
        const tp2Profit = type === 'long'
            ? ((tp2 - entry) / entry) * 100
            : ((entry - tp2) / entry) * 100;
        profit += tp2Profit * 0.3;
    }

    // Lucro flutuante dos 30% restantes (ou 60% se só TP1 foi atingido)
    const remainingPercent = tp2Hit ? 0.3 : (tp1Hit ? 0.6 : 1.0);
    const floatingProfit = type === 'long'
        ? ((currentPrice - entry) / entry) * 100
        : ((entry - currentPrice) / entry) * 100;
    profit += floatingProfit * remainingPercent;

    return profit;
}

/**
 * FASE 2: Formata mensagem de atualização de trailing stop para Telegram
 */
export function formatTrailingStopMessage(
    signal: TradeSignal,
    result: TrailingStopResult,
    currentPrice: number,
    partialProfit: number
): string {
    const { pair, type } = signal;
    const emoji = type === 'long' ? '🟢' : '🔴';
    
    let msg = `${emoji} <b>${type.toUpperCase()} ${pair}</b>\n\n`;

    if (result.action === 'CLOSE_PARTIAL') {
        msg += `✅ <b>${result.closePercent}% da posição fechada!</b>\n`;
        msg += `💰 Lucro parcial: <b>${partialProfit > 0 ? '+' : ''}${partialProfit.toFixed(2)}%</b>\n\n`;
    }

    if (result.newStopLoss) {
        msg += `🛡 <b>Stop Loss atualizado:</b>\n`;
        const oldSL = signal.stopLoss != null ? signal.stopLoss.toFixed(2) : '?';
        msg += `   ${oldSL} → ${result.newStopLoss.toFixed(2)}\n\n`;
    }

    msg += `📊 <b>Status:</b> ${result.reason}\n`;
    msg += `💵 Preço atual: ${currentPrice.toFixed(2)}\n`;
    
    if (result.trailingActive) {
        msg += `\n⚡ <b>Trailing Stop ATIVO</b> - Lucro protegido!`;
    }

    return msg;
}

/**
 * FASE 2: Verifica se deve enviar notificação de trailing stop
 * (evita spam - só notifica em mudanças significativas)
 */
export function shouldNotifyTrailingUpdate(
    lastNotifiedSL: number | null,
    newSL: number,
    minChangePercent: number = 0.5
): boolean {
    if (!lastNotifiedSL) return true;
    
    const changePercent = Math.abs((newSL - lastNotifiedSL) / lastNotifiedSL) * 100;
    return changePercent >= minChangePercent;
}
