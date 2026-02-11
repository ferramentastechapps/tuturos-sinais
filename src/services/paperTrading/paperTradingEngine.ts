// ═══════════════════════════════════════════════════════════
// Paper Trading Engine — Main orchestrator
// ═══════════════════════════════════════════════════════════

import {
    PaperTradingConfig,
    PaperPortfolioState,
    PaperPosition,
    PaperOrder,
    PaperTradingMode,
    PaperEquityPoint,
    DEFAULT_PAPER_CONFIG,
} from '@/types/paperTrading';
import {
    simulateMarketEntry,
    simulateStopLossFill,
    simulateTakeProfitFill,
    calculatePositionSize,
    calculateLiquidationPrice,
    calculateUnrealizedPnl,
    calculateEntryFees,
    calculateExitFees,
    checkStopLossHit,
    checkTakeProfitHit,
    checkLiquidation,
    calculateTrailingStop,
} from './paperOrderManager';
import { saveState, loadState, saveConfig, loadConfig } from './paperDataService';

// ──────────── ID Generator ────────────

const generateId = (): string => {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return `pt_${ts}_${rand}`;
};

// ──────────── Signal Input ────────────

export interface PaperSignalInput {
    symbol: string;
    direction: 'long' | 'short';
    currentPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2?: number;
    takeProfit3?: number;
    leverage?: number;
    signalScore: number;
    signalConfidence: number;
    mlProbability: number;
    signalIndicators: string[];
}

// ──────────── Engine ────────────

export class PaperTradingEngine {
    private state: PaperPortfolioState;

    constructor() {
        const saved = loadState();
        if (saved) {
            this.state = saved;
        } else {
            const config = loadConfig();
            this.state = this.createInitialState(config);
        }
    }

    // ── State Access ──

    getState(): PaperPortfolioState {
        return { ...this.state };
    }

    getConfig(): PaperTradingConfig {
        return { ...this.state.config };
    }

    getMode(): PaperTradingMode {
        return this.state.mode;
    }

    // ── Mode Toggle ──

    setMode(mode: PaperTradingMode): void {
        this.state.mode = mode;
        this.persist();
    }

    // ── Update Config ──

    updateConfig(config: Partial<PaperTradingConfig>): void {
        this.state.config = { ...this.state.config, ...config };
        saveConfig(this.state.config);
        this.persist();
    }

    // ── Open Position ──

    openPosition(signal: PaperSignalInput): PaperPosition | null {
        const config = this.state.config;
        const openCount = this.state.positions.length;

        // Validate max simultaneous positions
        if (openCount >= config.autoTrade.maxSimultaneousPositions) {
            console.warn('[PaperEngine] Max simultaneous positions reached');
            return null;
        }

        // Calculate position size
        const leverage = signal.leverage || 5;
        const { quantity, marginRequired } = calculatePositionSize(
            this.state.balance,
            config.autoTrade.maxCapitalPerTrade,
            signal.currentPrice,
            leverage,
        );

        // Validate balance
        if (marginRequired > this.state.balance || marginRequired <= 0) {
            console.warn('[PaperEngine] Insufficient balance');
            return null;
        }

        // Simulate entry with spread/slippage
        const entryPrice = simulateMarketEntry(
            signal.currentPrice,
            signal.direction,
            config.execution,
        );

        // Entry fees
        const notionalValue = quantity * entryPrice;
        const entryFees = calculateEntryFees(notionalValue, config.execution);

        // Liquidation price
        const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, signal.direction);

        const position: PaperPosition = {
            id: generateId(),
            symbol: signal.symbol,
            direction: signal.direction,
            status: 'open',
            entryPrice,
            entryTime: Date.now(),
            quantity,
            leverage,
            marginUsed: marginRequired,
            stopLoss: signal.stopLoss,
            takeProfit1: signal.takeProfit1,
            takeProfit2: signal.takeProfit2 || null,
            takeProfit3: signal.takeProfit3 || null,
            trailingStopActive: false,
            trailingStopDistance: 1.5, // default 1.5%
            trailingStopHighWater: entryPrice,
            tp1Hit: false,
            tp2Hit: false,
            quantityRemaining: quantity,
            currentPrice: signal.currentPrice,
            unrealizedPnl: -entryFees, // start negative (fees)
            unrealizedPnlPercent: 0,
            liquidationPrice,
            fundingAccumulated: 0,
            signalScore: signal.signalScore,
            signalConfidence: signal.signalConfidence,
            mlProbability: signal.mlProbability,
            signalIndicators: signal.signalIndicators,
        };

