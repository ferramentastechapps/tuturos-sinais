// Telegram Notification Monitor — Real-time Market & Risk Monitoring
// Runs on intervals, checks conditions, and sends Telegram alerts automatically

import { telegramService } from './telegramService';
import { telegramConfigManager } from './telegramConfigManager';
import { riskLogger } from './riskLogger';
import { fetchFundingRate, fetchLiquidationSummary } from './binanceFutures';
import type {
    MarketAlertData,
    FundingRateAlertData,
    RiskAlertNotificationData,
    DailySummaryData,
} from '@/types/telegram';

// ──────────── Configuration ────────────

const FUNDING_RATE_THRESHOLD = 0.1;     // ±0.1% triggers alert
const PRICE_CHANGE_THRESHOLD = 5;       // ±5% in 15 min
const LIQUIDATION_THRESHOLD = 50_000_000; // $50M in 1 hour
const DRAWDOWN_WARNING = 3;             // 3% daily drawdown warning
const DRAWDOWN_CRITICAL = 5;            // 5% daily drawdown critical
const DRAWDOWN_WEEKLY = 7;              // 7% weekly drawdown
const CONSECUTIVE_STOPS_ALERT = 3;      // 3 stops in a row
const DEBOUNCE_HOURS = 1;              // 1h between same-type alerts

// Monitoring intervals (ms)
const FUNDING_CHECK_INTERVAL = 5 * 60 * 1000;    // 5 min
const MARKET_CHECK_INTERVAL = 60 * 1000;          // 1 min
const RISK_CHECK_INTERVAL = 2 * 60 * 1000;        // 2 min
const SUMMARY_CHECK_INTERVAL = 60 * 1000;         // 1 min (checks clock)

// Top coins to monitor
const MONITORED_SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
];

// ──────────── State ────────────

interface PriceSnapshot {
    price: number;
    timestamp: number;
}

interface MonitorState {
    intervals: NodeJS.Timeout[];
    fundingAlerts: Map<string, number>;         // symbol -> last alert time
    marketAlerts: Map<string, number>;          // symbol -> last alert time
    riskAlerts: Map<string, number>;            // type -> last alert time
    priceHistory: Map<string, PriceSnapshot[]>; // symbol -> last 15min snapshots
    lastDailySummary: string;                   // date string of last daily
    lastWeeklySummary: string;                  // date string of last weekly
    running: boolean;
    portfolioCapital: number;
}

const state: MonitorState = {
    intervals: [],
    fundingAlerts: new Map(),
    marketAlerts: new Map(),
    riskAlerts: new Map(),
    priceHistory: new Map(),
    lastDailySummary: '',
    lastWeeklySummary: '',
    running: false,
    portfolioCapital: 10000, // Default, updated by dashboard
};

// ──────────── Debounce Helper ────────────

const canAlert = (map: Map<string, number>, key: string): boolean => {
    const last = map.get(key) || 0;
    if (Date.now() - last < DEBOUNCE_HOURS * 60 * 60 * 1000) return false;
    map.set(key, Date.now());
    return true;
};

// ──────────── 1. FUNDING RATE MONITOR ────────────

async function checkFundingRates(): Promise<void> {
    if (!telegramConfigManager.shouldNotify('funding_rate', 100)) return;

    for (const symbol of MONITORED_SYMBOLS) {
        try {
            const data = await fetchFundingRate(symbol);
            const rate = data.fundingRatePercent;

            if (Math.abs(rate) >= FUNDING_RATE_THRESHOLD) {
                if (!canAlert(state.fundingAlerts, symbol)) continue;

                const alertData: FundingRateAlertData = {
                    symbol,
                    fundingRate: rate,
                    bias: rate > 0 ? 'long' : 'short',
                    recommendation: rate > 0
                        ? 'Funding alto = muitos longs. Possível queda. Cuidado com LONG.'
                        : 'Funding negativo = muitos shorts. Possível alta. Cuidado com SHORT.',
                };

                await telegramService.sendFundingRateAlert(alertData);
                console.log(`[MONITOR] Funding rate alert: ${symbol} ${rate.toFixed(3)}%`);
            }
        } catch (err) {
            console.error(`[MONITOR] Funding check failed for ${symbol}:`, (err as Error).message);
        }
    }
}

