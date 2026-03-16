// Exchange Service — Live order execution with risk gates via Bybit API v5
// IMPORTANT: This operates on REAL funds. Treat every change here with utmost care.

import { RestClientV5 } from 'bybit-api';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

// ──────────── Types ────────────

export interface OrderRequest {
    symbol: string;
    direction: 'long' | 'short';
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2?: number;
    leverage: number;
    riskPercent: number;      // % of balance to risk (e.g. 2)
    signalScore: number;
}

export interface OrderResult {
    success: boolean;
    orderId?: string;
    filledPrice?: number;
    qty?: string;
    error?: string;
}

export interface LivePosition {
    symbol: string;
    direction: 'long' | 'short';
    entryPrice: number;
    qty: string;
    unrealisedPnl: number;
    percentage: number;
    stopLoss?: number;
    takeProfit?: number;
    createdAt: string;
}

export interface AccountSummary {
    totalBalance: number;
    availableBalance: number;
    totalUnrealisedPnl: number;
    marginUsed: number;
    marginRatio: number;
}

// ──────────── Risk Limits ────────────

const MAX_RISK_PERCENT = 5;         // Max single-trade risk %
const MAX_POSITIONS = 5;            // Max simultaneous live positions
const MAX_LEVERAGE = 20;            // Hard cap on leverage
const MAX_DAILY_LOSS_PERCENT = 10;  // Drawdown kill switch

// ──────────── Service ────────────

class ExchangeService {
    private client: RestClientV5;
    private isEnabled: boolean;

    constructor() {
        this.isEnabled = !!(config.bybit.apiKey && config.bybit.apiSecret);
        this.client = new RestClientV5({
            key: config.bybit.apiKey || undefined,
            secret: config.bybit.apiSecret || undefined,
            testnet: config.bybit.testnet,
        });

        if (this.isEnabled) {
            const mode = config.bybit.testnet ? 'TESTNET' : 'LIVE';
            logger.info(`ExchangeService initialized (${mode})`);
        } else {
            logger.warn('ExchangeService: No API keys configured. Live trading disabled.');
        }
    }

    // ──── Risk Validation ────

    private validateRisk(req: OrderRequest): void | never {
        if (req.riskPercent > MAX_RISK_PERCENT) {
            throw new Error(`Risk ${req.riskPercent}% exceeds max allowed ${MAX_RISK_PERCENT}%`);
        }
        if (req.leverage > MAX_LEVERAGE) {
            throw new Error(`Leverage ${req.leverage}x exceeds max allowed ${MAX_LEVERAGE}x`);
        }
        if (req.signalScore < 65) {
            throw new Error(`Signal score ${req.signalScore} is too low (min: 65)`);
        }
    }

    // ──── Account Info ────

    async getAccountSummary(): Promise<AccountSummary> {
        if (!this.isEnabled) {
            throw new Error('Live trading is not configured. Set BYBIT_API_KEY/SECRET in .env');
        }

        const res = await this.client.getWalletBalance({
            accountType: 'UNIFIED',
        });

        if (res.retCode !== 0) {
            throw new Error(`Bybit error: ${res.retMsg}`);
        }

        const acct = res.result?.list?.[0];
        const totalBalance = parseFloat(acct?.totalEquity || '0');
        const availableBalance = parseFloat(acct?.totalAvailableBalance || '0');
        const totalUnrealisedPnl = parseFloat(acct?.totalPerpUPL || '0');
        const marginUsed = totalBalance - availableBalance;
        const marginRatio = totalBalance > 0 ? (marginUsed / totalBalance) * 100 : 0;

        return { totalBalance, availableBalance, totalUnrealisedPnl, marginUsed, marginRatio };
    }

    // ──── Live Positions ────

    async getLivePositions(): Promise<LivePosition[]> {
        if (!this.isEnabled) return [];

        const res = await this.client.getPositionInfo({
            category: 'linear',
            settleCoin: 'USDT',
        });

        if (res.retCode !== 0) {
            throw new Error(`Bybit error: ${res.retMsg}`);
        }

        return (res.result?.list || [])
            .filter((p: any) => parseFloat(p.size) > 0)
            .map((p: any) => ({
                symbol: p.symbol,
                direction: p.side === 'Buy' ? 'long' : 'short',
                entryPrice: parseFloat(p.avgPrice),
                qty: p.size,
                unrealisedPnl: parseFloat(p.unrealisedPnl),
                percentage: parseFloat(p.unrealisedPnl) / parseFloat(p.positionValue || '1') * 100,
                stopLoss: parseFloat(p.stopLoss) || undefined,
                takeProfit: parseFloat(p.takeProfit) || undefined,
                createdAt: p.createdTime || new Date().toISOString(),
            }));
    }

