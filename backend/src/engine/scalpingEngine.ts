// Scalping Engine — Segundo robô de sinais focado em 5m (entradas rápidas)
// Reutiliza funções de cálculo do signalEngine, mas com parâmetros adaptados para TF curto.

import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import { bybitConnector } from '../exchange/bybitConnector.js';
import { predictSignal, isModelLoaded, getSymbolId } from '../ml/mlPredictionService.js';
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

// ──── State isolado do robô de scalping ────

let scalpingActiveSignals: TradeSignal[] = [];
let scalpingSignalsSent = 0;
let scalpingSignalsToday = 0;
let scalpingRunning = false;
let scalpingInterval: NodeJS.Timeout | null = null;
let lastScalpingSignalAt: string | null = null;

// Cooldown por par: evita spam no mesmo par (30 min por padrão)
const scalpingCooldowns = new Map<string, number>();

// ──── Filtro de Horário para Scalping ────
// Foca nas sessões de maior liquidez: London (08–12 UTC) e Nova York (13–20 UTC).
// O overlap London-NY (13–16 UTC) é o melhor momento para scalping de cripto.
// Fora dessas janelas, spreads ficam maiores e fake-outs são mais frequentes.

function isScalpingTradingWindow(): boolean {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();

    // Sessão London: 08:00–12:59 UTC
    const isLondon = utcHour >= 8 && utcHour < 13;
    // Sessão NY: 13:00–19:59 UTC
    const isNewYork = utcHour >= 13 && utcHour < 20;
    // Abertura Asia (00–02 UTC): alta volatilidade de cripto também
    const isAsiaOpen = utcHour >= 0 && utcHour < 2;

    // Dentro de uma sessão líquida
    if (!isLondon && !isNewYork && !isAsiaOpen) return false;

    // Bloqueia primeiros 10 min de cada sessão (spike de abertura não é sinal)
    const isSessionOpen =
        (utcHour === 8 && utcMinute < 10) ||   // Abertura London
        (utcHour === 13 && utcMinute < 10) ||  // Abertura NY
        (utcHour === 0 && utcMinute < 10);     // Abertura Ásia

    return !isSessionOpen;
}

// ──── Stochastic RSI — Rápido para scalping ────

function calculateStochRSI(closes: number[], rsiPeriod = 14, stochPeriod = 14): { k: number; d: number } {
    if (closes.length < rsiPeriod + stochPeriod + 5) return { k: 50, d: 50 };

    // Calcula série de RSI
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

    // Stochastic sobre o RSI
    const recent = rsiSeries.slice(-stochPeriod);
    const minRSI = Math.min(...recent);
    const maxRSI = Math.max(...recent);
    const k = maxRSI === minRSI ? 50 : ((rsiSeries[rsiSeries.length - 1] - minRSI) / (maxRSI - minRSI)) * 100;

    // D = média dos últimos 3 K
    const kSeries = rsiSeries.slice(-stochPeriod - 2).map((_, idx, arr) => {
        const w = arr.slice(idx, idx + 3);
        if (w.length < 3) return k;
        const mn = Math.min(...w); const mx = Math.max(...w);
        return mx === mn ? 50 : ((arr[idx + 2] - mn) / (mx - mn)) * 100;
    });
    const d = kSeries.slice(-3).reduce((a, b) => a + b, 0) / 3;

    return { k, d };
}

// ──── Geração de sinal de scalping ────

