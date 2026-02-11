// Paper Trading Engine — Server-side paper trading with in-memory state

import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import { telegramService } from '../notifications/telegramService.js';
import type {
    PaperPosition,
    PaperOrder,
    PaperPortfolioState,
    PaperTradingConfig,
    PaperTradingMode,
    PaperExitReason,
    PaperEquityPoint,
    PaperMetrics,
    DEFAULT_PAPER_CONFIG,
} from '../types/paperTrading.js';

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ──── Engine ────

class PaperTradingEngine {
    private state: PaperPortfolioState;

    constructor() {
        this.state = this.createInitialState({
            initialBalance: 10000,
            currency: 'USDT',
            startDate: new Date().toISOString(),
            execution: { spread: 0.02, slippage: 0.05, makerFee: 0.02, takerFee: 0.05, useMarketOrders: true },
            autoTrade: {
                enabled: config.paperTrading.autoEnabled,
                minScore: 75,
                minMLProbability: 65,
                maxSimultaneousPositions: config.paperTrading.maxPositions,
                maxCapitalPerTrade: 20,
            },
        });
    }

    getState(): PaperPortfolioState { return this.state; }
    getMode(): PaperTradingMode { return this.state.mode; }

    setMode(mode: PaperTradingMode): void {
        this.state.mode = mode;
        logger.info(`Paper trading mode set to: ${mode}`);
    }

    updateConfig(cfg: Partial<PaperTradingConfig>): void {
        this.state.config = { ...this.state.config, ...cfg };
    }

    shouldAutoTrade(signalScore: number, mlProbability: number): boolean {
        const auto = this.state.config.autoTrade;
        if (!auto.enabled || this.state.mode !== 'automatic') return false;
        const openCount = this.state.positions.filter(p => p.status === 'open').length;
        if (openCount >= auto.maxSimultaneousPositions) return false;
        return signalScore >= auto.minScore && mlProbability >= auto.minMLProbability;
    }

    // ──── Open Position ────

    openPosition(input: {
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
    }): PaperPosition | null {
        const leverage = input.leverage || 5;
        const capitalPercent = this.state.config.autoTrade.maxCapitalPerTrade;
        const capitalAlloc = this.state.balance * (capitalPercent / 100);
        const marginUsed = capitalAlloc;
        const quantity = (capitalAlloc * leverage) / input.currentPrice;

        if (marginUsed > this.state.balance) {
            logger.warn(`Not enough balance for ${input.symbol}`);
            return null;
        }

        // Apply slippage
        const slippage = this.state.config.execution.slippage / 100;
        const entryPrice = input.direction === 'long'
            ? input.currentPrice * (1 + slippage)
            : input.currentPrice * (1 - slippage);

        // Liquidation price
        const liquidationPrice = input.direction === 'long'
            ? entryPrice * (1 - 1 / leverage)
            : entryPrice * (1 + 1 / leverage);

        const position: PaperPosition = {
            id: generateId(),
            symbol: input.symbol,
            direction: input.direction,
            status: 'open',
            entryPrice,
            entryTime: Date.now(),
            quantity,
            leverage,
            marginUsed,
            stopLoss: input.stopLoss,
            takeProfit1: input.takeProfit1,
            takeProfit2: input.takeProfit2 || null,
            takeProfit3: input.takeProfit3 || null,
            trailingStopActive: false,
            trailingStopDistance: 1,
            trailingStopHighWater: entryPrice,
            tp1Hit: false,
            tp2Hit: false,
            quantityRemaining: quantity,
            currentPrice: entryPrice,
            unrealizedPnl: 0,
            unrealizedPnlPercent: 0,
            liquidationPrice,
            fundingAccumulated: 0,
            signalScore: input.signalScore,
            signalConfidence: input.signalConfidence,
            mlProbability: input.mlProbability,
            signalIndicators: input.signalIndicators,
        };

        this.state.positions.push(position);
        this.state.balance -= marginUsed;
        this.state.marginInUse += marginUsed;
        this.state.lastUpdated = Date.now();

        logger.info(`Paper position opened: ${input.direction} ${input.symbol}`, {
            entry: entryPrice,
            leverage,
            margin: marginUsed,
        });

        // Telegram notification
        if (telegramService.isEnabled) {
            telegramService.sendPaperTradeNotification({
                action: 'open',
                symbol: input.symbol,
                direction: input.direction,
                entryPrice,
                leverage,
            }).catch(() => { });
        }

        return position;
    }

    // ──── Close Position ────

