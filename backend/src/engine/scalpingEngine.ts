// Scalping Engine — Segundo robô de sinais focado em 5m (entradas rápidas)
// Reescrito: Sistema de Score de Confluência com EMA Ribbon e Divergências de RSI

import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import { bybitConnector } from '../exchange/bybitConnector.js';
import { predictSignal, isModelLoaded } from '../ml/mlPredictionService.js';
import {
    calculateRSI,
    calculateEMA,
    calculateMACD,
    calculateBollingerBands,
    calculateATR,
    calculateADX,
    calculateRVOL,
    calculateVWAP,
    detectFVG,
    detectLiquiditySweep,
    detectOrderBlock,
    detectSwingStructure,
} from './signalEngine.js';
import type { TradeSignal, OHLCPoint } from '../types/trading.js';
import { indicatorLearner } from '../ml/indicatorLearner.js';
import { tradeTracker, getDailyStats, getSymbolStats } from '../trading/tradeTracker.js';
import { validateSignalContext, getDailyConfirmation } from './marketContext.js'; // FASE 3
import { volatilityTracker } from '../services/volatilityTracker.js';
import { marketContextService } from '../lib/marketContextService.js';

// FASE 3: Apenas pares de alta liquidez para scalping
const SCALPING_SYMBOLS = config.scalpingSymbols;

const BLOCKED_HOURS = [4, 7, 9, 10, 20, 21, 22, 23];
const GOOD_HOURS = [3, 6, 8, 12, 13, 14];

// ──── State isolado do robô de scalping ────

let scalpingActiveSignals: TradeSignal[] = [];
let scalpingSignalsSent = 0;
let scalpingSignalsToday = 0;
let scalpingRunning = false;
let scalpingInterval: NodeJS.Timeout | null = null;
let lastScalpingSignalAt: string | null = null;
let enginePausedUntil = 0;

// Cooldown por par: evita spam no mesmo par (30 min por padrão)
const scalpingCooldowns = new Map<string, number>();

// ──── Bônus de Janela (Desativado por solicitação do usuário) ────
function isScalpingTradingWindow(): boolean {
    // Retorna sempre true para remover o bloqueio de horário, mantendo apenas o filtro de liquidez
    return true;
}

function isGoodScalpingHour(): boolean {
    const h = new Date().getUTCHours();
    // Scalping funciona melhor no London open e NY open
    return GOOD_HOURS.includes(h);
}

// ──── Stochastic RSI ────
function calculateStochRSI(closes: number[], rsiPeriod = 14, stochPeriod = 14): { k: number; d: number } {
    if (closes.length < rsiPeriod + stochPeriod + 5) return { k: 50, d: 50 };

    const rsiSeries: number[] = [];
    for (let i = rsiPeriod; i <= closes.length; i++) {
        const slice = closes.slice(i - rsiPeriod - 1, i);
        let avgGain = 0, avgLoss = 0;
        for (let j = 1; j <= rsiPeriod; j++) {
            const diff = slice[j] - slice[j - 1];
            if (diff > 0) avgGain += diff;
            else avgLoss += Math.abs(diff);
        }
        avgGain /= rsiPeriod;
        avgLoss /= rsiPeriod;
        if (avgLoss === 0) { rsiSeries.push(100); continue; }
        const rs = avgGain / avgLoss;
        rsiSeries.push(100 - 100 / (1 + rs));
    }

    if (rsiSeries.length < stochPeriod) return { k: 50, d: 50 };

    const recent = rsiSeries.slice(-stochPeriod);
    const minRSI = Math.min(...recent);
    const maxRSI = Math.max(...recent);
    const k = maxRSI === minRSI ? 50 : ((rsiSeries[rsiSeries.length - 1] - minRSI) / (maxRSI - minRSI)) * 100;

    const kSeries = rsiSeries.slice(-stochPeriod - 2).map((_, idx, arr) => {
        const w = arr.slice(idx, idx + 3);
        if (w.length < 3) return k;
        const mn = Math.min(...w); const mx = Math.max(...w);
        return mx === mn ? 50 : ((arr[idx + 2] - mn) / (mx - mn)) * 100;
    });
    const d = kSeries.slice(-3).reduce((a, b) => a + b, 0) / 3;

    return { k, d };
}

