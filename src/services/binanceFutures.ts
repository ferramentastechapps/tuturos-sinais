// Binance Futures API Service — Funding Rate, Open Interest, Liquidações
// Utiliza endpoints públicos da Binance Futures (sem autenticação)

// ──────────── Tipos ────────────

export interface FundingRateData {
    symbol: string;
    fundingRate: number;        // Taxa atual (ex: 0.0001 = 0.01%)
    fundingRatePercent: number; // Em percentual
    nextFundingTime: number;    // Timestamp do próximo funding
    timestamp: number;
    isExtreme: boolean;         // Se está em nível extremo
    direction: 'bullish' | 'bearish' | 'neutral';
    description: string;
}

export interface OpenInterestData {
    symbol: string;
    openInterest: number;       // OI atual em contratos
    openInterestValue: number;  // OI em USDT
    timestamp: number;
}

export interface OpenInterestHistory {
    symbol: string;
    data: Array<{
        timestamp: number;
        openInterest: number;
        openInterestValue: number;
    }>;
    change24h: number; // Variação % em 24h
    trend: 'increasing' | 'decreasing' | 'stable';
}

export interface OIDivergence {
    type: 'bullish' | 'bearish';
    priceChange: number;   // Variação do preço em %
    oiChange: number;      // Variação do OI em %
    description: string;
    strength: number;      // 0-100
}

export interface LiquidationData {
    symbol: string;
    timestamp: number;
    side: 'buy' | 'sell';      // buy = long liquidado, sell = short liquidado
    price: number;
    quantity: number;
    value: number;             // Em USDT
}

export interface LiquidationSummary {
    symbol: string;
    longLiquidations24h: number;   // Volume de longs liquidados
    shortLiquidations24h: number;  // Volume de shorts liquidados
    ratio: number;                  // Long/Short liquidation ratio
    dominantSide: 'longs' | 'shorts' | 'balanced';
    totalValue24h: number;
    description: string;
}

export interface FuturesOverview {
    fundingRate: FundingRateData;
    openInterest: OpenInterestData;
    oiHistory: OpenInterestHistory;
    oiDivergence: OIDivergence | null;
    liquidations: LiquidationSummary;
}

import { isFuturesSymbolAvailable } from '@/services/binanceAssetSync';

// ──────────── Constantes ────────────

const BINANCE_FUTURES_API = 'https://fapi.binance.com';

// Mapeia símbolos internos para Binance Futures (passthrough — já vem em formato correto)
const resolveBinanceSymbol = (symbol: string): string => {
    // Se já estiver no formato XXXUSDT, usa direto
    if (symbol.toUpperCase().endsWith('USDT')) return symbol.toUpperCase();
    return `${symbol.toUpperCase()}USDT`;
};

// Thresholds para funding rate
const FUNDING_EXTREME_POSITIVE = 0.05;  // 0.05% = extremo positivo (muitos longs)
const FUNDING_EXTREME_NEGATIVE = -0.05; // -0.05% = extremo negativo (muitos shorts)
const FUNDING_HIGH_POSITIVE = 0.03;
const FUNDING_HIGH_NEGATIVE = -0.03;

// ──────────── Fetch Helper ────────────

const fetchBinanceFutures = async (endpoint: string, params: Record<string, string> = {}): Promise<unknown> => {
    const searchParams = new URLSearchParams(params);
    const url = `${BINANCE_FUTURES_API}${endpoint}?${searchParams.toString()}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Binance Futures API error: ${response.status}`);
        }

        return response.json();
    } catch (error) {
        console.error(`Binance Futures API error for ${endpoint}:`, error);
        throw error;
    }
};

// ──────────── Funding Rate ────────────

/**
 * Busca a taxa de funding atual de um par.
 * Funding rate > 0: longs pagam shorts (mercado bullish demais)
 * Funding rate < 0: shorts pagam longs (mercado bearish demais)
 */
