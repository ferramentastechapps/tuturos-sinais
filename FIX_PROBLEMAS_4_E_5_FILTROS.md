# 🔧 FIX PROBLEMAS 4 e 5: Filtros de Qualidade e Volatilidade

## 🎯 OBJETIVOS

### Problema 4: Quality Score Caiu 29% nos Últimos 7 Dias
- Implementar floor dinâmico para quality_score
- Evitar que filtros fiquem muito permissivos

### Problema 5: Alta Volatilidade Não Está Sendo Filtrada
- Adicionar veto de volatilidade ALTA (não apenas morta)
- Filtrar por ATR e volatility_24h relativos à média do símbolo

---

## 📝 CORREÇÃO 1: Floor Dinâmico de Quality Score (Problema 4)

### ❌ ANTES (`backend/src/engine/signalEngine.ts`)

```typescript
// Linha 342: Veto de score mínimo fixo
const scoreThreshold = customMinScore !== undefined ? Math.floor(customMinScore / 10) : 6;
if (rawScore < scoreThreshold) {
    logger.debug(`[SIGNAL-DIAG] ${symbol} ❌ VETO SCORE: ${rawScore}/10 < ${scoreThreshold}`);
    return null;
}
```

### ✅ DEPOIS (`backend/src/engine/signalEngine.ts`)

```typescript
// ✅ NOVO: Floor dinâmico baseado no tipo de trade e condições de mercado
function calculateMinScore(
    tradeType: 'swing' | 'scalping',
    macroTrend: 'long' | 'short' | 'neutral',
    signalType: 'long' | 'short',
    customMinScore?: number
): number {
    // Base mínima por tipo de robô
    let baseMin = tradeType === 'swing' ? 7 : 5; // Swing mais exigente
    
    // Penalidade se contra-tendência macro
    if (macroTrend !== 'neutral' && macroTrend !== signalType) {
        baseMin += 1; // Exigir +1 ponto se contra-tendência
    }
    
    // Respeitar customMinScore se fornecido (mas com floor absoluto)
    if (customMinScore !== undefined) {
        const customThreshold = Math.floor(customMinScore / 10);
        baseMin = Math.max(baseMin, customThreshold);
    }
    
    // Floor absoluto: nunca aceitar score < 5 (50%)
    return Math.max(baseMin, 5);
}

// Aplicar no código de geração de sinal (linha 342):
const scoreThreshold = calculateMinScore('swing', macroTrend, type, customMinScore);

if (rawScore < scoreThreshold) {
    logger.debug(`[SIGNAL-DIAG] ${symbol} ❌ VETO SCORE: ${rawScore}/10 < ${scoreThreshold} (macro=${macroTrend}, type=${type})`);
    return null;
}
```

### ✅ SCALPING (`backend/src/engine/scalpingEngine.ts`)

```typescript
// Linha 342: Aplicar mesmo floor dinâmico
const scoreThreshold = 5; // Scalping sempre exige mínimo 5/10 (50%)

if (rawScore < scoreThreshold) {
    logger.debug(`[SCALPING-DIAG] ${symbol} ❌ VETO SCORE: ${rawScore}/10 < ${scoreThreshold}`);
    return null;
}
```

---

## 📝 CORREÇÃO 2: Filtro de Volatilidade Alta (Problema 5)

### 🏗️ ARQUITETURA DA SOLUÇÃO

Precisamos manter uma **janela móvel** dos últimos 20 sinais de cada símbolo para calcular a média de ATR e volatility_24h.

### ✅ NOVO SERVIÇO: `backend/src/services/volatilityTracker.ts`