// ──── Retorna Série Completa de RSI (Para detectar divergências) ────
function calculateRSISeries(closes: number[], period = 14): number[] {
    if (closes.length < period + 1) return Array(closes.length).fill(50);
    const rsiSeries: number[] = Array(period).fill(50);
    
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= period; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) avgGain += diff;
        else avgLoss += Math.abs(diff);
    }
    avgGain /= period;
    avgLoss /= period;
    
    for (let i = period; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? Math.abs(diff) : 0;
        
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        
        if (avgLoss === 0) {
            rsiSeries.push(100);
        } else {
            const rs = avgGain / avgLoss;
            rsiSeries.push(100 - (100 / (1 + rs)));
        }
    }
    return rsiSeries;
}

// ──── Detecção de Divergência RSI (Bullish/Bearish) ────
// Verifica se o preço fez um extremo oposto ao do indicador nos últimos "lookback" candles.
function detectRSIDivergence(closes: number[], rsiSeries: number[], type: 'long' | 'short', lookback = 20): boolean {
    if (closes.length < lookback || rsiSeries.length < lookback) return false;
    
    const currentPrice = closes[closes.length - 1];
    const currentRSI = rsiSeries[rsiSeries.length - 1];
    
    const windowCloses = closes.slice(-lookback, -1);
    const windowRSI = rsiSeries.slice(-lookback, -1);
    
    if (type === 'long') {
        // Divergência Bullish (Regular): Preço faz fundo mais baixo, mas RSI faz fundo mais alto
        const minPricePivot = Math.min(...windowCloses);
        const pivotIndex = windowCloses.indexOf(minPricePivot);
        const rsiAtPivot = windowRSI[pivotIndex];
        
        return currentPrice < minPricePivot && currentRSI > rsiAtPivot;
    } else {
        // Divergência Bearish (Regular): Preço faz topo mais alto, mas RSI faz topo mais baixo
        const maxPricePivot = Math.max(...windowCloses);
        const pivotIndex = windowCloses.indexOf(maxPricePivot);
        const rsiAtPivot = windowRSI[pivotIndex];
        
        return currentPrice > maxPricePivot && currentRSI < rsiAtPivot;
    }
}

// ──── Geração de sinal de scalping (SCORE SYSTEM 0 a 10) ────