    closePosition(positionId: string, reason: PaperExitReason, exitPrice: number): PaperOrder | null {
        const posIdx = this.state.positions.findIndex(p => p.id === positionId && p.status === 'open');
        if (posIdx === -1) return null;

        const pos = this.state.positions[posIdx];
        const slippage = this.state.config.execution.slippage / 100;
        const actualExit = pos.direction === 'long'
            ? exitPrice * (1 - slippage)
            : exitPrice * (1 + slippage);

        const priceDiff = pos.direction === 'long'
            ? actualExit - pos.entryPrice
            : pos.entryPrice - actualExit;

        const grossPnl = priceDiff * pos.quantityRemaining;
        const fees = (pos.entryPrice * pos.quantityRemaining * this.state.config.execution.takerFee / 100) +
            (actualExit * pos.quantityRemaining * this.state.config.execution.takerFee / 100);
        const netPnl = grossPnl - fees - pos.fundingAccumulated;
        const pnlPercent = (netPnl / pos.marginUsed) * 100;

        const order: PaperOrder = {
            id: generateId(),
            symbol: pos.symbol,
            direction: pos.direction,
            entryPrice: pos.entryPrice,
            exitPrice: actualExit,
            entryTime: pos.entryTime,
            exitTime: Date.now(),
            quantity: pos.quantityRemaining,
            leverage: pos.leverage,
            marginUsed: pos.marginUsed,
            grossPnl,
            fees,
            fundingPaid: pos.fundingAccumulated,
            netPnl,
            pnlPercent,
            exitReason: reason,
            duration: Date.now() - pos.entryTime,
            signalScore: pos.signalScore,
            signalConfidence: pos.signalConfidence,
            mlProbability: pos.mlProbability,
            signalIndicators: pos.signalIndicators,
        };

        // Update position
        pos.status = 'closed';
        pos.exitPrice = actualExit;
        pos.exitTime = Date.now();
        pos.exitReason = reason;
        pos.realizedPnl = netPnl;
        pos.realizedPnlPercent = pnlPercent;
        pos.totalFees = fees;

        // Update portfolio
        this.state.balance += pos.marginUsed + netPnl;
        this.state.marginInUse -= pos.marginUsed;
        this.state.history.unshift(order);
        this.state.lastUpdated = Date.now();

        logger.info(`Paper position closed: ${pos.symbol} (${reason})`, {
            pnl: netPnl.toFixed(2),
            pnlPercent: pnlPercent.toFixed(2),
        });

        // Telegram
        if (telegramService.isEnabled) {
            telegramService.sendPaperTradeNotification({
                action: 'close',
                symbol: pos.symbol,
                direction: pos.direction,
                entryPrice: pos.entryPrice,
                exitPrice: actualExit,
                pnl: netPnl,
                pnlPercent,
                exitReason: reason,
                leverage: pos.leverage,
            }).catch(() => { });
        }

        return order;
    }

    // ──── Tick Update ────

    tickUpdate(prices: Record<string, number>): PaperOrder[] {
        const closedOrders: PaperOrder[] = [];
        const openPositions = this.state.positions.filter(p => p.status === 'open');

        for (const pos of openPositions) {
            const price = prices[pos.symbol];
            if (!price) continue;

            pos.currentPrice = price;

            // Calculate unrealized PnL
            const priceDiff = pos.direction === 'long'
                ? price - pos.entryPrice
                : pos.entryPrice - price;
            pos.unrealizedPnl = priceDiff * pos.quantityRemaining;
            pos.unrealizedPnlPercent = (pos.unrealizedPnl / pos.marginUsed) * 100;

            // Update trailing stop high water
            if (pos.trailingStopActive) {
                if (pos.direction === 'long' && price > pos.trailingStopHighWater) {
                    pos.trailingStopHighWater = price;
                } else if (pos.direction === 'short' && price < pos.trailingStopHighWater) {
                    pos.trailingStopHighWater = price;
                }
            }

            // Check stop loss
            if ((pos.direction === 'long' && price <= pos.stopLoss) ||
                (pos.direction === 'short' && price >= pos.stopLoss)) {
                const order = this.closePosition(pos.id, 'sl', price);
                if (order) closedOrders.push(order);
                continue;
            }

            // Check liquidation
            if ((pos.direction === 'long' && price <= pos.liquidationPrice) ||
                (pos.direction === 'short' && price >= pos.liquidationPrice)) {
                const order = this.closePosition(pos.id, 'liquidation', price);
                if (order) closedOrders.push(order);
                continue;
            }

            // Check TP1
            if (!pos.tp1Hit) {
                if ((pos.direction === 'long' && price >= pos.takeProfit1) ||
                    (pos.direction === 'short' && price <= pos.takeProfit1)) {
                    pos.tp1Hit = true;
                    pos.trailingStopActive = true;
                    pos.quantityRemaining *= 0.6;
                    if (!pos.takeProfit2) {
                        const order = this.closePosition(pos.id, 'tp1', price);
                        if (order) closedOrders.push(order);
                    }
                }
            }

            // Check TP2
            if (pos.tp1Hit && !pos.tp2Hit && pos.takeProfit2) {
                if ((pos.direction === 'long' && price >= pos.takeProfit2) ||
                    (pos.direction === 'short' && price <= pos.takeProfit2)) {
                    pos.tp2Hit = true;
                    pos.quantityRemaining *= 0.5;
                    if (!pos.takeProfit3) {
                        const order = this.closePosition(pos.id, 'tp2', price);
                        if (order) closedOrders.push(order);
                    }
                }
            }

            // Check TP3
            if (pos.tp2Hit && pos.takeProfit3) {
                if ((pos.direction === 'long' && price >= pos.takeProfit3) ||
                    (pos.direction === 'short' && price <= pos.takeProfit3)) {
                    const order = this.closePosition(pos.id, 'tp3', price);
                    if (order) closedOrders.push(order);
                }
            }
        }

        // Update equity
        this.updateEquity();
        this.state.lastUpdated = Date.now();

        return closedOrders;
    }

