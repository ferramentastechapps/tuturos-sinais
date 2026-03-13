// ═══════════════════════════════════════════════════════════
// Strategy Types — Indicator profiles for signal generation
// ═══════════════════════════════════════════════════════════

// ──────────── Indicator Keys ────────────

export type IndicatorKey =
  // Market Structure
  | 'marketStructure'
  | 'breakOfStructure'
  | 'changeOfCharacter'
  // Classic Technical
  | 'rsi'
  | 'rsiDivergence'
  | 'macd'
  | 'macdCross'
  | 'bollingerBands'
  | 'bollingerSqueeze'
  | 'stochasticRsi'
  | 'adx'
  | 'atr'
  // Moving Averages
  | 'ema9'
  | 'ema21'
  | 'ema50'
  | 'ema200'
  | 'goldenDeathCross'
  | 'priceVsEma200'
  // Volume & Orderflow
  | 'volumeAboveAvg'
  | 'cvd'
  | 'cvdDivergence'
  | 'vwap'
  | 'volumeProfilePoc'
  // Smart Money
  | 'orderBlocks'
  | 'fairValueGaps'
  | 'liquidityZones'
  | 'equalHighsLows'
  | 'imbalance'
  // Futures Exclusive
  | 'fundingRateExtreme'
  | 'fundingRateNeutral'
  | 'openInterestGrowing'
  | 'openInterestFalling'
  | 'oiDivergence'
  | 'longShortRatioExtreme'
  // Support & Resistance
  | 'supportZone'
  | 'resistanceZone'
  | 'fibonacciLevels'
  | 'psychologicalLevels'
  // Candle Patterns
  | 'engulfing'
  | 'pinBar'
  | 'hammerShootingStar'
  | 'doji'
  | 'morningEveningStar'
  // Sentiment & On-Chain
  | 'fearGreedIndex'
  | 'extremeLiquidations'
  | 'exchangeNetflow'
  | 'whaleActivity'
  | 'btcDominance';

// ──────────── Category ────────────

export type IndicatorCategory =
  | 'marketStructure'
  | 'classicTechnical'
  | 'movingAverages'
  | 'volumeOrderflow'
  | 'smartMoney'
  | 'futuresExclusive'
  | 'supportResistance'
  | 'candlePatterns'
  | 'sentimentOnChain';

export interface IndicatorMeta {
  key: IndicatorKey;
  label: string;
  category: IndicatorCategory;
  categoryLabel: string;
  description: string;
  defaultWeight: number;
}

// ──────────── Indicator Config ────────────

export interface IndicatorConfig {
  active: boolean;
  weight: number; // 0-100
}

export type IndicatorsMap = Record<IndicatorKey, IndicatorConfig>;

// ──────────── Strategy Profile ────────────

export interface StrategyProfile {
  id: string;
  name: string;
  description: string;
  isPreset: boolean;
  isDefault: boolean;
  indicators: IndicatorsMap;
  createdAt: string;
  updatedAt: string;
  // Computed
  totalActiveIndicators?: number;
  avgWeight?: number;
}

// ──────────── Hybrid Mode (Scaffolded for v2) ────────────

export type HybridConditionType = 'timeframe' | 'symbol' | 'hour' | 'volatility';

export interface HybridRule {
  id: string;
  condition: HybridConditionType;
  value: string;
  profileId: string;
}

export interface HybridStrategy {
  id: string;
  name: string;
  rules: HybridRule[];
  fallbackProfileId: string;
}

// ──────────── Profile-aware Signal Output ────────────

export interface SignalProfileInfo {
  profileId: string;
  profileName: string;
  activeIndicators: number;
  totalIndicators: number;
  confirmedIndicators: string[];
  disabledIndicators: string[];
  normalizedScore: number; // Score calculated from weighted indicators
}

// ──────────── Recommendation ────────────

export interface IndicatorRecommendation {
  indicatorKey: IndicatorKey;
  indicatorLabel: string;
  currentWeight: number;
  suggestedWeight: number;
  currentActive: boolean;
  suggestedActive: boolean;
  winRate: number;
  appearances: number;
  action: 'increase_weight' | 'decrease_weight' | 'disable' | 'enable' | 'keep';
  reason: string;
}

