/**
 * FASE 3 - Filtros Avançados de Contexto de Mercado
 * 
 * Centraliza verificações de contexto macro antes da análise técnica:
 * - Tendência BTC 4H (EMA 50 vs EMA 200)
 * - Fear & Greed Index (API pública)
 * - Confirmação Daily (EMA 200)
 * 
 * Objetivo: Evitar sinais contra o fluxo institucional e sentimento de mercado
 */

import axios from 'axios';
import { logger } from '../lib/logger.js';
import { bybitConnector } from '../exchange/bybitConnector.js';
import { config } from '../lib/config.js';

// ────────────────────────────────────────────────────────────────────────────
// TIPOS
// ────────────────────────────────────────────────────────────────────────────

export type BTCTrend = 'STRONG_UP' | 'UP' | 'NEUTRAL' | 'DOWN' | 'STRONG_DOWN';

export interface MarketContext {
    btcTrend: BTCTrend;
    btcPrice: number;
    fearGreedIndex: number;
    fearGreedLabel: string;
    timestamp: Date;
}

export interface DailyConfirmation {
    symbol: string;
    price: number;
    ema200Daily: number;
    aboveEma200: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// CACHE (evita requisições excessivas)
// ────────────────────────────────────────────────────────────────────────────

let cachedMarketContext: MarketContext | null = null;
let lastContextFetch = 0;
const CONTEXT_CACHE_MS = 5 * 60 * 1000; // 5 minutos

const dailyEmaCache = new Map<string, { ema200: number, timestamp: number }>();
const DAILY_EMA_CACHE_MS = 60 * 60 * 1000; // 1 hora

// ────────────────────────────────────────────────────────────────────────────
// FUNÇÕES AUXILIARES
// ────────────────────────────────────────────────────────────────────────────

function calculateEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const emaArray: number[] = [];
    let ema = data[0];

    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            ema = data[i];
        } else {
            ema = data[i] * k + ema * (1 - k);
        }
        emaArray.push(ema);
    }

    return emaArray;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. FILTRO DE CONTEXTO BTC
// ────────────────────────────────────────────────────────────────────────────

/**
 * Analisa a tendência do BTC no 4H usando EMA 50 vs EMA 200
 * 
 * STRONG_UP: EMA50 > EMA200 e preço > EMA50 (alta forte)
 * UP: EMA50 > EMA200 mas preço entre EMAs (alta fraca)
 * NEUTRAL: EMA50 ≈ EMA200 (lateral)
 * DOWN: EMA50 < EMA200 mas preço entre EMAs (queda fraca)
 * STRONG_DOWN: EMA50 < EMA200 e preço < EMA50 (queda forte)
 */
async function getBTCTrend(): Promise<{ trend: BTCTrend; price: number }> {
    try {
        // Buscar dados 4H do BTC (200 candles para calcular EMA 200)
        const ohlc4h = await bybitConnector.fetchKlines('BTCUSDT', '240', 200);
        
        if (ohlc4h.length < 200) {
            logger.warn('[MarketContext] Dados insuficientes para BTC 4H, assumindo NEUTRAL');
            return { trend: 'NEUTRAL', price: ohlc4h[ohlc4h.length - 1]?.close || 0 };
        }

        const closes = ohlc4h.map((c: any) => c.close);
        const currentPrice = closes[closes.length - 1];
        
        const ema50 = calculateEMA(closes, 50);
        const ema200 = calculateEMA(closes, 200);
        
        const lastEma50 = ema50[ema50.length - 1];
        const lastEma200 = ema200[ema200.length - 1];
        
        const ema50AboveEma200 = lastEma50 > lastEma200;
        const diff = Math.abs(lastEma50 - lastEma200) / lastEma200;
        
        let trend: BTCTrend;
        
        if (diff < 0.01) {
            // EMAs muito próximas = lateral
            trend = 'NEUTRAL';
        } else if (ema50AboveEma200) {
            // EMA50 acima da EMA200 = tendência de alta
            if (currentPrice > lastEma50) {
                trend = 'STRONG_UP'; // Preço acima de ambas EMAs
            } else {
                trend = 'UP'; // Preço entre as EMAs
            }
        } else {
            // EMA50 abaixo da EMA200 = tendência de baixa
            if (currentPrice < lastEma50) {
                trend = 'STRONG_DOWN'; // Preço abaixo de ambas EMAs
            } else {
                trend = 'DOWN'; // Preço entre as EMAs
            }
        }
        
        logger.debug(`[MarketContext] BTC 4H: ${trend} | Preço: ${currentPrice.toFixed(0)} | EMA50: ${lastEma50.toFixed(0)} | EMA200: ${lastEma200.toFixed(0)}`);
        
        return { trend, price: currentPrice };
        
    } catch (error) {
        logger.error('[MarketContext] Erro ao buscar tendência BTC', { error });
        return { trend: 'NEUTRAL', price: 0 };
    }
}