        // Deduct margin + fees from balance
        this.state.balance -= (marginRequired + entryFees);
        this.state.marginInUse += marginRequired;
        this.state.positions.push(position);
        this.updateEquity();
        this.persist();

        return position;
    }

    // ── Close Position ──

    closePosition(
        positionId: string,
        reason: PaperPosition['exitReason'],
        exitPrice: number,
    ): PaperOrder | null {
        const idx = this.state.positions.findIndex(p => p.id === positionId);
        if (idx === -1) return null;

        const position = this.state.positions[idx];
        const config = this.state.config;

        // Apply exit slippage for SL, clean fill for TP
        let fillPrice = exitPrice;
        if (reason === 'sl' || reason === 'trailing_sl') {
            fillPrice = simulateStopLossFill(exitPrice, position.direction, config.execution.slippage);
        } else if (reason?.startsWith('tp')) {
            fillPrice = simulateTakeProfitFill(exitPrice);
        }

        // Calculate PnL
        const { pnl: grossPnl } = calculateUnrealizedPnl(
            position.entryPrice,
            fillPrice,
            position.quantityRemaining,
            position.direction,
        );

        const notionalValue = position.quantityRemaining * fillPrice;
        const exitFees = calculateExitFees(notionalValue, config.execution);
        const netPnl = grossPnl - exitFees - position.fundingAccumulated;
        const pnlPercent = (netPnl / position.marginUsed) * 100;

        const order: PaperOrder = {
            id: position.id,
            symbol: position.symbol,
            direction: position.direction,
            entryPrice: position.entryPrice,
            exitPrice: fillPrice,
            entryTime: position.entryTime,
            exitTime: Date.now(),
            quantity: position.quantity,
            leverage: position.leverage,
            marginUsed: position.marginUsed,
            grossPnl,
            fees: exitFees + calculateEntryFees(position.quantity * position.entryPrice, config.execution),
            fundingPaid: position.fundingAccumulated,
            netPnl,
            pnlPercent,
            exitReason: reason || 'manual',
            duration: Date.now() - position.entryTime,
            signalScore: position.signalScore,
            signalConfidence: position.signalConfidence,
            mlProbability: position.mlProbability,
            signalIndicators: position.signalIndicators,
        };

        // Return margin + PnL to balance
        this.state.balance += position.marginUsed + netPnl;
        this.state.marginInUse -= position.marginUsed;

        // Remove from positions, add to history
        this.state.positions.splice(idx, 1);
        this.state.history.push(order);

        // Update equity curve
        this.addEquityPoint();
        this.updateEquity();
        this.persist();

        return order;
    }

    // ── Tick Update (price monitoring) ──

    tickUpdate(prices: Record<string, number>): PaperOrder[] {
        const closedOrders: PaperOrder[] = [];

        // Iterate backwards so splicing is safe
        for (let i = this.state.positions.length - 1; i >= 0; i--) {
            const pos = this.state.positions[i];
            const currentPrice = prices[pos.symbol];
            if (currentPrice == null) continue;

            // Update current price & PnL
            pos.currentPrice = currentPrice;
            const { pnl, pnlPercent } = calculateUnrealizedPnl(
                pos.entryPrice,
                currentPrice,
                pos.quantityRemaining,
                pos.direction,
            );
            pos.unrealizedPnl = pnl - pos.fundingAccumulated;
            pos.unrealizedPnlPercent = pnlPercent;

            // Update trailing stop high-water mark
            if (pos.trailingStopActive) {
                if (pos.direction === 'long' && currentPrice > pos.trailingStopHighWater) {
                    pos.trailingStopHighWater = currentPrice;
                } else if (pos.direction === 'short' && currentPrice < pos.trailingStopHighWater) {
                    pos.trailingStopHighWater = currentPrice;
                }
                // Update SL to trailing level
                const trailingSL = calculateTrailingStop(pos.direction, pos.trailingStopHighWater, pos.trailingStopDistance);
                if (pos.direction === 'long' && trailingSL > pos.stopLoss) {
                    pos.stopLoss = trailingSL;
                } else if (pos.direction === 'short' && trailingSL < pos.stopLoss) {
                    pos.stopLoss = trailingSL;
                }
            }

            // Check liquidation
            if (checkLiquidation(currentPrice, pos.liquidationPrice, pos.direction)) {
                const order = this.closePosition(pos.id, 'liquidation', pos.liquidationPrice);
                if (order) closedOrders.push(order);
                continue;
            }

            // Check stop loss
            if (checkStopLossHit(currentPrice, pos.stopLoss, pos.direction)) {
                const reason = pos.trailingStopActive ? 'trailing_sl' : 'sl';
                const order = this.closePosition(pos.id, reason, pos.stopLoss);
                if (order) closedOrders.push(order);
                continue;
            }

            // Check TP3 first (full close)
            if (pos.takeProfit3 && !pos.tp2Hit && checkTakeProfitHit(currentPrice, pos.takeProfit3, pos.direction)) {
                const order = this.closePosition(pos.id, 'tp3', pos.takeProfit3);
                if (order) closedOrders.push(order);
                continue;
            }

            // Check TP2 (partial or full)
            if (pos.takeProfit2 && !pos.tp2Hit && checkTakeProfitHit(currentPrice, pos.takeProfit2, pos.direction)) {
                if (pos.takeProfit3) {
                    // Partial close 30%, activate trailing
                    pos.tp2Hit = true;
                    pos.quantityRemaining *= 0.7;
                    pos.trailingStopActive = true;
                } else {
                    const order = this.closePosition(pos.id, 'tp2', pos.takeProfit2);
                    if (order) closedOrders.push(order);
                    continue;
                }
            }

            // Check TP1 (partial or full)
            if (!pos.tp1Hit && checkTakeProfitHit(currentPrice, pos.takeProfit1, pos.direction)) {
                if (pos.takeProfit2) {
                    // Partial close 30%
                    pos.tp1Hit = true;
                    pos.quantityRemaining *= 0.7;
                    // Move SL to breakeven
                    pos.stopLoss = pos.entryPrice;
                } else {
                    const order = this.closePosition(pos.id, 'tp1', pos.takeProfit1);
                    if (order) closedOrders.push(order);
                    continue;
                }
            }
        }

        this.updateEquity();
        if (closedOrders.length > 0 || this.state.positions.length > 0) {
            this.persist();
        }

        return closedOrders;
    }

    // ── Apply Funding Rate ──

    applyFunding(symbol: string, fundingRate: number): void {
        for (const pos of this.state.positions) {
            if (pos.symbol !== symbol) continue;

            const notionalValue = pos.quantityRemaining * pos.currentPrice;
            // Positive funding: longs pay shorts; Negative: shorts pay longs
            const fundingAmount = pos.direction === 'long'
                ? notionalValue * (fundingRate / 100)
                : -notionalValue * (fundingRate / 100);

            pos.fundingAccumulated += fundingAmount;
            this.state.balance -= fundingAmount;
        }
        this.persist();
    }

    // ── Reset ──

    resetPortfolio(): void {
        this.state = this.createInitialState(this.state.config);
        this.persist();
    }

    // ── Auto-trade eligibility ──

    shouldAutoTrade(signalScore: number, mlProbability: number): boolean {
        const at = this.state.config.autoTrade;
        if (!at.enabled) return false;
        if (this.state.mode !== 'automatic') return false;
        if (signalScore < at.minScore) return false;
        if (mlProbability < at.minMLProbability) return false;
        if (this.state.positions.length >= at.maxSimultaneousPositions) return false;
        return true;
    }

    // ── Helpers ──

    private createInitialState(config: PaperTradingConfig): PaperPortfolioState {
        return {
            config,
            mode: 'manual',
            balance: config.initialBalance,
            equity: config.initialBalance,
            marginInUse: 0,
            positions: [],
            history: [],
            equityCurve: [{
                timestamp: Date.now(),
                equity: config.initialBalance,
                balance: config.initialBalance,
                openPositions: 0,
            }],
            lastUpdated: Date.now(),
        };
    }

    private updateEquity(): void {
        const unrealizedTotal = this.state.positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
        this.state.equity = this.state.balance + this.state.marginInUse + unrealizedTotal;
        this.state.lastUpdated = Date.now();
    }

    private addEquityPoint(): void {
        this.state.equityCurve.push({
            timestamp: Date.now(),
            equity: this.state.equity,
            balance: this.state.balance,
            openPositions: this.state.positions.length,
        });
        // Keep max 5000 points
        if (this.state.equityCurve.length > 5000) {
            this.state.equityCurve = this.state.equityCurve.filter((_, i) => i % 2 === 0);
        }
    }

    private persist(): void {
        saveState(this.state);
    }
}