// ──────────── 2. PRICE FLASH MONITOR ────────────

async function checkPriceFlash(): Promise<void> {
    if (!telegramConfigManager.shouldNotify('market_alert', 100)) return;

    const now = Date.now();
    const fifteenMin = 15 * 60 * 1000;

    for (const symbol of MONITORED_SYMBOLS) {
        try {
            // Fetch current price from Binance
            const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`);
            const data = await res.json();
            const currentPrice = parseFloat(data.price);

            if (!currentPrice || isNaN(currentPrice)) continue;

            // Store price snapshot
            const history = state.priceHistory.get(symbol) || [];
            history.push({ price: currentPrice, timestamp: now });

            // Keep only last 15 minutes of data
            const cutoff = now - fifteenMin;
            const filtered = history.filter(s => s.timestamp >= cutoff);
            state.priceHistory.set(symbol, filtered);

            // Check price change vs 15 min ago
            if (filtered.length >= 2) {
                const oldestPrice = filtered[0].price;
                const changePercent = ((currentPrice - oldestPrice) / oldestPrice) * 100;

                if (Math.abs(changePercent) >= PRICE_CHANGE_THRESHOLD) {
                    if (!canAlert(state.marketAlerts, `flash_${symbol}`)) continue;

                    const alertData: MarketAlertData = {
                        symbol,
                        description: changePercent > 0
                            ? `📈 Pump detectado! Alta de ${changePercent.toFixed(1)}%`
                            : `📉 Crash detectado! Queda de ${Math.abs(changePercent).toFixed(1)}%`,
                        changePercent,
                        period: '15 minutos',
                        recommendation: changePercent > 0
                            ? 'Movimento rápido de alta. Aguarde confirmação antes de entrar.'
                            : 'Movimento rápido de queda. Verifique stops e reduza exposição.',
                    };

                    await telegramService.sendMarketAlert(alertData);
                    console.log(`[MONITOR] Flash alert: ${symbol} ${changePercent.toFixed(1)}% in 15min`);
                }
            }
        } catch (err) {
            console.error(`[MONITOR] Price check failed for ${symbol}:`, (err as Error).message);
        }
    }
}

// ──────────── 3. LIQUIDATION MONITOR ────────────

async function checkLiquidations(): Promise<void> {
    if (!telegramConfigManager.shouldNotify('market_alert', 100)) return;

    try {
        // Check BTC liquidations as market proxy
        const liqData = await fetchLiquidationSummary('BTCUSDT');
        const totalLiq = liqData.totalValue24h;
        const hourlyEstimate = totalLiq / 24; // Rough hourly estimate

        if (hourlyEstimate >= LIQUIDATION_THRESHOLD) {
            if (!canAlert(state.marketAlerts, 'liquidation_btc')) return;

            const alertData: MarketAlertData = {
                symbol: 'MERCADO',
                description: `💧 Liquidações massivas detectadas`,
                changePercent: 0,
                period: '1 hora (estimativa)',
                liquidations: hourlyEstimate,
                recommendation: liqData.dominantSide === 'longs'
                    ? 'Longs sendo liquidados. Bearish. Cuidado com posições compradas.'
                    : 'Shorts sendo liquidados. Bullish. Shorts podem ser comprimidos.',
            };

            await telegramService.sendMarketAlert(alertData);
            console.log(`[MONITOR] Liquidation alert: ~$${(hourlyEstimate / 1e6).toFixed(0)}M/h`);
        }
    } catch (err) {
        console.error('[MONITOR] Liquidation check failed:', (err as Error).message);
    }
}

// ──────────── 4. RISK MONITOR ────────────

function checkRiskMetrics(): void {
    if (!telegramConfigManager.shouldNotify('risk_alert', 100)) return;

    const cap = state.portfolioCapital;
    if (cap <= 0) return;

    // a) Daily drawdown
    const dailyDD = riskLogger.getDailyDrawdown(cap);

    if (dailyDD >= DRAWDOWN_CRITICAL) {
        if (canAlert(state.riskAlerts, 'daily_dd_critical')) {
            const alertData: RiskAlertNotificationData = {
                alertType: 'Drawdown Diário CRÍTICO',
                currentValue: dailyDD,
                limit: DRAWDOWN_CRITICAL,
                recommendation: `🔴 PARAR DE OPERAR. Drawdown de ${dailyDD.toFixed(1)}% excede o limite crítico de ${DRAWDOWN_CRITICAL}%.`,
                timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
            };
            telegramService.sendRiskAlert(alertData);
            console.log(`[MONITOR] CRITICAL daily drawdown: ${dailyDD.toFixed(1)}%`);
        }
    } else if (dailyDD >= DRAWDOWN_WARNING) {
        if (canAlert(state.riskAlerts, 'daily_dd_warning')) {
            const alertData: RiskAlertNotificationData = {
                alertType: 'Drawdown Diário Aviso',
                currentValue: dailyDD,
                limit: DRAWDOWN_WARNING,
                recommendation: `⚠️ Reduzir tamanho das posições. Drawdown de ${dailyDD.toFixed(1)}%.`,
                timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
            };
            telegramService.sendRiskAlert(alertData);
            console.log(`[MONITOR] WARNING daily drawdown: ${dailyDD.toFixed(1)}%`);
        }
    }

    // b) Weekly drawdown
    const weeklyDD = riskLogger.getWeeklyDrawdown(cap);
    if (weeklyDD >= DRAWDOWN_WEEKLY) {
        if (canAlert(state.riskAlerts, 'weekly_dd')) {
            const alertData: RiskAlertNotificationData = {
                alertType: 'Drawdown Semanal',
                currentValue: weeklyDD,
                limit: DRAWDOWN_WEEKLY,
                recommendation: `🔴 Drawdown semanal de ${weeklyDD.toFixed(1)}%. Pausar operações e reavaliar estratégia.`,
                timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
            };
            telegramService.sendRiskAlert(alertData);
            console.log(`[MONITOR] Weekly drawdown: ${weeklyDD.toFixed(1)}%`);
        }
    }

    // c) Consecutive stops
    const consecutiveLosses = riskLogger.getConsecutiveLosses();
    if (consecutiveLosses >= CONSECUTIVE_STOPS_ALERT) {
        if (canAlert(state.riskAlerts, 'consecutive_stops')) {
            const alertData: RiskAlertNotificationData = {
                alertType: 'Stops Consecutivos',
                currentValue: consecutiveLosses,
                limit: CONSECUTIVE_STOPS_ALERT,
                recommendation: `🛑 ${consecutiveLosses} stops consecutivos. Pausar e revisar confluências dos sinais.`,
                timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
            };
            telegramService.sendRiskAlert(alertData);
            console.log(`[MONITOR] ${consecutiveLosses} consecutive stops`);
        }
    }
}

// ──────────── 5. SCHEDULED SUMMARIES ────────────

function checkScheduledSummaries(): void {
    if (!telegramConfigManager.shouldNotify('daily_summary', 100)) return;

    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const utcDay = now.getUTCDay(); // 0=Sun, 1=Mon
    const todayStr = now.toISOString().split('T')[0];

    // Daily summary at 23:00 UTC
    if (utcHour === 23 && utcMinute < 2 && state.lastDailySummary !== todayStr) {
        state.lastDailySummary = todayStr;
        sendDailySummary(todayStr);
    }

    // Weekly summary on Monday at 08:00 UTC
    const weekStr = `week_${todayStr}`;
    if (utcDay === 1 && utcHour === 8 && utcMinute < 2 && state.lastWeeklySummary !== weekStr) {
        state.lastWeeklySummary = weekStr;
        sendWeeklySummary();
    }
}

async function sendDailySummary(date: string): Promise<void> {
    try {
        const report = riskLogger.generateDailyReport(date);
        const todayLogs = riskLogger.getTodayLogs();
        const alerts = todayLogs
            .filter(l => l.type === 'alert' || l.type === 'block')
            .map(l => l.message)
            .slice(0, 5);

        const summaryData: DailySummaryData = {
            date,
            signalsGenerated: report.totalTrades,
            winners: report.winningTrades,
            losers: report.losingTrades,
            pnlPercent: report.totalRiskUsed > 0
                ? (report.winningTrades > report.losingTrades ? report.totalRiskUsed / 100 : -report.dailyDrawdown)
                : 0,
            topSignals: report.topTradedAssets.slice(0, 5).map(a => ({
                symbol: a.symbol,
                type: 'long' as const,
                score: Math.round(a.pnl > 0 ? 80 : 50),
            })),
            alerts,
        };

        await telegramService.sendDailySummary(summaryData);
        console.log(`[MONITOR] Daily summary sent for ${date}`);
    } catch (err) {
        console.error('[MONITOR] Daily summary failed:', (err as Error).message);
    }
}

async function sendWeeklySummary(): Promise<void> {
    try {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const weekLogs = riskLogger.getLogs({
            type: 'trade',
            since: weekAgo.getTime(),
        });

        const wins = weekLogs.filter(l => l.details?.result === 'win').length;
        const losses = weekLogs.filter(l => l.details?.result === 'loss').length;
        const total = wins + losses;
        const winRate = total > 0 ? (wins / total * 100) : 0;

        const text = [
            '📊 <b>RESUMO SEMANAL</b>',
            '━━━━━━━━━━━━━━━━━━━━',
            '',
            `📅 Período: ${weekAgo.toISOString().split('T')[0]} — ${now.toISOString().split('T')[0]}`,
            `📈 Total operações: <b>${total}</b>`,
            `✅ Vencedores: <b>${wins}</b>`,
            `❌ Perdedores: <b>${losses}</b>`,
            `📊 Win Rate: <b>${winRate.toFixed(1)}%</b>`,
            '',
            `📉 Drawdown semanal: <b>${riskLogger.getWeeklyDrawdown(state.portfolioCapital).toFixed(1)}%</b>`,
            `⚠️ Alertas: <b>${riskLogger.getLogs({ type: 'alert', since: weekAgo.getTime() }).length}</b>`,
            '',
            `🕐 <i>${now.toISOString().replace('T', ' ').slice(0, 19)} UTC</i>`,
        ].join('\n');

        // Send directly via first configured destination
        const config = telegramConfigManager.getConfig();
        if (config.destinations.length > 0) {
            await telegramService.sendToDestinations(text, 'daily_summary', 100);
        }
        console.log('[MONITOR] Weekly summary sent');
    } catch (err) {
        console.error('[MONITOR] Weekly summary failed:', (err as Error).message);
    }
}

// ──────────── Monitor Control ────────────

export function startTelegramMonitor(portfolioCapital?: number): void {
    if (state.running) {
        console.log('[MONITOR] Already running');
        return;
    }

    if (portfolioCapital) {
        state.portfolioCapital = portfolioCapital;
    }

    if (!telegramService.hasToken()) {
        console.log('[MONITOR] No token configured. Monitor not started.');
        return;
    }

    state.running = true;

    // Start all monitoring intervals
    state.intervals.push(
        setInterval(checkFundingRates, FUNDING_CHECK_INTERVAL),
        setInterval(checkPriceFlash, MARKET_CHECK_INTERVAL),
        setInterval(checkLiquidations, FUNDING_CHECK_INTERVAL),
        setInterval(checkRiskMetrics, RISK_CHECK_INTERVAL),
        setInterval(checkScheduledSummaries, SUMMARY_CHECK_INTERVAL),
    );

    console.log('[MONITOR] Telegram notification monitor started');
    console.log(`[MONITOR] Monitoring ${MONITORED_SYMBOLS.length} symbols`);
    console.log(`[MONITOR] Portfolio capital: $${state.portfolioCapital}`);
}

export function stopTelegramMonitor(): void {
    state.intervals.forEach(clearInterval);
    state.intervals = [];
    state.running = false;
    console.log('[MONITOR] Telegram notification monitor stopped');
}

export function updatePortfolioCapital(capital: number): void {
    state.portfolioCapital = capital;
}

export function isMonitorRunning(): boolean {
    return state.running;
}

// Export for manual triggering
export { checkFundingRates, checkPriceFlash, checkLiquidations, checkRiskMetrics };
export { sendDailySummary, sendWeeklySummary };