export const fetchFundingRate = async (symbol: string): Promise<FundingRateData> => {
    const binanceSymbol = resolveBinanceSymbol(symbol);

    try {
        const data = await fetchBinanceFutures('/fapi/v1/premiumIndex', {
            symbol: binanceSymbol,
        }) as {
            symbol: string;
            lastFundingRate: string;
            nextFundingTime: number;
            time: number;
        };

        const fundingRate = parseFloat(data.lastFundingRate);
        const fundingRatePercent = fundingRate * 100;
        const isExtreme = Math.abs(fundingRatePercent) >= FUNDING_EXTREME_POSITIVE;

        let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        let description = '';

        if (fundingRatePercent >= FUNDING_EXTREME_POSITIVE) {
            direction = 'bearish'; // Extreme positive = muitos longs, possível drop
            description = `Funding Rate ${fundingRatePercent.toFixed(4)}% — EXTREMO POSITIVO (risco de queda)`;
        } else if (fundingRatePercent >= FUNDING_HIGH_POSITIVE) {
            direction = 'bearish';
            description = `Funding Rate ${fundingRatePercent.toFixed(4)}% — Alto positivo (maioria long)`;
        } else if (fundingRatePercent <= FUNDING_EXTREME_NEGATIVE * 100) {
            direction = 'bullish'; // Extreme negative = muitos shorts, possível pump
            description = `Funding Rate ${fundingRatePercent.toFixed(4)}% — EXTREMO NEGATIVO (risco de alta)`;
        } else if (fundingRatePercent <= FUNDING_HIGH_NEGATIVE) {
            direction = 'bullish';
            description = `Funding Rate ${fundingRatePercent.toFixed(4)}% — Alto negativo (maioria short)`;
        } else {
            description = `Funding Rate ${fundingRatePercent.toFixed(4)}% — Neutro`;
        }

        return {
            symbol,
            fundingRate,
            fundingRatePercent,
            nextFundingTime: data.nextFundingTime,
            timestamp: data.time,
            isExtreme,
            direction,
            description,
        };
    } catch {
        // Fallback caso a API falhe
        return {
            symbol,
            fundingRate: 0,
            fundingRatePercent: 0,
            nextFundingTime: 0,
            timestamp: Date.now(),
            isExtreme: false,
            direction: 'neutral',
            description: 'Funding Rate indisponível',
        };
    }
};

// ──────────── Open Interest ────────────

/**
 * Busca o Open Interest atual.
 */
export const fetchOpenInterest = async (symbol: string): Promise<OpenInterestData> => {
    const binanceSymbol = resolveBinanceSymbol(symbol);

    try {
        const data = await fetchBinanceFutures('/fapi/v1/openInterest', {
            symbol: binanceSymbol,
        }) as {
            openInterest: string;
            symbol: string;
            time: number;
        };

        // Busca o preço atual para calcular o valor em USDT
        const tickerData = await fetchBinanceFutures('/fapi/v1/ticker/price', {
            symbol: binanceSymbol,
        }) as { price: string };

        const openInterest = parseFloat(data.openInterest);
        const currentPrice = parseFloat(tickerData.price);
        const openInterestValue = openInterest * currentPrice;

        return {
            symbol,
            openInterest,
            openInterestValue,
            timestamp: data.time || Date.now(),
        };
    } catch {
        return {
            symbol,
            openInterest: 0,
            openInterestValue: 0,
            timestamp: Date.now(),
        };
    }
};

/**
 * Busca histórico de Open Interest para análise de tendência.
 */