    private updateEquity(): void {
        const unrealized = this.state.positions
            .filter(p => p.status === 'open')
            .reduce((sum, p) => sum + p.unrealizedPnl, 0);
        this.state.equity = this.state.balance + this.state.marginInUse + unrealized;
    }

    // ──── Metrics ────

    getMetrics(): PaperMetrics {
        const h = this.state.history;
        const wins = h.filter(o => o.netPnl > 0);
        const losses = h.filter(o => o.netPnl <= 0);
        const longs = h.filter(o => o.direction === 'long');
        const shorts = h.filter(o => o.direction === 'short');

        const totalPnL = h.reduce((s, o) => s + o.netPnl, 0);
        const totalGross = wins.reduce((s, o) => s + o.netPnl, 0);
        const totalLoss = Math.abs(losses.reduce((s, o) => s + o.netPnl, 0));

        return {
            totalTrades: h.length,
            winningTrades: wins.length,
            losingTrades: losses.length,
            winRate: h.length > 0 ? (wins.length / h.length) * 100 : 0,
            winRateLong: longs.length > 0 ? (longs.filter(o => o.netPnl > 0).length / longs.length) * 100 : 0,
            winRateShort: shorts.length > 0 ? (shorts.filter(o => o.netPnl > 0).length / shorts.length) * 100 : 0,
            totalPnL,
            totalPnLPercent: this.state.config.initialBalance > 0 ? (totalPnL / this.state.config.initialBalance) * 100 : 0,
            profitFactor: totalLoss > 0 ? totalGross / totalLoss : totalGross > 0 ? Infinity : 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            maxDrawdownPercent: 0,
            avgWin: wins.length > 0 ? totalGross / wins.length : 0,
            avgLoss: losses.length > 0 ? totalLoss / losses.length : 0,
            expectancy: h.length > 0 ? totalPnL / h.length : 0,
            largestWin: wins.length > 0 ? Math.max(...wins.map(o => o.netPnl)) : 0,
            largestLoss: losses.length > 0 ? Math.min(...losses.map(o => o.netPnl)) : 0,
            maxConsecutiveWins: 0,
            maxConsecutiveLosses: 0,
            totalFees: h.reduce((s, o) => s + o.fees, 0),
            totalFunding: h.reduce((s, o) => s + o.fundingPaid, 0),
            pnlToday: 0,
            pnlWeek: 0,
            pnlMonth: 0,
        };
    }

    resetPortfolio(): void {
        this.state = this.createInitialState(this.state.config);
        logger.info('Paper trading portfolio reset');
    }

    private createInitialState(cfg: PaperTradingConfig): PaperPortfolioState {
        return {
            config: cfg,
            mode: cfg.autoTrade.enabled ? 'automatic' : 'manual',
            balance: cfg.initialBalance,
            equity: cfg.initialBalance,
            marginInUse: 0,
            positions: [],
            history: [],
            equityCurve: [{ timestamp: Date.now(), equity: cfg.initialBalance, balance: cfg.initialBalance, openPositions: 0 }],
            lastUpdated: Date.now(),
        };
    }
}

export const paperTradingEngine = new PaperTradingEngine();