export function generateScalpingSignal(
    symbol: string,
    ohlc5m: OHLCPoint[],
    ohlc15m: OHLCPoint[],
    currentPrice: number,
    high24h: number,
    low24h: number,
    fundingRate: number,
    indicatorPerf?: Record<string, { winRate: number, avgPnl: number, totalTrades: number }>
): TradeSignal | null {
    if (ohlc5m.length < 50) return null;

    const closes5m = ohlc5m.map(c => c.close);

    // ── Indicadores Básicos (5m) ──
    const rsi = calculateRSI(closes5m, 14);
    const rsiSeries = calculateRSISeries(closes5m, 14); // Nova série RSI para divergência
    const macd = calculateMACD(closes5m);
    const bb = calculateBollingerBands(closes5m, 20, 2);
    const ema9 = calculateEMA(closes5m, 9);
    const ema21 = calculateEMA(closes5m, 21);
    const ema50 = calculateEMA(closes5m, 50);
    const atr = calculateATR(ohlc5m, 14);
    const adx = calculateADX(ohlc5m, 14);
    const rvol = calculateRVOL(ohlc5m, 20);
    const vwap = calculateVWAP(ohlc5m.slice(-50));
    const stochRsi = calculateStochRSI(closes5m);

    // ── VETO BÁSICO ABSOLUTO: Volatilidade Morta ──
    // Se o ativo não tem variação alguma, scalping resultará apenas no pagamento de taxas (spread).
    const atrPct = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;
    if (atrPct < 0.3) {
        logger.debug(`[SCALPING-DIAG] ${symbol} ❌ VETO: Volatilidade morta (ATR < 0.3%)`);
        return null;
    }

    // Calcular volatility_24h e verificar volatilidade alta
    const volatility_24h = high24h > 0 ? ((high24h - low24h) / ((high24h + low24h) / 2)) * 100 : 0;
    volatilityTracker.record(symbol, atrPct, volatility_24h);
    const volCheck = volatilityTracker.isHighVolatility(symbol, atrPct, volatility_24h, 1.4); // 1.4x para scalping
    if (volCheck.isHigh) {
        logger.debug(`[SCALPING-DIAG] ${symbol} ❌ VETO VOLATILIDADE ALTA: ${volCheck.reason}`);
        return null;
    }

    // VETO: Volume consistente muito baixo
    let lowVolCount = 0;
    for (let i = Math.max(0, ohlc5m.length - 5); i < ohlc5m.length; i++) {
        if (calculateRVOL(ohlc5m.slice(0, i + 1), 20) < 0.7) lowVolCount++;
    }
    if (lowVolCount >= 3) {
        logger.debug(`[SCALPING-DIAG] ${symbol} ❌ Veto volume baixo consistente: >3/5 candles com RVOL < 0.7`);
        return null;
    }

    const lastEma9 = ema9[ema9.length - 1] || currentPrice;
    const lastEma21 = ema21[ema21.length - 1] || currentPrice;
    const lastEma50 = ema50[ema50.length - 1] || currentPrice;

    // ── MUDANÇA: EMA Ribbon como Critério Direcional Principal ──
    const isBullishRibbon = lastEma9 > lastEma21 && lastEma21 > lastEma50;
    const isBearishRibbon = lastEma9 < lastEma21 && lastEma21 < lastEma50;

    let type: 'long' | 'short';
    if (isBullishRibbon) {
        type = 'long';
    } else if (isBearishRibbon) {
        type = 'short';
    } else {
        // Se as EMAs estão emboladas, mercado está em consolidação/ruído
        logger.debug(`[SCALPING-DIAG] ${symbol} ❌ VETO DIREÇÃO: Sem EMA Ribbon alinhada (Mercado Lateral)`);
        return null;
    }

    // ── MUDANÇA: Invalidação Suave do 15M (MTF) ──
    if (ohlc15m.length >= 30) {
        const closes15m = ohlc15m.map(c => c.close);
        const lastEma50_15m = calculateEMA(closes15m, 50).pop() || currentPrice;
        const macd15m = calculateMACD(closes15m);
        
        // Veta SOMENTE se o preço e o momento (MACD) estiverem ativamente contra a nossa direção
        if (type === 'long') {
            if (currentPrice < lastEma50_15m && macd15m.histogram < 0) {
                logger.debug(`[SCALPING-DIAG] ${symbol} ❌ VETO MTF: 15M fortemente oposto (Preço < EMA50 e MACD < 0)`);
                return null;
            }
        } else {
            if (currentPrice > lastEma50_15m && macd15m.histogram > 0) {
                logger.debug(`[SCALPING-DIAG] ${symbol} ❌ VETO MTF: 15M fortemente oposto (Preço > EMA50 e MACD > 0)`);
                return null;
            }
        }
    }

    // ── Smart Money Concepts (5m) - Usados como Bônus no novo sistema ──
    const { isBullishFvg, isBearishFvg } = detectFVG(ohlc5m);
    const { isSweepLow, isSweepHigh } = detectLiquiditySweep(ohlc5m, high24h, low24h);
    const { bullishOB, bearishOB, priceInBullishOB, priceInBearishOB } = detectOrderBlock(ohlc5m, atr);
    const { swingLow, swingHigh } = detectSwingStructure(ohlc5m, 10);

    // ── MUDANÇA: Confluências Básicas (Requisito 4/7 para pontos base) ──
    const bullishIndicators = [
        currentPrice > lastEma9, // Pullback se encostou na EMA9
        macd.histogram > 0,      // Momento subindo
        rsi > 40,                // RSI em território aceitável
        currentPrice > vwap,     // Preço acima do valor institucional
        rvol > 1.0,              // Volume apoiando
        stochRsi.k < 80,         // Tem margem para subir
        macd.isBullishCross      // Acabou de cruzar (Gatilho)
    ];

    const bearishIndicators = [
        currentPrice < lastEma9,
        macd.histogram < 0,
        rsi < 60,
        currentPrice < vwap,
        rvol > 1.0,
        stochRsi.k > 20,
        macd.isBearishCross
    ];

    const bullishCount = bullishIndicators.filter(Boolean).length;
    const bearishCount = bearishIndicators.filter(Boolean).length;

    let rawScore = 0; // Escala 0 a 10
    const confluences: string[] = [];

    // O critério direcional já nos deu o tipo. Somamos 1 ponto por indicador válido.
    if (type === 'long') {
        if (bullishCount < 3) { // Reduzido de 4/7 para 3/7 a pedido do usuário
            logger.debug(`[SCALPING-DIAG] ${symbol} ❌ VETO BASE: Confluência fraca (${bullishCount}/7)`);
            return null;
        }
        rawScore += bullishCount; // 4 a 7 pontos
        confluences.push(`${bullishCount}/7 ind. bullish base`);
    } else {
        if (bearishCount < 3) {
            logger.debug(`[SCALPING-DIAG] ${symbol} ❌ VETO BASE: Confluência fraca (${bearishCount}/7)`);
            return null;
        }
        rawScore += bearishCount; // 4 a 7 pontos
        confluences.push(`${bearishCount}/7 ind. bearish base`);
    }

    // ── Bônus 1: Sessão de Pico de Liquidez (+1 Ponto) ──
    if (isGoodScalpingHour()) {
        rawScore += 1;
        confluences.push('Horário premium +1');
    }

    // ── Bônus 2: Divergência de RSI (Substitui o Veto Rígido do RSI) (+2 Pontos) ──
    if (type === 'long' && detectRSIDivergence(closes5m, rsiSeries, 'long', 20)) {
        rawScore += 2;
        confluences.push('Divergência RSI Bullish +2');
    }
    if (type === 'short' && detectRSIDivergence(closes5m, rsiSeries, 'short', 20)) {
        rawScore += 2;
        confluences.push('Divergência RSI Bearish +2');
    }

    // ── Bônus 3: Smart Money (ICT) (+1 a +2 Pontos máx) ──
    let ictScore = 0;
    if (type === 'long') {
        if (isSweepLow) { ictScore += 1; confluences.push('Liquidity Sweep Low +1'); }
        if (priceInBullishOB) { ictScore += 1; confluences.push('Price in OB +1'); }
        if (isBullishFvg) { ictScore += 1; confluences.push('Bullish FVG +1'); }
    } else {
        if (isSweepHigh) { ictScore += 1; confluences.push('Liquidity Sweep High +1'); }
        if (priceInBearishOB) { ictScore += 1; confluences.push('Price in OB +1'); }
        if (isBearishFvg) { ictScore += 1; confluences.push('Bearish FVG +1'); }
    }
    rawScore += Math.min(ictScore, 2); // Capa o limite de ICT para não distorcer o teto do score

    // --- Lógica de Aprendizado de Máquina Dinâmica ---
    // (Bônus/Penalidade baseada na eficácia histórica do indicador, agora ponderado em +/- 1 ponto)
    if (indicatorPerf) {
        for (const ind of confluences) {
            const cleanName = ind.replace(/[✅❌⚡🐋\+0-9]/g, '').trim();
            const perf = indicatorPerf[cleanName];
            if (perf && perf.totalTrades >= 3) {
                if (perf.winRate > 0.6) {
                    rawScore += 1;
                    logger.debug(`[LEARNER-SCALP] ${symbol} 👍 Bônus ind: ${cleanName}`);
                } else if (perf.winRate < 0.4) {
                    rawScore -= 1;
                    logger.debug(`[LEARNER-SCALP] ${symbol} 👎 Penálti ind: ${cleanName}`);
                }
            }
        }
    }

    // Cap global: Limita o score cru em 10 pontos
    rawScore = Math.max(0, Math.min(rawScore, 10));

    // ── VETO FINAL DE SCORE ──
    // Requisito solicitado: Gerar sinal apenas quando Score >= 5
    if (rawScore < 5) {
        logger.debug(`[SCALPING-DIAG] ${symbol} ❌ VETO SCORE: Pontuação final ${rawScore}/10 é insuficiente.`);
        return null;
    }

    // ── MUDANÇA: Multiplicar por 10 para compatibilidade com sistema legado (0-100) ──
    const finalScore = rawScore * 10;

    // ── Stop Loss e Take Profits para scalping ──
    const atrPercent = currentPrice > 0 ? (atr / currentPrice * 100) : 0.5;
    let stopLossDistance: number;
    let usingStructuralStop = false;
    let obEntryLow = currentPrice * 0.998;
    let obEntryHigh = currentPrice * 1.002;

    if (type === 'long' && priceInBullishOB && bullishOB) {
        const structuralStop = Math.min(swingLow, bullishOB.low) * 0.999;
        stopLossDistance = Math.max(((currentPrice - structuralStop) / currentPrice) * 100, 0.3);
        obEntryLow = bullishOB.low; obEntryHigh = bullishOB.high;
        usingStructuralStop = true;
    } else if (type === 'short' && priceInBearishOB && bearishOB) {
        const structuralStop = Math.max(swingHigh, bearishOB.high) * 1.001;
        stopLossDistance = Math.max(((structuralStop - currentPrice) / currentPrice) * 100, 0.3);
        obEntryLow = bearishOB.low; obEntryHigh = bearishOB.high;
        usingStructuralStop = true;
    } else if (type === 'long' && isSweepLow) {
        const lowestWick = ohlc5m[ohlc5m.length - 1].low;
        stopLossDistance = Math.max(((currentPrice - lowestWick) / currentPrice * 100) * 1.05, 0.3);
    } else if (type === 'short' && isSweepHigh) {
        const highestWick = ohlc5m[ohlc5m.length - 1].high;
        stopLossDistance = Math.max(((highestWick - currentPrice) / currentPrice * 100) * 1.05, 0.3);
    } else {
        const volatilityMultiplier = rvol > 1.5 ? 1.1 : 1.0;
        stopLossDistance = Math.max(atrPercent * volatilityMultiplier, 0.5);
    }

    let tp1Distance: number, tp2Distance: number, tp3Distance: number;
    if (usingStructuralStop) {
        tp1Distance = stopLossDistance * 2.0;
        tp2Distance = stopLossDistance * 3.0;
        tp3Distance = stopLossDistance * 4.5;
    } else if (isSweepLow || isSweepHigh) {
        tp1Distance = stopLossDistance * 2.0;
        tp2Distance = stopLossDistance * 3.0;
        tp3Distance = stopLossDistance * 4.0;
    } else {
        const tpScale = bb.isSqueeze ? 1.3 : 1.0;
        tp1Distance = stopLossDistance * 2.0 * tpScale;
        tp2Distance = stopLossDistance * 3.0 * tpScale;
        tp3Distance = stopLossDistance * 4.5 * tpScale;
    }

    let entry: number, stopLoss: number, tp1: number, tp2: number, tp3: number;
    if (type === 'long') {
        entry = currentPrice;
        stopLoss = currentPrice * (1 - stopLossDistance / 100);
        tp1 = currentPrice * (1 + tp1Distance / 100);
        tp2 = currentPrice * (1 + tp2Distance / 100);
        tp3 = currentPrice * (1 + tp3Distance / 100);
    } else {
        entry = currentPrice;
        stopLoss = currentPrice * (1 + stopLossDistance / 100);
        tp1 = currentPrice * (1 - tp1Distance / 100);
        tp2 = currentPrice * (1 - tp2Distance / 100);
        tp3 = currentPrice * (1 - tp3Distance / 100);
    }

    const riskReward = tp1Distance / stopLossDistance;
    if (riskReward < 1.0) return null;

    const accountRiskLevel = config.riskManagement.riskPercent;
    const marginPercent = config.riskManagement.marginPercent;
    let dynamicLeverage = Math.round((accountRiskLevel / stopLossDistance) / (marginPercent / 100));
    
    // Ajusta a alavancagem com base no novo finalScore (0-100)
    if (finalScore >= 80) dynamicLeverage = Math.round(dynamicLeverage * 1.2);
    else if (finalScore < 70) dynamicLeverage = Math.round(dynamicLeverage * 0.8);
    if (rvol > 2.0) dynamicLeverage = Math.round(dynamicLeverage * 0.85);
    
    if (dynamicLeverage < 3) dynamicLeverage = 3;
    if (dynamicLeverage > 25) dynamicLeverage = 25;

    return {
        id: `SCALP-${symbol}-${Date.now()}`,
        pair: symbol,
        type,
        entry,
        takeProfit: tp1,
        takeProfit1: tp1,
        takeProfit2: tp2,
        takeProfit3: tp3,
        stopLoss,
        riskReward: Math.round(riskReward * 10) / 10,
        dynamicLeverage,
        positionSizePercent: marginPercent,
        riskPercent: accountRiskLevel,
        timeframe: '5m',
        status: 'PENDING',
        confidence: finalScore, // Escala convertida para 0-100
        createdAt: new Date(),
        indicators: confluences,
        quality: { score: finalScore, factors: confluences },
        tradeType: 'Scalping',
        expectedDuration: '15-60 minutos',
        mtfContext: {
            macro: [`Ema Ribbon: ${type.toUpperCase()}`],
            medium: [`StochRSI K: ${stochRsi.k.toFixed(1)}`],
            micro: [`BB %B: ${(bb.percentB * 100).toFixed(0)}% | Squeeze: ${bb.isSqueeze ? '✅' : '❌'}`],
        },
        contextNarrative: `Scalping ${type.toUpperCase()} ${symbol} (5m) — ${rawScore}/10 Pontos: ${confluences.slice(0, 3).join(', ')}. R:R ${riskReward.toFixed(1)}:1 com SL de ${stopLossDistance.toFixed(2)}%.`,
        obEntryZone: usingStructuralStop ? { low: obEntryLow, high: obEntryHigh } : null,
        smartMoney: {
            orderBlocks: usingStructuralStop ? [{ type, high: obEntryHigh, low: obEntryLow, midpoint: (obEntryLow + obEntryHigh) / 2 }] : [],
            fvgs: [],
            liquidity: [],
            isLiquiditySweep: isSweepHigh || isSweepLow,
            fvgZone: isBullishFvg || isBearishFvg,
            isOrderBlock: usingStructuralStop,
        },
        mlData: {
            rsi,
            adx,
            atr_rel: atr / currentPrice,
            dist_ema20: (currentPrice - lastEma21) / currentPrice,
            dist_ema50: (currentPrice - lastEma50) / currentPrice,
            dist_ema200: 0,
            dist_vwap: (currentPrice - vwap) / currentPrice,
            volume_rel: rvol,
        },
    } satisfies TradeSignal;
}