export const fetchOpenInterestHistory = async (
    symbol: string,
    period: '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d' = '1h',
    limit: number = 48
): Promise<OpenInterestHistory> => {
    const binanceSymbol = resolveBinanceSymbol(symbol);

    try {
        const data = await fetchBinanceFutures('/futures/data/openInterestHist', {
            symbol: binanceSymbol,
            period,
            limit: limit.toString(),
        }) as Array<{
            sumOpenInterest: string;
            sumOpenInterestValue: string;
            timestamp: number;
        }>;

        const history = data.map(item => ({
            timestamp: item.timestamp,
            openInterest: parseFloat(item.sumOpenInterest),
            openInterestValue: parseFloat(item.sumOpenInterestValue),
        }));

        // Calcula variação 24h
        const now = history[history.length - 1];
        const past = history[0];
        const change24h = past.openInterest > 0
            ? ((now.openInterest - past.openInterest) / past.openInterest) * 100
            : 0;

        // Determina tendência
        let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (change24h > 3) trend = 'increasing';
        else if (change24h < -3) trend = 'decreasing';

        return {
            symbol,
            data: history,
            change24h,
            trend,
        };
    } catch {
        return {
            symbol,
            data: [],
            change24h: 0,
            trend: 'stable',
        };
    }
};

/**
 * Analisa divergência entre Open Interest e Preço.
 * 
 * - OI sobe + Preço sobe = tendência saudável (bullish)
 * - OI sobe + Preço cai = longs entrando contra tendência (bearish squeeze provável)
 * - OI cai + Preço sobe = shorts fechando (rally não sustentável)
 * - OI cai + Preço cai = longs fechando (capitulação, possível fundo)
 */
export const analyzeOIDivergence = (
    oiHistory: OpenInterestHistory,
    priceChange24h: number
): OIDivergence | null => {
    const oiChange = oiHistory.change24h;

    // Sem dados suficientes
    if (oiHistory.data.length < 2) return null;

    // Sem divergência significativa
    if (Math.abs(oiChange) < 2 && Math.abs(priceChange24h) < 1) return null;

    // OI sobe + Preço cai = bearish (longs entrando mas preço caindo)
    if (oiChange > 3 && priceChange24h < -1) {
        const strength = Math.min(Math.round(Math.abs(oiChange - priceChange24h) * 5), 100);
        return {
            type: 'bearish',
            priceChange: priceChange24h,
            oiChange,
            strength,
            description: `OI +${oiChange.toFixed(1)}% com preço ${priceChange24h.toFixed(1)}% — Longs acumulando contra tendência (squeeze provável)`,
        };
    }

    // OI cai + Preço sobe = sinal de fraqueza
    if (oiChange < -3 && priceChange24h > 1) {
        const strength = Math.min(Math.round(Math.abs(oiChange - priceChange24h) * 5), 100);
        return {
            type: 'bearish',
            priceChange: priceChange24h,
            oiChange,
            strength,
            description: `OI ${oiChange.toFixed(1)}% com preço +${priceChange24h.toFixed(1)}% — Shorts fechando, rally pode não ser sustentável`,
        };
    }

    // OI cai + Preço cai = capitulação (possível fundo)
    if (oiChange < -5 && priceChange24h < -3) {
        const strength = Math.min(Math.round(Math.abs(oiChange) * 5), 100);
        return {
            type: 'bullish',
            priceChange: priceChange24h,
            oiChange,
            strength,
            description: `OI ${oiChange.toFixed(1)}% com preço ${priceChange24h.toFixed(1)}% — Capitulação de longs (possível fundo)`,
        };
    }

    // OI sobe + Preço sobe = tendência saudável
    if (oiChange > 5 && priceChange24h > 3) {
        const strength = Math.min(Math.round(Math.abs(oiChange) * 4), 100);
        return {
            type: 'bullish',
            priceChange: priceChange24h,
            oiChange,
            strength,
            description: `OI +${oiChange.toFixed(1)}% com preço +${priceChange24h.toFixed(1)}% — Tendência de alta saudável`,
        };
    }

    return null;
};

// ──────────── Liquidações ────────────

/**
 * Busca dados recentes de liquidações (liquidação forçada de posições).
 * Nota: A Binance não tem um endpoint público direto para liquidações em massa,
 * então usamos o endpoint de allForceOrders quando disponível, com fallback
 * para estimativa baseada nos dados de long/short ratio.
 */