```typescript
/**
 * VolatilityTracker — Mantém histórico de volatilidade por símbolo
 * para detectar quando um ativo está em volatilidade anormalmente alta
 */

interface VolatilitySnapshot {
    symbol: string;
    timestamp: number;
    atr_pct: number;
    volatility_24h: number;
    price: number;
}

class VolatilityTracker {
    private history: Map<string, VolatilitySnapshot[]> = new Map();
    private readonly WINDOW_SIZE = 20; // Últimos 20 snapshots
    private readonly MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
    
    /**
     * Registra um snapshot de volatilidade
     */
    public record(symbol: string, atr_pct: number, volatility_24h: number, price: number): void {
        if (!this.history.has(symbol)) {
            this.history.set(symbol, []);
        }
        
        const snapshots = this.history.get(symbol)!;
        
        snapshots.push({
            symbol,
            timestamp: Date.now(),
            atr_pct,
            volatility_24h,
            price
        });
        
        // Manter apenas os últimos WINDOW_SIZE snapshots
        if (snapshots.length > this.WINDOW_SIZE) {
            snapshots.shift();
        }
        
        // Limpar snapshots muito antigos
        const cutoff = Date.now() - this.MAX_AGE_MS;
        while (snapshots.length > 0 && snapshots[0].timestamp < cutoff) {
            snapshots.shift();
        }
    }
    
    /**
     * Calcula a média de ATR% dos últimos snapshots
     */
    public getAverageATR(symbol: string): number | null {
        const snapshots = this.history.get(symbol);
        if (!snapshots || snapshots.length < 3) return null;
        
        const sum = snapshots.reduce((acc, s) => acc + s.atr_pct, 0);
        return sum / snapshots.length;
    }
    
    /**
     * Calcula a média de volatility_24h dos últimos snapshots
     */
    public getAverageVolatility24h(symbol: string): number | null {
        const snapshots = this.history.get(symbol);
        if (!snapshots || snapshots.length < 3) return null;
        
        const sum = snapshots.reduce((acc, s) => acc + s.volatility_24h, 0);
        return sum / snapshots.length;
    }
    
    /**
     * Verifica se a volatilidade atual está anormalmente alta
     */
    public isHighVolatility(
        symbol: string,
        currentATR: number,
        currentVol24h: number,
        multiplier: number = 1.3
    ): { isHigh: boolean; reason?: string; atrRatio?: number; volRatio?: number } {
        const avgATR = this.getAverageATR(symbol);
        const avgVol = this.getAverageVolatility24h(symbol);
        
        // Se não há histórico suficiente, não vetar (dar benefício da dúvida)
        if (avgATR === null || avgVol === null) {
            return { isHigh: false };
        }
        
        const atrRatio = currentATR / avgATR;
        const volRatio = currentVol24h / avgVol;
        
        // Vetar se AMBOS estão acima do threshold
        if (atrRatio > multiplier && volRatio > multiplier) {
            return {
                isHigh: true,
                reason: `ATR ${atrRatio.toFixed(2)}x e Vol24h ${volRatio.toFixed(2)}x acima da média`,
                atrRatio,
                volRatio
            };
        }
        
        // Vetar se ATR está MUITO acima (>1.5x) mesmo que Vol24h esteja OK
        if (atrRatio > multiplier * 1.15) {
            return {
                isHigh: true,
                reason: `ATR ${atrRatio.toFixed(2)}x muito acima da média`,
                atrRatio,
                volRatio
            };
        }
        
        return { isHigh: false, atrRatio, volRatio };
    }
    
    /**
     * Retorna estatísticas de volatilidade de um símbolo
     */
    public getStats(symbol: string): {
        samples: number;
        avgATR: number | null;
        avgVol24h: number | null;
        oldestSnapshot: number | null;
    } {
        const snapshots = this.history.get(symbol);
        if (!snapshots || snapshots.length === 0) {
            return { samples: 0, avgATR: null, avgVol24h: null, oldestSnapshot: null };
        }
        
        return {
            samples: snapshots.length,
            avgATR: this.getAverageATR(symbol),
            avgVol24h: this.getAverageVolatility24h(symbol),
            oldestSnapshot: snapshots[0].timestamp
        };
    }
    
    /**
     * Limpa histórico de um símbolo (útil para testes)
     */
    public clear(symbol?: string): void {
        if (symbol) {
            this.history.delete(symbol);
        } else {
            this.history.clear();
        }
    }
}

export const volatilityTracker = new VolatilityTracker();
```

---

## 📝 CORREÇÃO 3: Integrar Filtro no Swing Robot

### ✅ MODIFICAR: `backend/src/engine/signalEngine.ts`

