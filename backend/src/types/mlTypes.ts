// ML Types — Direct port from frontend

export interface MLFeatureVector {
    rsi: number;
    adx: number;
    atr_rel: number;
    dist_ema20: number;
    dist_ema50: number;
    dist_ema200: number;
    dist_vwap: number;
    volatility_24h: number;
    volume_rel: number;
    funding_rate: number;
    open_interest_var: number;
    long_short_ratio: number;
    is_long: number;
    confidence: number;
    quality_score: number;
    confluence_count: number;
    stop_loss_pct: number;
    take_profit_pct: number;
    risk_reward: number;
    hour_of_day: number;
    day_of_week: number;
    btc_trend: number;
    dominance_btc: number;
    fear_greed: number;
    [key: string]: number;
}

export interface MLPrediction {
    probability: number;
    predictedClass: 0 | 1;
    confidence: number;
    contribution?: Record<string, number>;
}

export interface MLModelMetrics {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    auc?: number;
    profitFactor: number;
    winRate: number;
    sharpeRatio?: number;
    trainedAt: number;
    sampleSize: number;
}

export interface MLServiceStatus {
    isReady: boolean;
    isTraining: boolean;
    activeModelVersion?: string;
    trainingSamplesCount: number;
    lastTrainingDate?: number;
}