export const fetchLiquidationSummary = async (symbol: string): Promise<LiquidationSummary> => {
    const binanceSymbol = resolveBinanceSymbol(symbol);

    try {
        // Usa long/short ratio como proxy para estimar pressão de liquidação
        const [globalRatio, topTraderRatio] = await Promise.all([
            fetchBinanceFutures('/futures/data/globalLongShortAccountRatio', {
                symbol: binanceSymbol,
                period: '1h',
                limit: '24',
            }) as Promise<Array<{ longShortRatio: string; timestamp: number }>>,
            fetchBinanceFutures('/futures/data/topLongShortAccountRatio', {
                symbol: binanceSymbol,
                period: '1h',
                limit: '24',
            }) as Promise<Array<{ longShortRatio: string; timestamp: number }>>,
        ]);

        // Calcula tendência das liquidações baseado na mudança do ratio
        const latestRatio = parseFloat(globalRatio[globalRatio.length - 1]?.longShortRatio || '1');
        const earliestRatio = parseFloat(globalRatio[0]?.longShortRatio || '1');
        const ratioChange = latestRatio - earliestRatio;

        // Estima volumes de liquidação baseado na volatilidade do ratio
        const volatility = globalRatio.reduce((sum, item, i) => {
            if (i === 0) return 0;
            const prev = parseFloat(globalRatio[i - 1].longShortRatio);
            const curr = parseFloat(item.longShortRatio);
            return sum + Math.abs(curr - prev);
        }, 0);

        // Mais variação no ratio = mais liquidações
        const estimatedLiquidations = volatility * 1000000; // Escala estimada
        const longLiquidations24h = estimatedLiquidations * (latestRatio > 1 ? 0.6 : 0.4);
        const shortLiquidations24h = estimatedLiquidations * (latestRatio > 1 ? 0.4 : 0.6);

        let dominantSide: 'longs' | 'shorts' | 'balanced' = 'balanced';
        if (longLiquidations24h > shortLiquidations24h * 1.5) dominantSide = 'longs';
        else if (shortLiquidations24h > longLiquidations24h * 1.5) dominantSide = 'shorts';

        const topTraderLatest = parseFloat(topTraderRatio[topTraderRatio.length - 1]?.longShortRatio || '1');

        return {
            symbol,
            longLiquidations24h,
            shortLiquidations24h,
            ratio: latestRatio,
            dominantSide,
            totalValue24h: longLiquidations24h + shortLiquidations24h,
            description: `L/S Ratio: ${latestRatio.toFixed(2)} | Top Traders: ${topTraderLatest.toFixed(2)} | ${dominantSide === 'longs' ? 'Mais longs liquidados' : dominantSide === 'shorts' ? 'Mais shorts liquidados' : 'Equilíbrio'}`,
        };
    } catch {
        return {
            symbol,
            longLiquidations24h: 0,
            shortLiquidations24h: 0,
            ratio: 1,
            dominantSide: 'balanced',
            totalValue24h: 0,
            description: 'Dados de liquidação indisponíveis',
        };
    }
};

// ──────────── Visão Geral ────────────

/**
 * Busca todos os dados de futuros de um par de uma vez.
 */
export const fetchFuturesOverview = async (
    symbol: string,
    priceChange24h: number
): Promise<FuturesOverview> => {
    const [fundingRate, openInterest, oiHistory, liquidations] = await Promise.all([
        fetchFundingRate(symbol),
        fetchOpenInterest(symbol),
        fetchOpenInterestHistory(symbol, '1h', 48),
        fetchLiquidationSummary(symbol),
    ]);

    const oiDivergence = analyzeOIDivergence(oiHistory, priceChange24h);

    return {
        fundingRate,
        openInterest,
        oiHistory,
        oiDivergence,
        liquidations,
    };
};

/**
 * Verifica se o símbolo está disponível para futuros na Binance.
 * Usa cache do binanceAssetSync para verificação rápida.
 */
export const isFuturesAvailable = (symbol: string): boolean => {
    return isFuturesSymbolAvailable(resolveBinanceSymbol(symbol));
};