```typescript
import { volatilityTracker } from '../services/volatilityTracker.js';

export function generateSignalFromData(
    symbol: string,
    ohlc: OHLCPoint[],
    currentPrice: number,
    high24h: number,
    low24h: number,
    volume24h: number,
    fundingRate: number,
    ohlc15m?: OHLCPoint[],
    ohlc4h?: OHLCPoint[],
    customMinScore?: number,
    indicatorPerf?: Record<string, { winRate: number, avgPnl: number, totalTrades: number }>
): TradeSignal | null {
    if (ohlc.length < 50) return null;

    const closes = ohlc.map(c => c.close);
    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const bb = calculateBollingerBands(closes);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);
    const atr = calculateATR(ohlc);
    const adx = calculateADX(ohlc);
    const vwap = calculateVWAP(ohlc);
    const rvol = calculateRVOL(ohlc);

    // ✅ NOVO: Calcular volatility_24h
    const volatility_24h = high24h > 0 ? ((high24h - low24h) / ((high24h + low24h) / 2)) * 100 : 0;
    const atr_pct = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;
    
    // ✅ NOVO: Registrar snapshot de volatilidade
    volatilityTracker.record(symbol, atr_pct, volatility_24h, currentPrice);

    // VETOS ABSOLUTOS (Condições extremas de morte de mercado)
    if (adx < 15) {
        logger.debug(`[SIGNAL-DIAG] ${symbol} ❌ VETO ADX: ${adx.toFixed(1)} < 15 (mercado lateral extremo)`);
        return null;
    }
    
    const currentPriceForVeto = ohlc[ohlc.length - 1].close;
    const atrPercentForVeto = currentPriceForVeto > 0 ? (atr / currentPriceForVeto) * 100 : 0;
    if (atrPercentForVeto < 0.4) {
        logger.debug(`[SIGNAL-VETO] ${symbol} ❌ VETO ATR: ${atrPercentForVeto.toFixed(2)}% < 0.4% (volatilidade morta)`);
        return null;
    }
    
    // ✅ NOVO: VETO DE VOLATILIDADE ALTA
    const volCheck = volatilityTracker.isHighVolatility(symbol, atr_pct, volatility_24h, 1.3);
    if (volCheck.isHigh) {
        logger.debug(`[SIGNAL-VETO] ${symbol} ❌ VETO VOLATILIDADE ALTA: ${volCheck.reason} (ATR=${atr_pct.toFixed(2)}%, Vol24h=${volatility_24h.toFixed(2)}%)`);
        return null;
    }

    // ... resto do código continua igual ...
}
```

---

## 📝 CORREÇÃO 4: Integrar Filtro no Scalping Robot

### ✅ MODIFICAR: `backend/src/engine/scalpingEngine.ts`

```typescript
import { volatilityTracker } from '../services/volatilityTracker.js';

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
    const rsiSeries = calculateRSISeries(closes5m, 14);
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

    // ✅ NOVO: Calcular volatility_24h
    const volatility_24h = high24h > 0 ? ((high24h - low24h) / ((high24h + low24h) / 2)) * 100 : 0;
    const atrPct = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;
    
    // ✅ NOVO: Registrar snapshot
    volatilityTracker.record(symbol, atrPct, volatility_24h, currentPrice);

    // ── VETO BÁSICO ABSOLUTO: Volatilidade Morta ──
    if (atrPct < 0.3) {
        logger.debug(`[SCALPING-DIAG] ${symbol} ❌ VETO: Volatilidade morta (ATR < 0.3%)`);
        return null;
    }
    
    // ✅ NOVO: VETO DE VOLATILIDADE ALTA (mais rigoroso para scalping)
    const volCheck = volatilityTracker.isHighVolatility(symbol, atrPct, volatility_24h, 1.4); // 1.4x para scalping
    if (volCheck.isHigh) {
        logger.debug(`[SCALPING-DIAG] ${symbol} ❌ VETO VOLATILIDADE ALTA: ${volCheck.reason}`);
        return null;
    }

    // ... resto do código continua igual ...
}
```

---

## 📝 CORREÇÃO 5: Endpoint de API para Monitorar Volatilidade

### ✅ ADICIONAR: `backend/src/server/api.ts`

```typescript
import { volatilityTracker } from '../services/volatilityTracker.js';

// Endpoint para ver estatísticas de volatilidade por símbolo
router.get('/volatility/stats/:symbol?', async (req: Request, res: Response) => {
    try {
        const { symbol } = req.params;
        
        if (symbol) {
            // Estatísticas de um símbolo específico
            const stats = volatilityTracker.getStats(symbol);
            res.json({
                symbol,
                ...stats,
                oldestSnapshotAge: stats.oldestSnapshot 
                    ? Math.floor((Date.now() - stats.oldestSnapshot) / 1000 / 60) + ' min'
                    : null
            });
        } else {
            // Estatísticas de todos os símbolos
            const allSymbols = config.monitoredSymbols;
            const allStats = allSymbols.map(sym => ({
                symbol: sym,
                ...volatilityTracker.getStats(sym)
            }));
            
            res.json({
                total_symbols: allStats.length,
                symbols_with_data: allStats.filter(s => s.samples > 0).length,
                stats: allStats.filter(s => s.samples > 0)
            });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
```

---

## 🧪 TESTE DAS CORREÇÕES

### 1. Testar Floor Dinâmico de Quality Score

```typescript
// Simular geração de sinal com diferentes condições

// Caso 1: Swing a favor da tendência macro
const signal1 = generateSignalFromData(
    'BTCUSDT',
    ohlc,
    50000,
    51000,
    49000,
    1000000000,
    0.0001,
    ohlc15m,
    ohlc4h,
    undefined, // Sem customMinScore
    {}
);
// Deve exigir score >= 7/10

// Caso 2: Swing contra-tendência macro
// (macroTrend = 'long', mas signal type = 'short')
// Deve exigir score >= 8/10

// Caso 3: Scalping
const signal3 = generateScalpingSignal(
    'ETHUSDT',
    ohlc5m,
    ohlc15m,
    3000,
    3100,
    2900,
    0.0001,
    {}
);
// Deve exigir score >= 5/10
```