// ──── Ciclo principal de scalping ────

async function runScalpingCycle(): Promise<void> {
    logger.info('[Scalping] Running scalping signal cycle...');
    const globalCtx = await marketContextService.getGlobalContext();

    // FASE 1: Limite diário reduzido de 8 para 5 (qualidade > quantidade)
    if (scalpingSignalsToday >= 5) {
        logger.info('[Scalping] Limite diário de 5 sinais atingido. Aguardando próximo dia.');
        return;
    }

    if (Date.now() < enginePausedUntil) {
        logger.info(`[Scalping] Pausado temporariamente (Restam ${Math.round((enginePausedUntil - Date.now()) / 60000)} min)`);
        return;
    }

    const dailyStats = await getDailyStats();
    if (dailyStats.losses >= 3 && dailyStats.winRate < 0.30) {
        enginePausedUntil = Date.now() + 2 * 60 * 60 * 1000;
        logger.info(`[Scalping] Pausado por sequência de losses: ${dailyStats.losses} losses hoje, WR=${(dailyStats.winRate * 100).toFixed(1)}%`);
        return;
    }

    // FASE 3: Usar apenas pares de alta liquidez
    const symbols = SCALPING_SYMBOLS;
    const now = Date.now();

    for (const symbol of symbols) {
        if (!isScalpingTradingWindow()) {
            logger.debug(`[SCALPING] Horário bloqueado (${new Date().getUTCHours()}h UTC) — aguardando janela`);
            break; // Sai do loop já que o bloqueio é global pelo horário
        }

        try {
            const lastSignalTime = scalpingCooldowns.get(symbol) || 0;
            if (now - lastSignalTime < config.scalpingBot.cooldownMs) {
                logger.debug(`[Scalping] ${symbol} em cooldown (${Math.round((config.scalpingBot.cooldownMs - (now - lastSignalTime)) / 60000)}min restante)`);
                continue;
            }

            const symStats = await getSymbolStats(symbol);
            const isBadCoin = symStats.total >= 5 && symStats.winRate < 0.20;
            if (isBadCoin) {
                logger.info(`[Scalping] Símbolo ${symbol} identificado com baixo WR histórico (${(symStats.winRate * 100).toFixed(1)}% em ${symStats.total} sinais), prosseguindo apenas para análise.`);
            }

            const [ohlc5m, ohlc15m] = await Promise.all([
                bybitConnector.fetchKlines(symbol, '5', 100),
                bybitConnector.fetchKlines(symbol, '15', 50),
            ]);

            if (ohlc5m.length < 50) continue;

            const ticker = bybitConnector.getTicker(symbol);
            const currentPrice = ticker?.lastPrice || ohlc5m[ohlc5m.length - 1].close;
            const high24h = ticker?.highPrice24h || Math.max(...ohlc5m.slice(-25).map(c => c.high));
            const low24h = ticker?.lowPrice24h || Math.min(...ohlc5m.slice(-25).map(c => c.low));
            const fundingRate = parseFloat(ticker?.fundingRate || '0');

            const perf = await indicatorLearner.getPairPerformance(symbol);

            const signal = generateScalpingSignal(symbol, ohlc5m, ohlc15m, currentPrice, high24h, low24h, fundingRate, perf);

            if (!signal) continue;

            if (isBadCoin) {
                signal.indicators = ['⚠️ Moeda Ruim (WR < 20%)', ...signal.indicators];
                signal.contextNarrative = `⚠️ <b>MOEDA COM HISTÓRICO RUIM (Win Rate: ${(symStats.winRate * 100).toFixed(1)}% em ${symStats.total} sinais)</b>. Gerada apenas para análise. ${signal.contextNarrative || ''}`;
                signal.status = 'BLOCKED';
            }

            // FASE 3: Validar contexto de mercado ANTES de processar o sinal
            const contextValidation = await validateSignalContext(symbol, signal.type);
            if (!contextValidation.allowed) {
                logger.debug(`[Scalping] ${symbol} ${signal.type.toUpperCase()} vetado por contexto: ${contextValidation.reason}`);
                continue;
            }

            // Buscar a confirmação diária para calcular a distância real até a EMA200 Daily
            const dailyConfirmation = await getDailyConfirmation(symbol);
            const ema200val = dailyConfirmation.ema200Daily;
            const dist_ema200 = ema200val > 0 ? ((currentPrice - ema200val) / ema200val) * 100 : 0;

            // Enriquecer dados do ML com o vetor completo de 24 features
            if (signal.mlData) {
                const precomputed = signal.mlData as any;
                const features = {
                    rsi:        precomputed.rsi        ?? 50,
                    adx:        precomputed.adx        ?? 25,
                    atr_rel:    precomputed.atr_rel    ?? 0,
                    dist_ema20: precomputed.dist_ema20 ?? 0,
                    dist_ema50: precomputed.dist_ema50 ?? 0,
                    dist_ema200: dist_ema200,
                    dist_vwap:  precomputed.dist_vwap  ?? 0,
                    volatility_24h: high24h > 0 ? (high24h - low24h) / ((high24h + low24h) / 2) * 100 : 0,
                    volume_rel: precomputed.volume_rel ?? 1,
                    funding_rate: fundingRate,
                    open_interest_var: await marketContextService.getOpenInterestVar(symbol),
                    long_short_ratio: 1,
                    is_long: signal.type === 'long' ? 1 : 0,
                    confidence: signal.confidence / 100,
                    quality_score: (signal.quality?.score ?? signal.confidence) / 100,
                    confluence_count: signal.indicators.length,
                    stop_loss_pct: Math.abs(signal.entry - signal.stopLoss) / signal.entry * 100,
                    take_profit_pct: Math.abs(signal.takeProfit - signal.entry) / signal.entry * 100,
                    risk_reward: signal.riskReward,
                    hour_of_day: new Date().getHours(),
                    day_of_week: new Date().getDay(),
                    btc_trend: globalCtx.btcTrend,
                    dominance_btc: globalCtx.dominanceBtc,
                    fear_greed: globalCtx.fearGreed,
                };
                signal.mlData = { ...features };
            }

            if (isModelLoaded() && signal.mlData) {
                try {
                    const prediction = await predictSignal(signal.mlData as unknown as Parameters<typeof predictSignal>[0], symbol, 'scalping');
                    if (prediction) {
                        signal.mlData = {
                            ...signal.mlData,
                            probability: prediction.probability,
                            predictedClass: prediction.predictedClass,
                            modelSource: prediction.modelSource,
                            isFiltered: prediction.probability < 0.5,
                        };
                        
                        const { getAdaptiveThreshold } = await import('../ml/mlPredictionService.js');
                        const { getRecentGlobalWinRate } = await import('../trading/tradeTracker.js');
                        const recentWR = await getRecentGlobalWinRate();
                        const threshold = getAdaptiveThreshold(recentWR);

                        if (prediction.probability < threshold) {
                            logger.debug(`[Scalping] ${symbol} filtrado pelo ML (prob: ${prediction.probability.toFixed(3)} < ${threshold.toFixed(2)}). Marking as BLOCKED for analysis.`);
                            signal.status = 'BLOCKED';
                            signal.indicators = ['⚠️ Rejeitado por IA (Confiança Baixa)', ...signal.indicators];
                            signal.contextNarrative = `⚠️ <b>SINAL VETADO PELA INTELIGÊNCIA ARTIFICIAL (Confiança: ${(prediction.probability * 100).toFixed(1)}% < ${(threshold * 100).toFixed(1)}%)</b>. Gerado apenas para fins de análise e estudos estatísticos. ${signal.contextNarrative || ''}`;
                        }
                    }
                } catch (mlError) {
                    logger.warn(`[Scalping] ML enrichment falhou para ${symbol}`, { error: mlError });
                }
            }

            const existingActive = scalpingActiveSignals.find(s => s.pair === symbol);
            if (existingActive) {
                logger.debug(`[Scalping] Skipping signal for ${symbol} - already has an active scalping signal (${existingActive.id})`);
                continue;
            }

            scalpingActiveSignals = [signal, ...scalpingActiveSignals].slice(0, 30);
            scalpingSignalsToday++;
            lastScalpingSignalAt = new Date().toISOString();
            scalpingCooldowns.set(symbol, now);

            // Envia para o canal de scalping
            if (config.scalpingBot.chatId) {
                try {
                    const { telegramService } = await import('../notifications/telegramService.js');
                    if (telegramService.isEnabled && (signal.status === 'BLOCKED' || signal.confidence >= config.telegram.minScore)) {
                        await telegramService.sendScalpingSignal(signal);
                        scalpingSignalsSent++;
                        logger.info(`[Scalping] Sinal enviado (${signal.status}): ${signal.type.toUpperCase()} ${symbol} | score=${signal.confidence}`);
                    }
                } catch (tError) {
                    logger.warn(`[Scalping] Falha ao enviar telegram para ${symbol}`, { error: tError });
                }
            }

            // Injeta no Gestor de Posições (Trade Tracker Principal)
            try {
                const tps: { level: number, price: number, hit: boolean }[] = [];
                if (signal.takeProfit1) tps.push({ level: 1, price: signal.takeProfit1, hit: false });
                if (signal.takeProfit2) tps.push({ level: 2, price: signal.takeProfit2, hit: false });
                if (signal.takeProfit3) tps.push({ level: 3, price: signal.takeProfit3, hit: false });
                if (tps.length === 0) tps.push({ level: 1, price: signal.takeProfit, hit: false });

                tradeTracker.registerNewSignal({
                    id: signal.id,
                    pair: signal.pair,
                    type: signal.type.toUpperCase() as 'LONG' | 'SHORT',
                    trade_type: 'Scalping',
                    entry_range_low: signal.entry * 0.999,
                    entry_range_high: signal.entry * 1.001,
                    stop_loss: signal.stopLoss,
                    initial_stop_loss: signal.stopLoss,
                    take_profits: tps,
                    status: signal.status as 'PENDING' | 'BLOCKED',
                    expected_duration: signal.expectedDuration,
                    score: signal.confidence,
                    indicators: signal.indicators,
                    mlData: signal.mlData,
                }).catch((e: unknown) => logger.warn(`[Scalping/TradeTracker] Erro ao registrar: ${e instanceof Error ? e.message : String(e)}`));
            } catch (trackError) {
                logger.warn(`[Scalping] Falha ao injetar no TradeTracker para ${symbol}`, { error: trackError });
            }

        } catch (error) {
            logger.error(`[Scalping] Erro ao processar ${symbol}`, { error });
        }
    }

    logger.info(`[Scalping] Ciclo concluído | sinais hoje: ${scalpingSignalsToday} | enviados: ${scalpingSignalsSent}`);
}

