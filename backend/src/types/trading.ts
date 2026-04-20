// Trading Types — Ported from frontend

export type AssetCategory =
    | 'layer1'
    | 'layer2'
    | 'defi'
    | 'exchange'
    | 'meme'
    | 'gaming'
    | 'ai'
    | 'infra'
    | 'privacy'
    | 'rwa'
    | 'trending'
    | 'other';

export interface CryptoPair {
    symbol: string;
    name: string;
    price: number;
    change24h: number;
    volume24h: number;
    high24h: number;
    low24h: number;
    isFavorite?: boolean;
    category?: AssetCategory;
    pricePrecision?: number;
    quantityPrecision?: number;
    minNotional?: number;
    hasFutures?: boolean;
}

export interface TechnicalIndicator {
    name: string;
    value: number;
    signal: 'bullish' | 'bearish' | 'neutral';
    description?: string;
}

export interface TradeSignal {
    id: string;
    pair: string;
    type: 'long' | 'short';
    entry: number;
    entry_range_low?: number;
    entry_range_high?: number;
    takeProfit: number;
    take_profits?: { level: number; price: number; percentage: number; hit: boolean }[];
    takeProfit1?: number;
    takeProfit2?: number;
    takeProfit3?: number;
    stopLoss: number;
    stop_loss?: number;
    riskReward: number;
    timeframe: string;
    status: 'PENDING' | 'ACTIVE' | 'CLOSED_TP' | 'CLOSED_SL' | 'CANCELLED' | 'BLOCKED';
    confidence: number;
    score?: number;
    metricsValues?: Record<string, number>;
    createdAt: Date;
    indicators: string[];
    quality?: {
        score: number;
        factors: string[];
    };
    smartMoney?: {
        orderBlocks: any[];
        fvgs: any[];
        liquidity: any[];
        isLiquiditySweep?: boolean;
        fvgZone?: boolean;
        isOrderBlock?: boolean;
    };
    dynamicLeverage?: number;
    positionSizePercent?: number;
    riskPercent?: number;
    tradeType?: string;
    expectedDuration?: string;
    mtfContext?: { macro: string[]; medium: string[]; micro: string[] };
    contextNarrative?: string;
    obEntryZone?: { low: number; high: number } | null;
    patterns?: string[];
    mlData?: {
        probability?: number;
        predictedClass?: 0 | 1;
        confidence?: number;
        isFiltered?: boolean;
        [key: string]: any;
    };
}

export interface RiskCalculation {
    positionSize: number;
    riskAmount: number;
    potentialProfit: number;
    leverageRecommended: number;
    marginRequired: number;
}

export interface MarketSentiment {
    fearGreedIndex: number;
    sentiment: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
    trend: 'bullish' | 'bearish' | 'sideways';
}

export interface OHLCPoint {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface ExecutionConfig {
    spread: number;
    slippage: number;
    makerFee: number;
    takerFee: number;
    useMarketOrders: boolean;
}