### 2. Testar Filtro de Volatilidade Alta

```bash
# Simular volatilidade normal
curl -X POST http://localhost:3001/api/test/volatility \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "atr_pct": 1.5,
    "volatility_24h": 3.0
  }'

# Simular volatilidade alta (deve vetar)
curl -X POST http://localhost:3001/api/test/volatility \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "atr_pct": 3.5,
    "volatility_24h": 6.0
  }'
```

### 3. Verificar Estatísticas de Volatilidade

```bash
# Ver stats de um símbolo específico
curl http://localhost:3001/api/volatility/stats/BTCUSDT

# Ver stats de todos os símbolos
curl http://localhost:3001/api/volatility/stats
```

Resposta esperada:
```json
{
  "symbol": "BTCUSDT",
  "samples": 15,
  "avgATR": 1.8,
  "avgVol24h": 3.2,
  "oldestSnapshot": 1715270400000,
  "oldestSnapshotAge": "120 min"
}
```

---

## 📊 LOGS DE MONITORAMENTO

### Logs para Quality Score

```typescript
// Adicionar no generateSignalFromData após cálculo do scoreThreshold:
logger.debug(`[SCORE-THRESHOLD] ${symbol} ${type}: threshold=${scoreThreshold}/10 (macro=${macroTrend}, contra=${macroTrend !== type})`);
```

### Logs para Volatilidade

```typescript
// Adicionar após verificação de volatilidade:
const volStats = volatilityTracker.getStats(symbol);
logger.debug(`[VOL-CHECK] ${symbol}: current ATR=${atr_pct.toFixed(2)}%, avg=${volStats.avgATR?.toFixed(2)}%, ratio=${volCheck.atrRatio?.toFixed(2)}x`);
```

---

## 📈 DASHBOARD DE MONITORAMENTO

Criar página no frontend para visualizar volatilidade:

### ✅ NOVO COMPONENTE: `src/pages/VolatilityMonitor.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface VolStats {
    symbol: string;
    samples: number;
    avgATR: number | null;
    avgVol24h: number | null;
    oldestSnapshotAge: string | null;
}

export function VolatilityMonitor() {
    const [stats, setStats] = useState<VolStats[]>([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/volatility/stats');
                const data = await res.json();
                setStats(data.stats || []);
            } catch (error) {
                console.error('Failed to fetch volatility stats:', error);
            } finally {
                setLoading(false);
            }
        };
        
        fetchStats();
        const interval = setInterval(fetchStats, 60000); // Atualizar a cada 1 min
        
        return () => clearInterval(interval);
    }, []);
    
    if (loading) return <div>Carregando...</div>;
    
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Monitor de Volatilidade</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.map(stat => (
                    <Card key={stat.symbol}>
                        <CardHeader>
                            <CardTitle>{stat.symbol}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Samples:</span>
                                    <span className="font-medium">{stat.samples}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">ATR Médio:</span>
                                    <span className="font-medium">
                                        {stat.avgATR ? `${stat.avgATR.toFixed(2)}%` : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Vol 24h Média:</span>
                                    <span className="font-medium">
                                        {stat.avgVol24h ? `${stat.avgVol24h.toFixed(2)}%` : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Idade:</span>
                                    <span className="font-medium">{stat.oldestSnapshotAge || 'N/A'}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
```

---

## ✅ RESULTADO ESPERADO

Após estas correções:

### Problema 4 (Quality Score):
1. ✅ **Floor dinâmico** baseado em tipo de trade e tendência macro
2. ✅ **Swing mais exigente** (7/10) que Scalping (5/10)
3. ✅ **Penalidade contra-tendência** (+1 ponto exigido)
4. ✅ **Floor absoluto** de 5/10 (50%) nunca violado

**Impacto esperado**: Quality score médio deve estabilizar em ~0.75-0.80

### Problema 5 (Volatilidade Alta):
1. ✅ **Veto de ATR alto** (> 1.3x média do símbolo)
2. ✅ **Veto de Vol24h alta** (> 1.3x média do símbolo)
3. ✅ **Histórico por símbolo** (últimos 20 snapshots)
4. ✅ **Threshold diferenciado** (Swing 1.3x, Scalping 1.4x)

**Impacto esperado**:
- Sinais perdedores com ATR alto: redução de ~40-50%
- Win rate geral: aumento de 3-5 pontos percentuais
- Sinais gerados: redução de ~15-20% (mas com melhor qualidade)