    // ──── Order Execution ────

    async placeMarketOrder(req: OrderRequest): Promise<OrderResult> {
        if (!this.isEnabled) {
            return { success: false, error: 'Live trading not configured' };
        }

        try {
            // 1. Risk validation
            this.validateRisk(req);

            // 2. Check daily drawdown
            const summary = await this.getAccountSummary();
            const dailyLossPct = (summary.totalUnrealisedPnl / summary.totalBalance) * 100;
            if (dailyLossPct < -MAX_DAILY_LOSS_PERCENT) {
                throw new Error(`Daily loss limit reached (${dailyLossPct.toFixed(1)}%). Trading halted.`);
            }

            // 3. Check position count
            const positions = await this.getLivePositions();
            const existingPos = positions.find(p => p.symbol === req.symbol);
            if (existingPos) {
                throw new Error(`Already have an open position for ${req.symbol}`);
            }
            if (positions.length >= MAX_POSITIONS) {
                throw new Error(`Max positions limit reached (${MAX_POSITIONS})`);
            }

            // 4. Calculate position size from risk %
            const riskAmount = summary.totalBalance * (req.riskPercent / 100);
            const priceDiff = Math.abs(req.entryPrice - req.stopLoss);
            const riskPerUnit = priceDiff;
            const contractQty = riskAmount / riskPerUnit;
            const roundedQty = Math.floor(contractQty * 1000) / 1000;   // 3 decimal places

            if (roundedQty <= 0) {
                throw new Error('Calculated quantity is too small');
            }

            // 5. Set leverage
            await this.client.setLeverage({
                category: 'linear',
                symbol: req.symbol,
                buyLeverage: String(req.leverage),
                sellLeverage: String(req.leverage),
            }).catch(() => {
                // Leverage may already be set — ignore errors
            });

            // 6. Place Market Order
            const side = req.direction === 'long' ? 'Buy' : 'Sell';
            const orderRes = await this.client.submitOrder({
                category: 'linear',
                symbol: req.symbol,
                side,
                orderType: 'Market',
                qty: String(roundedQty),
                stopLoss: String(req.stopLoss),
                takeProfit: String(req.takeProfit1),
                slTriggerBy: 'LastPrice',
                tpTriggerBy: 'LastPrice',
                timeInForce: 'GTC',
                reduceOnly: false,
            });

            if (orderRes.retCode !== 0) {
                throw new Error(`Bybit order error: ${orderRes.retMsg}`);
            }

            logger.info('Live order placed', {
                symbol: req.symbol,
                direction: req.direction,
                qty: roundedQty,
                orderId: orderRes.result?.orderId,
            });

            return {
                success: true,
                orderId: orderRes.result?.orderId,
                qty: String(roundedQty),
            };
        } catch (error: any) {
            logger.error('Failed to place live order', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ──── Cancel / Close ────

    async closePosition(symbol: string): Promise<OrderResult> {
        if (!this.isEnabled) {
            return { success: false, error: 'Live trading not configured' };
        }

        try {
            const positions = await this.getLivePositions();
            const pos = positions.find(p => p.symbol === symbol);
            if (!pos) {
                return { success: false, error: 'No open position found for ' + symbol };
            }

            const side = pos.direction === 'long' ? 'Sell' : 'Buy';
            const closeRes = await this.client.submitOrder({
                category: 'linear',
                symbol,
                side,
                orderType: 'Market',
                qty: pos.qty,
                reduceOnly: true,
                timeInForce: 'GTC',
            });

            if (closeRes.retCode !== 0) {
                throw new Error(`Bybit close error: ${closeRes.retMsg}`);
            }

            logger.info('Live position closed', { symbol, orderId: closeRes.result?.orderId });
            return { success: true, orderId: closeRes.result?.orderId };
        } catch (error: any) {
            logger.error('Failed to close position', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    // ──── Status ────

    isConfigured(): boolean {
        return this.isEnabled;
    }

    isTestnet(): boolean {
        return config.bybit.testnet;
    }
}

export const exchangeService = new ExchangeService();