export interface RecommendationResult {
  profileId: string;
  profileName: string;
  tradesAnalyzed: number;
  recommendations: IndicatorRecommendation[];
  simulatedWinRate: number;
  currentWinRate: number;
  simulatedProfitFactor: number;
  currentProfitFactor: number;
  hasRecommendations: boolean;
}

// ──────────── Registry of all indicators ────────────

export const INDICATOR_REGISTRY: IndicatorMeta[] = [
  // Market Structure
  { key: 'marketStructure', label: 'Market Structure (HH, HL, LH, LL)', category: 'marketStructure', categoryLabel: 'Estrutura de Mercado', description: 'Analisa a estrutura do mercado identificando Higher Highs, Higher Lows, etc.', defaultWeight: 90 },
  { key: 'breakOfStructure', label: 'Break of Structure (BOS)', category: 'marketStructure', categoryLabel: 'Estrutura de Mercado', description: 'Detecta quebras na estrutura de mercado.', defaultWeight: 85 },
  { key: 'changeOfCharacter', label: 'Change of Character (CHOCH)', category: 'marketStructure', categoryLabel: 'Estrutura de Mercado', description: 'Detecta mudanças de caráter do mercado (reversão potencial).', defaultWeight: 88 },

  // Classic Technical
  { key: 'rsi', label: 'RSI', category: 'classicTechnical', categoryLabel: 'Indicadores Técnicos Clássicos', description: 'Relative Strength Index — sobrecompra/sobrevenda.', defaultWeight: 75 },
  { key: 'rsiDivergence', label: 'RSI Divergência', category: 'classicTechnical', categoryLabel: 'Indicadores Técnicos Clássicos', description: 'Divergências bullish/bearish no RSI.', defaultWeight: 85 },
  { key: 'macd', label: 'MACD', category: 'classicTechnical', categoryLabel: 'Indicadores Técnicos Clássicos', description: 'Moving Average Convergence/Divergence.', defaultWeight: 70 },
  { key: 'macdCross', label: 'MACD Cruzamento', category: 'classicTechnical', categoryLabel: 'Indicadores Técnicos Clássicos', description: 'Cruzamento de sinal no MACD.', defaultWeight: 75 },
  { key: 'bollingerBands', label: 'Bollinger Bands', category: 'classicTechnical', categoryLabel: 'Indicadores Técnicos Clássicos', description: 'Bandas de Bollinger — volatilidade e reversão.', defaultWeight: 65 },
  { key: 'bollingerSqueeze', label: 'Bollinger Bands Squeeze', category: 'classicTechnical', categoryLabel: 'Indicadores Técnicos Clássicos', description: 'Compressão das bandas — alta volatilidade iminente.', defaultWeight: 70 },
  { key: 'stochasticRsi', label: 'Stochastic RSI', category: 'classicTechnical', categoryLabel: 'Indicadores Técnicos Clássicos', description: 'Stochastic aplicado ao RSI.', defaultWeight: 65 },
  { key: 'adx', label: 'ADX (força de tendência)', category: 'classicTechnical', categoryLabel: 'Indicadores Técnicos Clássicos', description: 'Average Directional Index — força da tendência.', defaultWeight: 70 },
  { key: 'atr', label: 'ATR (volatilidade)', category: 'classicTechnical', categoryLabel: 'Indicadores Técnicos Clássicos', description: 'Average True Range — volatilidade do ativo.', defaultWeight: 60 },

  // Moving Averages
  { key: 'ema9', label: 'EMA 9', category: 'movingAverages', categoryLabel: 'Médias Móveis', description: 'Média móvel exponencial de 9 períodos.', defaultWeight: 65 },
  { key: 'ema21', label: 'EMA 21', category: 'movingAverages', categoryLabel: 'Médias Móveis', description: 'Média móvel exponencial de 21 períodos.', defaultWeight: 70 },
  { key: 'ema50', label: 'EMA 50', category: 'movingAverages', categoryLabel: 'Médias Móveis', description: 'Média móvel exponencial de 50 períodos.', defaultWeight: 75 },
  { key: 'ema200', label: 'EMA 200', category: 'movingAverages', categoryLabel: 'Médias Móveis', description: 'Média móvel exponencial de 200 períodos.', defaultWeight: 85 },
  { key: 'goldenDeathCross', label: 'Golden Cross / Death Cross', category: 'movingAverages', categoryLabel: 'Médias Móveis', description: 'Cruzamento entre EMAs de médio e longo prazo.', defaultWeight: 80 },
  { key: 'priceVsEma200', label: 'Preço acima/abaixo EMA 200', category: 'movingAverages', categoryLabel: 'Médias Móveis', description: 'Posição do preço em relação à EMA 200.', defaultWeight: 80 },

  // Volume & Orderflow
  { key: 'volumeAboveAvg', label: 'Volume acima da média', category: 'volumeOrderflow', categoryLabel: 'Volume e Orderflow', description: 'Volume significativamente acima da média.', defaultWeight: 70 },
  { key: 'cvd', label: 'CVD (Cumulative Volume Delta)', category: 'volumeOrderflow', categoryLabel: 'Volume e Orderflow', description: 'Diferencial de volume acumulado — pressão compradora/vendedora.', defaultWeight: 80 },
  { key: 'cvdDivergence', label: 'CVD Divergência', category: 'volumeOrderflow', categoryLabel: 'Volume e Orderflow', description: 'Divergência entre CVD e preço.', defaultWeight: 85 },
  { key: 'vwap', label: 'VWAP', category: 'volumeOrderflow', categoryLabel: 'Volume e Orderflow', description: 'Volume Weighted Average Price.', defaultWeight: 75 },
  { key: 'volumeProfilePoc', label: 'Volume Profile POC', category: 'volumeOrderflow', categoryLabel: 'Volume e Orderflow', description: 'Ponto de controle do perfil de volume.', defaultWeight: 70 },

  // Smart Money
  { key: 'orderBlocks', label: 'Order Blocks (OB)', category: 'smartMoney', categoryLabel: 'Smart Money Concepts', description: 'Blocos de ordens institucionais.', defaultWeight: 90 },
  { key: 'fairValueGaps', label: 'Fair Value Gaps (FVG)', category: 'smartMoney', categoryLabel: 'Smart Money Concepts', description: 'Lacunas de valor justo no preço.', defaultWeight: 85 },
  { key: 'liquidityZones', label: 'Zonas de Liquidez', category: 'smartMoney', categoryLabel: 'Smart Money Concepts', description: 'Zonas de liquidez acumulada (stop hunts).', defaultWeight: 80 },
  { key: 'equalHighsLows', label: 'Equal Highs/Lows', category: 'smartMoney', categoryLabel: 'Smart Money Concepts', description: 'Topos/fundos iguais — liquidez potencial.', defaultWeight: 70 },
  { key: 'imbalance', label: 'Imbalance', category: 'smartMoney', categoryLabel: 'Smart Money Concepts', description: 'Desequilíbrios de oferta e demanda.', defaultWeight: 75 },

  // Futures Exclusive
  { key: 'fundingRateExtreme', label: 'Funding Rate Extremo', category: 'futuresExclusive', categoryLabel: 'Sinais Exclusivos de Futuros', description: 'Funding rate em níveis extremos.', defaultWeight: 85 },
  { key: 'fundingRateNeutral', label: 'Funding Rate Neutro', category: 'futuresExclusive', categoryLabel: 'Sinais Exclusivos de Futuros', description: 'Funding rate neutro — mercado equilibrado.', defaultWeight: 60 },
  { key: 'openInterestGrowing', label: 'Open Interest Crescendo', category: 'futuresExclusive', categoryLabel: 'Sinais Exclusivos de Futuros', description: 'OI aumentando — novo capital entrando.', defaultWeight: 75 },
  { key: 'openInterestFalling', label: 'Open Interest Caindo', category: 'futuresExclusive', categoryLabel: 'Sinais Exclusivos de Futuros', description: 'OI diminuindo — posições sendo fechadas.', defaultWeight: 65 },
  { key: 'oiDivergence', label: 'OI Divergência com Preço', category: 'futuresExclusive', categoryLabel: 'Sinais Exclusivos de Futuros', description: 'Divergência entre OI e movimento de preço.', defaultWeight: 80 },
  { key: 'longShortRatioExtreme', label: 'Long/Short Ratio Extremo', category: 'futuresExclusive', categoryLabel: 'Sinais Exclusivos de Futuros', description: 'Ratio L/S em extremos — possível reversão.', defaultWeight: 70 },

  // Support & Resistance
  { key: 'supportZone', label: 'Zona de Suporte', category: 'supportResistance', categoryLabel: 'Suporte e Resistência', description: 'Preço próximo a zona de suporte relevante.', defaultWeight: 80 },
  { key: 'resistanceZone', label: 'Zona de Resistência', category: 'supportResistance', categoryLabel: 'Suporte e Resistência', description: 'Preço próximo a zona de resistência relevante.', defaultWeight: 80 },
  { key: 'fibonacciLevels', label: 'Níveis de Fibonacci', category: 'supportResistance', categoryLabel: 'Suporte e Resistência', description: 'Preço em retração/extensão de Fibonacci.', defaultWeight: 70 },
  { key: 'psychologicalLevels', label: 'Números Redondos Psicológicos', category: 'supportResistance', categoryLabel: 'Suporte e Resistência', description: 'Níveis psicológicos (ex: 100k, 50k).', defaultWeight: 60 },

  // Candle Patterns
  { key: 'engulfing', label: 'Engolfo (Bullish/Bearish)', category: 'candlePatterns', categoryLabel: 'Padrões de Candle', description: 'Candle de engolfo — reversão forte.', defaultWeight: 75 },
  { key: 'pinBar', label: 'Pin Bar', category: 'candlePatterns', categoryLabel: 'Padrões de Candle', description: 'Pin bar (hammer/shooting star) — rejeição de preço.', defaultWeight: 70 },
  { key: 'hammerShootingStar', label: 'Hammer / Shooting Star', category: 'candlePatterns', categoryLabel: 'Padrões de Candle', description: 'Padrões de martelo e estrela cadente.', defaultWeight: 65 },
  { key: 'doji', label: 'Doji', category: 'candlePatterns', categoryLabel: 'Padrões de Candle', description: 'Candle Doji — indecisão do mercado.', defaultWeight: 50 },
  { key: 'morningEveningStar', label: 'Morning Star / Evening Star', category: 'candlePatterns', categoryLabel: 'Padrões de Candle', description: 'Padrões de estrela — reversão de 3 candles.', defaultWeight: 75 },

  // Sentiment & On-Chain
  { key: 'fearGreedIndex', label: 'Fear & Greed Index', category: 'sentimentOnChain', categoryLabel: 'Sentimento e On-Chain', description: 'Índice de medo e ganância do mercado crypto.', defaultWeight: 70 },
  { key: 'extremeLiquidations', label: 'Liquidações Extremas', category: 'sentimentOnChain', categoryLabel: 'Sentimento e On-Chain', description: 'Volume extremo de liquidações — possível reversão.', defaultWeight: 80 },
  { key: 'exchangeNetflow', label: 'Exchange Netflow', category: 'sentimentOnChain', categoryLabel: 'Sentimento e On-Chain', description: 'Fluxo líquido de cripto nas exchanges.', defaultWeight: 65 },
  { key: 'whaleActivity', label: 'Whale Activity', category: 'sentimentOnChain', categoryLabel: 'Sentimento e On-Chain', description: 'Atividade de grandes carteiras (baleias).', defaultWeight: 75 },
  { key: 'btcDominance', label: 'Dominância BTC', category: 'sentimentOnChain', categoryLabel: 'Sentimento e On-Chain', description: 'Dominância do Bitcoin no mercado.', defaultWeight: 60 },
];

// ──────────── Helper ────────────

export const getDefaultIndicatorsMap = (): IndicatorsMap => {
  const map = {} as IndicatorsMap;
  for (const meta of INDICATOR_REGISTRY) {
    map[meta.key] = { active: true, weight: meta.defaultWeight };
  }
  return map;
};

export const computeProfileStats = (profile: StrategyProfile): StrategyProfile => {
  const entries = Object.values(profile.indicators);
  const active = entries.filter(i => i.active);
  const avgWeight = active.length > 0
    ? Math.round(active.reduce((s, i) => s + i.weight, 0) / active.length)
    : 0;
  return {
    ...profile,
    totalActiveIndicators: active.length,
    avgWeight,
  };
};

export const INDICATOR_CATEGORIES: IndicatorCategory[] = [
  'marketStructure',
  'classicTechnical',
  'movingAverages',
  'volumeOrderflow',
  'smartMoney',
  'futuresExclusive',
  'supportResistance',
  'candlePatterns',
  'sentimentOnChain',
];