function generateScalpingSignal(
    symbol: string,
    ohlc5m: OHLCPoint[],
    ohlc15m: OHLCPoint[],
    currentPrice: number,
    high24h: number,
    low24h: number,
    fundingRate: number,
): TradeSignal | null {
    if (ohlc5m.length < 50) return null;
    if (!isScalpingTradingWindow()) {
        logger.debug(`[SCALPING-DIAG] ${symbol} ❌ BLOQUEADO: Fora da janela de scalping`);
        return null;
    }

    const closes5m = ohlc5m.map(c => c.close);

    // ── Indicadores no 5m ──
    const rsi = calculateRSI(closes5m, 14);
    const macd = calculateMACD(closes5m);
    const bb = calculateBollingerBands(closes5m, 20, 2);
    const ema9 = calculateEMA(closes5m, 9);
    const ema21 = calculateEMA(closes5m, 21);
    const ema50 = calculateEMA(closes5m, 50);
    const atr = calculateATR(ohlc5m, 14);
    const adx = calculateADX(ohlc5m, 14); // Calculado com dados reais (era fixo em 25)
    const rvol = calculateRVOL(ohlc5m, 20);
    const vwap = calculateVWAP(ohlc5m.slice(-50)); // VWAP da sessão recente
    const stochRsi = calculateStochRSI(closes5m);

    const lastEma9 = ema9[ema9.length - 1] || currentPrice;
    const lastEma21 = ema21[ema21.length - 1] || currentPrice;
    const lastEma50 = ema50[ema50.length - 1] || currentPrice;

    // ── Confirmação 15m ──
    let rsi15 = 50;
    let macd15Bullish = false;
    if (ohlc15m.length >= 30) {
        const closes15m = ohlc15m.map(c => c.close);
        rsi15 = calculateRSI(closes15m, 14);
        const macd15 = calculateMACD(closes15m);
        macd15Bullish = macd15.histogram > 0;
    }

    // ── Smart Money (5m) ──
    const { isBullishFvg, isBearishFvg } = detectFVG(ohlc5m);
    const { isSweepLow, isSweepHigh } = detectLiquiditySweep(ohlc5m, high24h, low24h);
    const { bullishOB, bearishOB, priceInBullishOB, priceInBearishOB } = detectOrderBlock(ohlc5m, atr);
    const { swingLow, swingHigh } = detectSwingStructure(ohlc5m, 10);

    // ── Score de confluências ──
    // CORRIGIDO: faixas RSI e StochRSI não se sobrepõem mais (zona cinzenta entre 45–55 era ambígua).
    // Bullish exige RSI claramente abaixo da zona neutra (< 48), bearish acima (> 52).
    const bullishIndicators = [
        currentPrice > lastEma9,
        currentPrice > lastEma21,
        macd.histogram > 0,
        rsi < 48 && rsi > 25,   // Abaixo da linha neutra (sem sobreposição com bearish)
        currentPrice > vwap,
        rvol > 1.1,
        stochRsi.k < 45 && stochRsi.k > 15,  // Zona claramente comprada (sem sobreposição)
    ];

    const bearishIndicators = [
        currentPrice < lastEma9,
        currentPrice < lastEma21,
        macd.histogram < 0,
        rsi > 52 && rsi < 75,   // Acima da linha neutra (sem sobreposição com bullish)
        currentPrice < vwap,
        rvol > 1.1,
        stochRsi.k > 55 && stochRsi.k < 85,  // Zona claramente sobrecomprada (sem sobreposição)
    ];

    const bullishCount = bullishIndicators.filter(Boolean).length;
    const bearishCount = bearishIndicators.filter(Boolean).length;

    logger.debug(`[SCALPING-DIAG] ${symbol} | bull:${bullishCount} bear:${bearishCount} | RSI:${rsi.toFixed(1)} RVOL:${rvol.toFixed(2)} StochK:${stochRsi.k.toFixed(1)}`);

    // Scalping agora exige no mínimo 5/7 confluências para aumentar a assertividade
    let type: 'long' | 'short';
    let score: number;
    const confluences: string[] = [];

    if (bullishCount >= 5) {
        type = 'long';

        // Vetos absolutos de qualidade para scalping
        if (rsi > 70) { logger.debug(`[SCALPING-DIAG] ${symbol} ❌ LONG vetado: RSI=${rsi.toFixed(1)} sobrecomprado`); return null; }
        if (rvol < 0.8) { logger.debug(`[SCALPING-DIAG] ${symbol} ❌ LONG vetado: RVOL baixo (< 0.8)`); return null; }
        if (rsi15 > 70) { logger.debug(`[SCALPING-DIAG] ${symbol} ❌ LONG vetado: RSI15m sobrecomprado`); return null; }
        if (stochRsi.k > 80) { logger.debug(`[SCALPING-DIAG] ${symbol} ❌ LONG vetado: StochRSI sobrecomprado`); return null; }
        if (currentPrice < lastEma50) { logger.debug(`[SCALPING-DIAG] ${symbol} ❌ LONG vetado: Preço abaixo da EMA 50`); return null; }

        score = 40 + bullishCount * 5; // Base menor (máx 75) para exigir múltiplos bônus de SMC/Squeeze
        confluences.push(`${bullishCount}/7 ind. bullish (5m)`);

    } else if (bearishCount >= 5) {
        type = 'short';

        if (rsi < 30) { logger.debug(`[SCALPING-DIAG] ${symbol} ❌ SHORT vetado: RSI=${rsi.toFixed(1)} sobrevendido`); return null; }
        if (rvol < 0.8) { logger.debug(`[SCALPING-DIAG] ${symbol} ❌ SHORT vetado: RVOL baixo (< 0.8)`); return null; }
        if (rsi15 < 30) { logger.debug(`[SCALPING-DIAG] ${symbol} ❌ SHORT vetado: RSI15m sobrevendido`); return null; }
        if (stochRsi.k < 20) { logger.debug(`[SCALPING-DIAG] ${symbol} ❌ SHORT vetado: StochRSI sobrevendido`); return null; }
        if (currentPrice > lastEma50) { logger.debug(`[SCALPING-DIAG] ${symbol} ❌ SHORT vetado: Preço acima da EMA 50`); return null; }

        score = 40 + bearishCount * 5; // Base menor (máx 75) para exigir múltiplos bônus
        confluences.push(`${bearishCount}/7 ind. bearish (5m)`);

    } else {
        logger.debug(`[SCALPING-DIAG] ${symbol} ❌ Sem confluência: bull=${bullishCount} bear=${bearishCount}`);
        return null;
    }

    // ── Bônus de confluências ──

    // StochRSI extremos (mais peso em scalping)
    if (type === 'long' && stochRsi.k < 25) { score += 10; confluences.push('StochRSI Oversold'); }
    if (type === 'short' && stochRsi.k > 75) { score += 10; confluences.push('StochRSI Overbought'); }

    // RSI clássico oversold/overbought
    if (type === 'long' && rsi < 35) { score += 8; confluences.push('RSI Oversold'); }
    if (type === 'short' && rsi > 65) { score += 8; confluences.push('RSI Overbought'); }

    // MACD
    if ((type === 'long' && macd.isBullishCross) || (type === 'short' && macd.isBearishCross)) {
        score += 15; confluences.push('MACD Cross 5m');
    } else if ((type === 'long' && macd.histogram > 0) || (type === 'short' && macd.histogram < 0)) {
        score += 5; confluences.push('MACD aligned');
    }

    // Bollinger Bands — peso DOBRADO em scalping (sinal explosivo de TF curto)
    if (bb.isSqueeze) { score += 20; confluences.push('BB Squeeze ⚡'); }
    if (type === 'long' && bb.percentB < 0.25) { score += 10; confluences.push('BB Suporte'); }
    if (type === 'short' && bb.percentB > 0.75) { score += 10; confluences.push('BB Resistência'); }

    // Confirmação 15m (alinha o scalping com o momentum médio)
    if (type === 'long' && macd15Bullish) { score += 8; confluences.push('MACD 15m bullish'); }
    if (type === 'short' && !macd15Bullish) { score += 8; confluences.push('MACD 15m bearish'); }

    // Smart Money (5m)
    if (type === 'long' && isSweepLow) { score += 20; confluences.push('Liquidity Sweep (5m)'); }
    if (type === 'short' && isSweepHigh) { score += 20; confluences.push('Liquidity Sweep (5m)'); }
    if (type === 'long' && priceInBullishOB && bullishOB) { score += 15; confluences.push('Order Block Bullish (5m)'); }
    if (type === 'short' && priceInBearishOB && bearishOB) { score += 15; confluences.push('Order Block Bearish (5m)'); }
    if (type === 'long' && isBullishFvg) { score += 10; confluences.push('FVG Bullish (5m)'); }
    if (type === 'short' && isBearishFvg) { score += 10; confluences.push('FVG Bearish (5m)'); }

    // RVOL confirma força do movimento
    if (rvol > 1.5) { score += 10; confluences.push('RVOL Alto (>1.5x)'); }

    score = Math.min(score, 100);

    const minScore = config.scalpingBot.minScore;
    logger.debug(`[SCALPING-DIAG] ${symbol} score=${score} | minScore=${minScore} | ${score >= minScore ? '✅ PASSOU' : '❌ VETADO'}`);
    if (score < minScore) return null;

    // ── Stop Loss e Take Profits para scalping (mais curtos) ──
    const atrPercent = currentPrice > 0 ? (atr / currentPrice * 100) : 0.5;

    // SL mais apertado: 1x ATR (vs 1.5x do principal)
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
        // Ajuste dinâmico baseado na volatilidade do ativo.
        // Usa 1.0x ATR (era 0.8x) — SL mais apertado causava stops por ruído de mercado.
        // Mínimo 0.5% (era 0.3%) — altcoins têm noise natural acima de 0.3% no 5m.
        const volatilityMultiplier = rvol > 1.5 ? 1.1 : 1.0;
        stopLossDistance = Math.max(atrPercent * volatilityMultiplier, 0.5);
    }

    // TPs escalados para scalping: alvos dinâmicos baseados na estrutura.
    // CORRIGIDO: TP1 mínimo agora é 2.0:1 (era 1.3:1).
    // Com win rate de ~35%, precisamos de R:R mínimo 2:1 para expectativa positiva.
    // E = (0.35 × 2.0) - (0.65 × 1.0) = 0.70 - 0.65 = +0.05 ✅
    let tp1Distance: number, tp2Distance: number, tp3Distance: number;

    if (usingStructuralStop) {
        // ICT Fibonacci projections — mantém as metas estruturais
        tp1Distance = stopLossDistance * 2.0;   // 2:1 mínimo garantido
        tp2Distance = stopLossDistance * 3.0;   // 3:1 extensão
        tp3Distance = stopLossDistance * 4.5;   // Major liquidity target
    } else if (isSweepLow || isSweepHigh) {
        // Liquidity Sweep = reversão forte, alvos mais ambiciosos
        tp1Distance = stopLossDistance * 2.0;
        tp2Distance = stopLossDistance * 3.0;
        tp3Distance = stopLossDistance * 4.0;
    } else {
        // Scalping padrão: BB Squeeze permite TP mais ambicioso
        const tpScale = bb.isSqueeze ? 1.3 : 1.0;
        tp1Distance = stopLossDistance * 2.0 * tpScale;  // 2:1 base (era 1.3:1!)
        tp2Distance = stopLossDistance * 3.0 * tpScale;  // 3:1
        tp3Distance = stopLossDistance * 4.5 * tpScale;  // 4.5:1
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

    // ── ALAVANCAGEM DINÂMICA (igual ao robô principal, mas com cap menor) ──
    const accountRiskLevel = config.riskManagement.riskPercent;
    const marginPercent = config.riskManagement.marginPercent;
    
    // Fórmula Mágica: (Risk% / StopLoss%) / (Margin% / 100)
    let dynamicLeverage = Math.round((accountRiskLevel / stopLossDistance) / (marginPercent / 100));
    
    // Ajuste baseado na qualidade do sinal
    if (score >= 85) {
        // Sinal de alta qualidade: permite alavancagem maior
        dynamicLeverage = Math.round(dynamicLeverage * 1.2);
    } else if (score < 70) {
        // Sinal mais fraco: reduz alavancagem
        dynamicLeverage = Math.round(dynamicLeverage * 0.8);
    }
    
    // Ajuste baseado na volatilidade
    if (rvol > 2.0) {
        // Volume muito alto = mais risco, reduz alavancagem
        dynamicLeverage = Math.round(dynamicLeverage * 0.85);
    }
    
    // Limites de Segurança para Scalping
    if (dynamicLeverage < 3) dynamicLeverage = 3;   // Mínimo 3x (scalping precisa de margem)
    if (dynamicLeverage > 25) dynamicLeverage = 25; // Cap menor que o principal (max 25x)

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
        status: 'PENDING' as const,
        confidence: score,
        createdAt: new Date(),
        indicators: confluences,
        quality: { score, factors: confluences },
        tradeType: 'Scalping',
        expectedDuration: '15-60 minutos',
        mtfContext: {
            macro: [`Confirmação 15m: ${macd15Bullish ? '🟢 Bullish' : '🔴 Bearish'}`],
            medium: [`StochRSI K: ${stochRsi.k.toFixed(1)}`],
            micro: [`BB %B: ${(bb.percentB * 100).toFixed(0)}% | Squeeze: ${bb.isSqueeze ? '✅' : '❌'}`],
        },
        contextNarrative: `Scalping ${type.toUpperCase()} ${symbol} (5m) — ${confluences.slice(0, 3).join(', ')}. R:R ${riskReward.toFixed(1)}:1 com SL de ${stopLossDistance.toFixed(2)}%.`,
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
            symbol_id: getSymbolId(symbol),
            rsi,
            adx, // ADX calculado com dados 5m reais (era fixo em 25 — dado inválido para o ML)
            atr_rel: atr / currentPrice,
            dist_ema20: (currentPrice - lastEma21) / currentPrice,
            dist_ema50: (currentPrice - lastEma50) / currentPrice,
            dist_ema200: 0, // EMA200 no 5m requer 1000 candles — omitido intencionalmente
            dist_vwap: (currentPrice - vwap) / currentPrice,
            volume_rel: rvol,
        },
    } satisfies TradeSignal;
}

