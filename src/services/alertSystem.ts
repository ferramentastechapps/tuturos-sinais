// Alert System — Real-time Signal Monitoring and Notification
// Monitors market conditions and triggers alerts based on signal quality

import { fetchBinanceOHLC } from '@/services/binanceOHLC';
import { generateAdvancedSignal, AdvancedSignal } from '@/services/advancedSignalGenerator';
import {
    calculateRSI,
    calculateMACD,
    calculateEMA,
    calculateVWAPFromOHLC,
    TechnicalIndicator
} from '@/utils/technicalIndicators';
import { OHLCPoint } from '@/services/coingeckoOHLC';
import { telegramService } from '@/services/telegramService';
import { telegramConfigManager } from '@/services/telegramConfigManager';
import { SignalNotificationData } from '@/types/telegram';

export interface AlertConfig {
    symbol: string;
    interval: string; // '15m', '1h', '4h'
    minQuality: number;
    minConfidence: number;
    enableBrowserNotifications: boolean;
    enableSound: boolean;
}

export type AlertCallback = (signal: AdvancedSignal) => void;

class AlertSystem {
    private activeIntervals: Map<string, NodeJS.Timeout> = new Map();
    private lastAlertTime: Map<string, number> = new Map();
    private subscribers: AlertCallback[] = [];