// ────────────────────────────────────────────────────────────────────────────
// 2. FILTRO FEAR & GREED
// ────────────────────────────────────────────────────────────────────────────

/**
 * Busca o Fear & Greed Index da API pública
 * https://api.alternative.me/fng/
 * 
 * Valores:
 * 0-24: Extreme Fear
 * 25-49: Fear
 * 50-74: Greed
 * 75-100: Extreme Greed
 */
async function getFearGreedIndex(): Promise<{ value: number; label: string }> {
    try {
        const response = await axios.get('https://api.alternative.me/fng/', {
            timeout: 5000,
        });
        
        const data = response.data?.data?.[0];
        if (!data) {
            logger.warn('[MarketContext] Fear & Greed API retornou dados inválidos');
            return { value: 50, label: 'Neutral' };
        }
        
        const value = parseInt(data.value, 10);
        const label = data.value_classification || 'Unknown';
        
        logger.debug(`[MarketContext] Fear & Greed: ${value} (${label})`);
        
        return { value, label };
        
    } catch (error) {
        logger.error('[MarketContext] Erro ao buscar Fear & Greed Index', { error });
        // Em caso de erro, retorna valor neutro (não bloqueia sinais)
        return { value: 50, label: 'Neutral' };
    }
}

// ────────────────────────────────────────────────────────────────────────────
// 3. CONFIRMAÇÃO DAILY (EMA 200)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Verifica se o preço está acima ou abaixo da EMA 200 no timeframe diário
 * 
 * LONG: Bloquear se preço < EMA200 Daily
 * SHORT: Bloquear se preço > EMA200 Daily
 */
export async function getDailyConfirmation(symbol: string): Promise<DailyConfirmation> {
    try {
        // Verificar cache
        const cached = dailyEmaCache.get(symbol);
        if (cached && Date.now() - cached.timestamp < DAILY_EMA_CACHE_MS) {
            const currentPrice = bybitConnector.getTicker(symbol)?.lastPrice || 0;
            return {
                symbol,
                price: currentPrice,
                ema200Daily: cached.ema200,
                aboveEma200: currentPrice > cached.ema200,
            };
        }
        
        // Buscar dados diários (200 candles para EMA 200)
        const ohlcDaily = await bybitConnector.fetchKlines(symbol, 'D', 200);
        
        if (ohlcDaily.length < 200) {
            logger.warn(`[MarketContext] Dados insuficientes para ${symbol} Daily, assumindo confirmação positiva`);
            const currentPrice = ohlcDaily[ohlcDaily.length - 1]?.close || 0;
            return { symbol, price: currentPrice, ema200Daily: currentPrice, aboveEma200: true };
        }
        
        const closes = ohlcDaily.map((c: any) => c.close);
        const currentPrice = closes[closes.length - 1];
        
        const ema200 = calculateEMA(closes, 200);
        const lastEma200 = ema200[ema200.length - 1];
        
        // Atualizar cache
        dailyEmaCache.set(symbol, { ema200: lastEma200, timestamp: Date.now() });
        
        const aboveEma200 = currentPrice > lastEma200;
        
        logger.debug(`[MarketContext] ${symbol} Daily: Preço ${currentPrice.toFixed(4)} ${aboveEma200 ? '>' : '<'} EMA200 ${lastEma200.toFixed(4)}`);
        
        return { symbol, price: currentPrice, ema200Daily: lastEma200, aboveEma200 };
        
    } catch (error) {
        logger.error(`[MarketContext] Erro ao buscar confirmação Daily para ${symbol}`, { error });
        // Em caso de erro, não bloqueia o sinal
        return { symbol, price: 0, ema200Daily: 0, aboveEma200: true };
    }
}

// ────────────────────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL: GET MARKET CONTEXT
// ────────────────────────────────────────────────────────────────────────────

/**
 * Busca o contexto completo do mercado (BTC + Fear & Greed)
 * Usa cache de 5 minutos para evitar requisições excessivas
 */