// ──── Ciclo principal de scalping ────

async function runScalpingCycle(): Promise<void> {
    logger.info('[Scalping] Running scalping signal cycle...');
    // Usa lista dedicada de pares líquidos (scalpingSymbols), não a lista geral.
    // A lista geral (monitoredSymbols) inclui 86 pares com altcoins de baixa liquidez
    // que causam losses no 5m (API3, UMA, GMT etc foram os maiores perdedores).
    const symbols = config.scalpingSymbols;
    const now = Date.now();

    for (const symbol of symbols) {
        try {
            // Verifica cooldown por par
            const lastSignalTime = scalpingCooldowns.get(symbol) || 0;
            if (now - lastSignalTime < config.scalpingBot.cooldownMs) {
                logger.debug(`[Scalping] ${symbol} em cooldown (${Math.round((config.scalpingBot.cooldownMs - (now - lastSignalTime)) / 60000)}min restante)`);
                continue;
            }

            // Busca dados 5m (primário) e 15m (confirmação)
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

            const signal = generateScalpingSignal(symbol, ohlc5m, ohlc15m, currentPrice, high24h, low24h, fundingRate);

            if (!signal) continue;

            // ML enrichment (reutiliza o modelo existente com limiar mais permissivo)
            if (isModelLoaded() && signal.mlData) {
                try {
                    const prediction = await predictSignal(signal.mlData as unknown as Parameters<typeof predictSignal>[0]);
                    if (prediction) {
                        signal.mlData = { ...signal.mlData, probability: prediction.probability, predictedClass: prediction.predictedClass };
                        if (prediction.probability < config.scalpingBot.mlMinProb) {
                            logger.debug(`[Scalping] ${symbol} filtrado pelo ML (prob: ${prediction.probability.toFixed(3)} < ${config.scalpingBot.mlMinProb})`);
                            continue;
                        }
                    }
                } catch (mlError) {
                    logger.warn(`[Scalping] ML enrichment falhou para ${symbol}`, { error: mlError });
                }
            }

            // Evita duplicatas em memória
            const existingRecent = scalpingActiveSignals.find(s =>
                s.pair === symbol && s.type === signal.type
            );
            if (existingRecent) {
                logger.debug(`[Scalping] Sinal duplicado ignorado: ${symbol}`);
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
                    await telegramService.sendScalpingSignal(signal);
                    scalpingSignalsSent++;
                    logger.info(`[Scalping] Sinal enviado: ${signal.type.toUpperCase()} ${symbol} | score=${signal.confidence}`);
                    
                    try {
                        const { tradeTracker } = await import('../trading/tradeTracker.js');
                        // Converter metas (scalping usa 1 a 3 TPs)
                        const tps: { level: number, price: number, hit: boolean }[] = [];
                        if (signal.takeProfit1) tps.push({ level: 1, price: signal.takeProfit1, hit: false });
                        if (signal.takeProfit2) tps.push({ level: 2, price: signal.takeProfit2, hit: false });
                        if (signal.takeProfit3) tps.push({ level: 3, price: signal.takeProfit3, hit: false });

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
                            status: 'PENDING',
                            expected_duration: signal.expectedDuration,
                            score: signal.confidence,
                        }).catch((e: unknown) => logger.warn(`[Scalping/TradeTracker] Erro ao registrar: ${e instanceof Error ? e.message : String(e)}`));
                    } catch (trackError) {
                        logger.warn(`[Scalping] Falha ao injetar no TradeTracker para ${symbol}`, { error: trackError });
                    }
                } catch (tgError) {
                    logger.warn(`[Scalping] Falha ao enviar Telegram para ${symbol}`, { error: tgError });
                }
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

    // Aguarda 30s após o boot para não sobrecarregar a inicialização
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