// ──── Public API ────

export function startScalpingEngine(): void {
    if (scalpingRunning) return;
    if (!config.scalpingBot.enabled) {
        logger.info('[Scalping] Motor de scalping DESABILITADO (SCALPING_BOT_ENABLED != true)');
        return;
    }
    if (!config.scalpingBot.chatId) {
        logger.warn('[Scalping] TELEGRAM_SCALPING_CHAT_ID não configurado — scalping não iniciará');
        return;
    }

    scalpingRunning = true;
    scalpingSignalsToday = 0;
    scalpingSignalsSent = 0;

    setTimeout(() => {
        runScalpingCycle().catch(err => logger.error('[Scalping] Cycle error', { error: err }));
        scalpingInterval = setInterval(() => {
            runScalpingCycle().catch(err => logger.error('[Scalping] Cycle error', { error: err }));
        }, config.scalpingBot.intervalMs);

        logger.info(`[Scalping] ⚡ Motor de scalping iniciado | intervalo: ${config.scalpingBot.intervalMs / 1000}s | canal: ${config.scalpingBot.chatId}`);
    }, 30000);
}

export function stopScalpingEngine(): void {
    if (scalpingInterval) clearInterval(scalpingInterval);
    scalpingRunning = false;
    logger.info('[Scalping] Motor de scalping parado');
}

export function getActiveScalpingSignals(): TradeSignal[] {
    return scalpingActiveSignals;
}

export function getScalpingStats() {
    return {
        running: scalpingRunning,
        signalsToday: scalpingSignalsToday,
        signalsSent: scalpingSignalsSent,
        lastSignalAt: lastScalpingSignalAt,
        activeCount: scalpingActiveSignals.length,
        cooldownCount: scalpingCooldowns.size,
        config: {
            intervalMs: config.scalpingBot.intervalMs,
            minScore: config.scalpingBot.minScore,
            mlMinProb: config.scalpingBot.mlMinProb,
            cooldownMs: config.scalpingBot.cooldownMs,
        },
    };
}