    constructor() {
        // Request notification permission on init if in browser
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                Notification.requestPermission();
            }
        }
    }

    public subscribe(callback: AlertCallback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    public startMonitoring(config: AlertConfig) {
        const key = `${config.symbol}-${config.interval}`;

        if (this.activeIntervals.has(key)) {
            console.warn(`Already monitoring ${key}`);
            return;
        }

        console.log(`Starting monitoring for ${key}...`);

        // Initial check
        this.checkSignal(config);

        // Set interval (approx 1 minute to check for candle close or updates)
        // For production, this should be synced with candle close times
        const intervalId = setInterval(() => this.checkSignal(config), 60 * 1000);
        this.activeIntervals.set(key, intervalId);
    }

    public stopMonitoring(symbol: string, interval: string) {
        const key = `${symbol}-${interval}`;
        const intervalId = this.activeIntervals.get(key);
        if (intervalId) {
            clearInterval(intervalId);
            this.activeIntervals.delete(key);
            console.log(`Stopped monitoring for ${key}`);
        }
    }

    private async checkSignal(config: AlertConfig) {
        try {
            // 1. Fetch recent data (need enough for indicators, e.g., 200 candles)
            const data = await fetchBinanceOHLC(config.symbol, config.interval, 200);

            if (!data || data.length < 50) return;

            const currentPrice = data[data.length - 1].close;
            const recentSlice = data.slice(-24); // Last 24 candles for high/low
            const high24h = Math.max(...recentSlice.map(c => c.high));
            const low24h = Math.min(...recentSlice.map(c => c.low));
            const volume24h = recentSlice.reduce((sum, c) => sum + (c.volume || 0), 0);

            // 2. Calculate Indicators
            const pricePoints = data.map(d => ({ timestamp: d.timestamp, price: d.close }));
            const rsi = calculateRSI(pricePoints);
            const macd = calculateMACD(pricePoints);
            const ema20 = calculateEMA(pricePoints, 20);
            const ema50 = calculateEMA(pricePoints, 50);
            const ema200 = calculateEMA(pricePoints, 200);
            const vwap = calculateVWAPFromOHLC(data);

            const lastRSI = rsi[rsi.length - 1]?.value || 50;
            const lastMACD = macd[macd.length - 1];
            const lastEMA20 = ema20[ema20.length - 1]?.value || 0;
            const lastEMA50 = ema50[ema50.length - 1]?.value || 0;
            const lastEMA200 = ema200[ema200.length - 1]?.value || 0;
            const lastVWAP = vwap[vwap.length - 1]?.vwap || 0;

            const indicators: TechnicalIndicator[] = [
                { name: 'RSI', value: lastRSI, signal: 'neutral' },
                { name: 'MACD', value: lastMACD?.value || 0, signal: lastMACD?.histogram > 0 ? 'bullish' : 'bearish' },
                { name: 'EMA 20', value: lastEMA20, signal: 'neutral' },
                { name: 'EMA 50', value: lastEMA50, signal: 'neutral' },
                { name: 'EMA 200', value: lastEMA200, signal: 'neutral' },
                { name: 'VWAP', value: lastVWAP, signal: 'neutral' },
            ];

            // 3. Generate Signal
            const signal = generateAdvancedSignal({
                symbol: config.symbol,
                currentPrice,
                indicators,
                high24h,
                low24h,
                ohlcData: data,
                volume24h
            });

            if (!signal) return;

            // 4. Validate Signal
            if (signal.quality.score >= config.minQuality && signal.confidence >= config.minConfidence) {
                this.triggerAlert(signal, config);
            }

        } catch (error) {
            console.error(`Error checking signal for ${config.symbol}:`, error);
        }
    }

    private triggerAlert(signal: AdvancedSignal, config: AlertConfig) {
        const key = `${config.symbol}-${config.interval}-${signal.type}`;
        const now = Date.now();
        const lastTime = this.lastAlertTime.get(key) || 0;

        // Debounce: Alert only once per hour for same signal type
        if (now - lastTime < 60 * 60 * 1000) return;

        this.lastAlertTime.set(key, now);

        const message = `🚨 ${config.symbol} ${signal.type.toUpperCase()} Signal! Score: ${signal.quality.score}/100`;

        // Notify Subscribers
        this.subscribers.forEach(cb => cb(signal));

        // Browser Notification
        if (config.enableBrowserNotifications && typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification(message, {
                    body: `Confidence: ${signal.confidence}% | Entry: ${signal.entry}`,
                    icon: '/favicon.ico'
                });
            }
        }

        // Play Sound
        if (config.enableSound && typeof window !== 'undefined') {
            const audio = new Audio('/alert-sound.mp3');
            audio.play().catch(e => console.log('Audio play failed', e));
        }

        // Telegram Notification
        this.sendTelegramNotification(signal, config).catch(err =>
            console.error('[ALERT SYSTEM] Telegram send error:', err)
        );

        console.log(`[ALERT SYSTEM] ${message}`, signal);
    }

    private async sendTelegramNotification(signal: AdvancedSignal, config: AlertConfig): Promise<void> {
        if (!telegramConfigManager.isEnabled()) return;

        const score = signal.quality?.score ?? signal.confidence;
        const stopLossPercent = signal.entry > 0
            ? Math.abs((signal.stopLoss - signal.entry) / signal.entry * 100)
            : 0;
        const entrySpread = signal.entry * 0.005;

        const signalData: SignalNotificationData = {
            type: signal.type,
            symbol: config.symbol,
            score,
            scoreLabel: score >= 85 ? 'FORTE' : score >= 70 ? 'MODERADO' : 'FRACO',
            timeframe: signal.timeframe,
            currentPrice: signal.entry,
            entryZone: {
                min: signal.entry - entrySpread,
                max: signal.entry + entrySpread,
            },
            stopLoss: { price: signal.stopLoss, percent: stopLossPercent },
            takeProfits: [
                signal.takeProfit1 ? {
                    level: 1,
                    price: signal.takeProfit1,
                    percent: ((signal.takeProfit1 - signal.entry) / signal.entry) * 100,
                    closePercent: 35,
                } : null,
                signal.takeProfit2 ? {
                    level: 2,
                    price: signal.takeProfit2,
                    percent: ((signal.takeProfit2 - signal.entry) / signal.entry) * 100,
                    closePercent: 35,
                } : null,
                signal.takeProfit3 ? {
                    level: 3,
                    price: signal.takeProfit3,
                    percent: ((signal.takeProfit3 - signal.entry) / signal.entry) * 100,
                    closePercent: 30,
                } : null,
            ].filter(Boolean) as SignalNotificationData['takeProfits'],
            riskReward: signal.riskReward,
            confluences: signal.quality?.factors?.map(f => ({ name: f, confirmed: true })) || [],
            leverage: signal.riskData?.leverage ?? 5,
            positionSizePercent: signal.riskData?.positionSizePercent ?? 10,
            riskPercent: signal.riskData?.riskPerTradePercent ?? 1,
            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
        };

        await telegramService.sendNewSignal(signalData);
    }
}

export const alertSystem = new AlertSystem();
