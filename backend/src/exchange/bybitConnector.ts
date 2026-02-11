// Bybit Connector — WebSocket + REST client for market data
// Replaces the frontend's Binance-based data fetching

import { WebsocketClient, RestClientV5 } from 'bybit-api';
import { EventEmitter } from 'events';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import type { CryptoPair, OHLCPoint } from '../types/trading.js';

// ──────────── Types ────────────

export interface BybitTicker {
    symbol: string;
    lastPrice: number;
    prevPrice24h: number;
    price24hPcnt: number;
    highPrice24h: number;
    lowPrice24h: number;
    volume24h: number;
    turnover24h: number;
    fundingRate: string;
    nextFundingTime: string;
    openInterest: string;
    openInterestValue: string;
}

export interface FundingRateData {
    symbol: string;
    fundingRate: number;
    fundingRatePercent: number;
    nextFundingTime: number;
    isExtreme: boolean;
    direction: 'bullish' | 'bearish' | 'neutral';
}

export interface OpenInterestData {
    symbol: string;
    openInterest: number;
    openInterestValue: number;
}

export interface FuturesOverview {
    fundingRate: FundingRateData;
    openInterest: OpenInterestData;
}

// ──────────── Events ────────────

export interface BybitEvents {
    'price:update': (data: Map<string, BybitTicker>) => void;
    'kline:update': (symbol: string, data: OHLCPoint[]) => void;
    'connected': () => void;
    'disconnected': () => void;
    'reconnecting': () => void;
    'error': (error: Error) => void;
}

// ──────────── Connector ────────────

class BybitConnector extends EventEmitter {
    private wsClient: WebsocketClient | null = null;
    private restClient: RestClientV5;
    private tickers: Map<string, BybitTicker> = new Map();
    private klineData: Map<string, OHLCPoint[]> = new Map();
    private connected = false;
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 50;

    constructor() {
        super();
        this.restClient = new RestClientV5({
            key: config.bybit.apiKey || undefined,
            secret: config.bybit.apiSecret || undefined,
            testnet: config.bybit.testnet,
        });
    }

    // ──── WebSocket Connection ────

    async connect(symbols: string[]): Promise<void> {
        logger.info('Connecting to Bybit WebSocket...', { symbols: symbols.length });

        try {
            this.wsClient = new WebsocketClient({
                market: 'v5',
                key: config.bybit.apiKey || undefined,
                secret: config.bybit.apiSecret || undefined,
                testnet: config.bybit.testnet,
            });

            // Connection events
            this.wsClient.on('open', () => {
                this.connected = true;
                this.reconnectAttempts = 0;
                logger.info('Bybit WebSocket connected');
                this.emit('connected');
            });

            this.wsClient.on('close', () => {
                this.connected = false;
                logger.warn('Bybit WebSocket disconnected');
                this.emit('disconnected');
            });

            this.wsClient.on('reconnect', () => {
                this.reconnectAttempts++;
                logger.info(`Bybit WebSocket reconnecting (attempt ${this.reconnectAttempts})`);
                this.emit('reconnecting');
            });

            this.wsClient.on('error', (err: Error) => {
                logger.error('Bybit WebSocket error', { error: err.message });
                this.emit('error', err);
            });

            // Market data updates
            this.wsClient.on('update', (data: any) => {
                this.handleWsUpdate(data);
            });

            // Subscribe to tickers for all symbols
            const tickerTopics = symbols.map(s => `tickers.${s}`);
            this.wsClient.subscribeV5(tickerTopics, 'linear');

            // Subscribe to 1h klines for signal generation
            const klineTopics = symbols.map(s => `kline.60.${s}`);
            this.wsClient.subscribeV5(klineTopics, 'linear');

            logger.info('Bybit WebSocket subscriptions sent', {
                tickers: tickerTopics.length,
                klines: klineTopics.length,
            });
        } catch (error) {
            logger.error('Failed to connect to Bybit WebSocket', { error });
            throw error;
        }
    }

    private handleWsUpdate(data: any): void {
        try {
            const topic = data.topic as string;

            if (topic?.startsWith('tickers.')) {
                const tickerData = data.data;
                const symbol = tickerData.symbol;
                if (symbol) {
                    this.tickers.set(symbol, {
                        symbol,
                        lastPrice: parseFloat(tickerData.lastPrice || '0'),
                        prevPrice24h: parseFloat(tickerData.prevPrice24h || '0'),
                        price24hPcnt: parseFloat(tickerData.price24hPcnt || '0'),
                        highPrice24h: parseFloat(tickerData.highPrice24h || '0'),
                        lowPrice24h: parseFloat(tickerData.lowPrice24h || '0'),
                        volume24h: parseFloat(tickerData.volume24h || '0'),
                        turnover24h: parseFloat(tickerData.turnover24h || '0'),
                        fundingRate: tickerData.fundingRate || '0',
                        nextFundingTime: tickerData.nextFundingTime || '0',
                        openInterest: tickerData.openInterest || '0',
                        openInterestValue: tickerData.openInterestValue || '0',
                    });
                    this.emit('price:update', this.tickers);
                }
            }

            if (topic?.startsWith('kline.')) {
                const klineArr = Array.isArray(data.data) ? data.data : [data.data];
                for (const kline of klineArr) {
                    const symbol = kline.symbol || topic.split('.')[2];
                    const point: OHLCPoint = {
                        timestamp: parseInt(kline.start || kline.timestamp, 10),
                        open: parseFloat(kline.open),
                        high: parseFloat(kline.high),
                        low: parseFloat(kline.low),
                        close: parseFloat(kline.close),
                        volume: parseFloat(kline.volume),
                    };
                    const existing = this.klineData.get(symbol) || [];
                    // Update last candle or append
                    if (existing.length > 0 && existing[existing.length - 1].timestamp === point.timestamp) {
                        existing[existing.length - 1] = point;
                    } else {
                        existing.push(point);
                        if (existing.length > 500) existing.shift();
                    }
                    this.klineData.set(symbol, existing);
                    this.emit('kline:update', symbol, existing);
                }
            }
        } catch (error) {
            logger.error('Error handling WebSocket update', { error });
        }
    }

