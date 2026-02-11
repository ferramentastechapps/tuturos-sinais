export interface MLFeatureVector {
    // --- Technicals ---
    rsi: number;
    adx: number;
    atr_rel: number;
    dist_ema20: number;
    dist_ema50: number;
    dist_ema200: number;
    dist_vwap: number;

    // --- Market ---
    volatility_24h: number;
    volume_rel: number;
    funding_rate: number;
    open_interest_var: number;
    long_short_ratio: number;

    // --- Signal ---
    is_long: number;
    confidence: number;
    quality_score: number;
    confluence_count: number;
    stop_loss_pct: number;
    take_profit_pct: number;
    risk_reward: number;

    // --- Context ---
    hour_of_day: number;
    day_of_week: number;

    // Placeholder / Future
    btc_trend: number;
    dominance_btc: number;
    fear_greed: number;

    // Allow indexing for generic processing
    [key: string]: number;
}

export interface MLTrainingSample {
    id?: string;
    signalId: string;
    symbol: string;
    features: MLFeatureVector;
    label: 0 | 1; // 0 = Loss, 1 = Win
    pnl?: number;
    timestamp: number;
}

export interface MLModelMetrics {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    auc?: number;

    // Financial metrics
    profitFactor: number;
    winRate: number;
    sharpeRatio?: number;

    // Metadata
    trainedAt: number;
    sampleSize: number;
}

export interface MLPrediction {
    probability: number; // 0 to 1
    predictedClass: 0 | 1;
    confidence: number; // 0 to 1
    contribution?: Record<string, number>; // Feature contributions (SHAP-like)
}

export interface MLModelArtifact {
    id: string;
    version: string;
    type: 'random_forest' | 'gradient_boosting' | 'ensemble';
    createdAt: number;
    metrics: MLModelMetrics;
    isActive: boolean;
    data: any; // Serialized model tree/weights
}

export interface MLServiceStatus {
    isReady: boolean;
    isTraining: boolean;
    activeModelVersion?: string;
    trainingSamplesCount: number;
    lastTrainingDate?: number;
}