export async function getMarketContext(): Promise<MarketContext> {
    // Verificar cache
    if (cachedMarketContext && Date.now() - lastContextFetch < CONTEXT_CACHE_MS) {
        return cachedMarketContext;
    }
    
    // Buscar dados atualizados
    const [btcData, fearGreed] = await Promise.all([
        getBTCTrend(),
        getFearGreedIndex(),
    ]);
    
    const context: MarketContext = {
        btcTrend: btcData.trend,
        btcPrice: btcData.price,
        fearGreedIndex: fearGreed.value,
        fearGreedLabel: fearGreed.label,
        timestamp: new Date(),
    };
    
    // Atualizar cache
    cachedMarketContext = context;
    lastContextFetch = Date.now();
    
    logger.info('[MarketContext] Contexto atualizado', {
        btcTrend: context.btcTrend,
        btcPrice: context.btcPrice,
        fearGreed: `${context.fearGreedIndex} (${context.fearGreedLabel})`,
    });
    
    return context;
}

// ────────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO DE SINAIS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Valida se um sinal pode ser emitido baseado no contexto de mercado
 * 
 * Retorna:
 * - { allowed: true } se o sinal pode ser emitido
 * - { allowed: false, reason: string } se o sinal deve ser bloqueado
 */
export async function validateSignalContext(
    symbol: string,
    type: 'long' | 'short'
): Promise<{ allowed: boolean; reason?: string }> {
    
    // 0. VETO: Bloqueio de horário institucional (00:00 - 00:45 UTC) para evitar ruído de funding rate e fechamento diário
    const currentHour = new Date().getUTCHours();
    const currentMinutes = new Date().getUTCMinutes();
    if (currentHour === 0 && currentMinutes < 45) {
        return {
            allowed: false,
            reason: `Bloqueio de horário de Funding Rate (00:00 - 00:45 UTC) para evitar ruído no fechamento de velas diárias`,
        };
    }

    // 1. Buscar contexto de mercado
    const context = await getMarketContext();
    
    // 2. VETO: Fear & Greed < config.fearGreedMinLimit (pânico extremo) → bloquear TODOS os sinais
    if (context.fearGreedIndex < config.fearGreedMinLimit) {
        return {
            allowed: false,
            reason: `Fear & Greed ${context.fearGreedIndex} < ${config.fearGreedMinLimit} (pânico extremo - mercado instável)`,
        };
    }
    
    // 3. VETO: Fear & Greed > config.fearGreedMaxLimit (ganância extrema) → bloquear LONGs
    if (type === 'long' && context.fearGreedIndex > config.fearGreedMaxLimit) {
        return {
            allowed: false,
            reason: `Fear & Greed ${context.fearGreedIndex} > ${config.fearGreedMaxLimit} (ganância extrema - topo provável)`,
        };
    }
    
    // Filtros condicionais baseados no sinal contra-tendência
    if (!config.allowCounterTrend) {
        // 4. VETO: BTC em queda/baixa → bloquear LONGs em altcoins
        if (type === 'long' && (context.btcTrend === 'STRONG_DOWN' || context.btcTrend === 'DOWN')) {
            return {
                allowed: false,
                reason: `BTC em tendência de queda (${context.btcTrend}) - altcoins seguem BTC`,
            };
        }
        
        // 5. VETO: BTC em alta → bloquear SHORTs em altcoins
        if (type === 'short' && (context.btcTrend === 'STRONG_UP' || context.btcTrend === 'UP')) {
            return {
                allowed: false,
                reason: `BTC em tendência de alta (${context.btcTrend}) - altcoins seguem BTC`,
            };
        }
        
        // 6. VETO: Confirmação Daily (EMA 200)
        const dailyConfirmation = await getDailyConfirmation(symbol);
        
        if (type === 'long' && !dailyConfirmation.aboveEma200) {
            return {
                allowed: false,
                reason: `Preço abaixo da EMA200 Daily (${dailyConfirmation.price.toFixed(4)} < ${dailyConfirmation.ema200Daily.toFixed(4)})`,
            };
        }
        
        if (type === 'short' && dailyConfirmation.aboveEma200) {
            return {
                allowed: false,
                reason: `Preço acima da EMA200 Daily (${dailyConfirmation.price.toFixed(4)} > ${dailyConfirmation.ema200Daily.toFixed(4)})`,
            };
        }
    }
    
    // ✅ Todos os filtros passaram
    return { allowed: true };
}

/**
 * Limpa o cache (útil para testes)
 */
export function clearCache(): void {
    cachedMarketContext = null;
    lastContextFetch = 0;
    dailyEmaCache.clear();
    logger.debug('[MarketContext] Cache limpo');
}