    // ──── REST API Methods ────

    async fetchKlines(symbol: string, interval: string = '60', limit: number = 200): Promise<OHLCPoint[]> {
        try {
            const response = await this.restClient.getKline({
                category: 'linear',
                symbol,
                interval: interval as any,
                limit,
            });

            if (response.retCode !== 0) {
                throw new Error(`Bybit API error: ${response.retMsg}`);
            }

            return (response.result.list || [])
                .map((k: any) => ({
                    timestamp: parseInt(k[0], 10),
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5]),
                }))
                .reverse(); // Bybit returns newest first
        } catch (error) {
            logger.error(`Failed to fetch klines for ${symbol}`, { error });
            return [];
        }
    }

    async fetchTickers(): Promise<CryptoPair[]> {
        try {
            const response = await this.restClient.getTickers({ category: 'linear' });

            if (response.retCode !== 0) {
                throw new Error(`Bybit API error: ${response.retMsg}`);
            }

            const tickers = response.result.list || [];
            const usdtPairs = tickers
                .filter((t: any) => t.symbol.endsWith('USDT'))
                .map((t: any) => ({
                    symbol: t.symbol,
                    name: t.symbol.replace('USDT', ''),
                    price: parseFloat(t.lastPrice || '0'),
                    change24h: parseFloat(t.price24hPcnt || '0') * 100,
                    volume24h: parseFloat(t.turnover24h || '0'),
                    high24h: parseFloat(t.highPrice24h || '0'),
                    low24h: parseFloat(t.lowPrice24h || '0'),
                    hasFutures: true,
                }));

            return usdtPairs;
        } catch (error) {
            logger.error('Failed to fetch tickers', { error });
            return [];
        }
    }

    async fetchFundingRate(symbol: string): Promise<FundingRateData> {
        try {
            const response = await this.restClient.getTickers({
                category: 'linear',
                symbol,
            });

            const ticker = response.result?.list?.[0];
            const rate = parseFloat(ticker?.fundingRate || '0');
            const ratePercent = rate * 100;

            return {
                symbol,
                fundingRate: rate,
                fundingRatePercent: ratePercent,
                nextFundingTime: parseInt(ticker?.nextFundingTime || '0', 10),
                isExtreme: Math.abs(ratePercent) > 0.05,
                direction: ratePercent > 0.01 ? 'bearish' : ratePercent < -0.01 ? 'bullish' : 'neutral',
            };
        } catch (error) {
            logger.error(`Failed to fetch funding rate for ${symbol}`, { error });
            return {
                symbol,
                fundingRate: 0,
                fundingRatePercent: 0,
                nextFundingTime: 0,
                isExtreme: false,
                direction: 'neutral',
            };
        }
    }

    async fetchOpenInterest(symbol: string): Promise<OpenInterestData> {
        try {
            const response = await this.restClient.getOpenInterest({
                category: 'linear',
                symbol,
                intervalTime: '1h',
                limit: 1,
            });

            const data = response.result?.list?.[0];
            return {
                symbol,
                openInterest: parseFloat(data?.openInterest || '0'),
                openInterestValue: parseFloat(data?.openInterest || '0') * (this.tickers.get(symbol)?.lastPrice || 0),
            };
        } catch (error) {
            logger.error(`Failed to fetch open interest for ${symbol}`, { error });
            return { symbol, openInterest: 0, openInterestValue: 0 };
        }
    }

    async fetchFuturesOverview(symbol: string): Promise<FuturesOverview> {
        const [fundingRate, openInterest] = await Promise.all([
            this.fetchFundingRate(symbol),
            this.fetchOpenInterest(symbol),
        ]);

        return { fundingRate, openInterest };
    }

    // ──── Getters ────

    getTickers(): Map<string, BybitTicker> {
        return new Map(this.tickers);
    }

    getTicker(symbol: string): BybitTicker | undefined {
        return this.tickers.get(symbol);
    }

    getPrice(symbol: string): number {
        return this.tickers.get(symbol)?.lastPrice || 0;
    }

    getAllPrices(): Record<string, number> {
        const prices: Record<string, number> = {};
        for (const [symbol, ticker] of this.tickers) {
            prices[symbol] = ticker.lastPrice;
        }
        return prices;
    }

    getKlineData(symbol: string): OHLCPoint[] {
        return this.klineData.get(symbol) || [];
    }

    isConnected(): boolean {
        return this.connected;
    }

    // ──── Disconnect ────

    disconnect(): void {
        if (this.wsClient) {
            this.wsClient.closeAll();
            this.wsClient = null;
        }
        this.connected = false;
        logger.info('Bybit WebSocket disconnected');
    }
}

// Singleton
export const bybitConnector = new BybitConnector();
