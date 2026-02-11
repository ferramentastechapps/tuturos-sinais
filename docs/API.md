# API Reference

Este documento serve como referência técnica para os principais componentes do Motor de Sinais.

## 1. Engine de Sinais

### `advancedSignalGenerator.ts`

**Entrada**: `AdvancedSignalInput`

```typescript
interface AdvancedSignalInput {
  symbol: string;
  currentPrice: number;
  indicators: TechnicalIndicator[]; // { RSI: 30, MACD: -50, ... }
  ohlcData: OHLCPoint[]; // Dados históricos (mínimo 200 candles)
  futuresData?: FuturesOverview; // Opcional (Binance)
}
```

**Saída**: `AdvancedSignal | null`

```typescript
interface AdvancedSignal {
  type: 'long' | 'short';
  entry: number;     // Preço de Entrada
  stopLoss: number;  // Sugestão de SL
  takeProfit: number;// Sugestão de TP (Pivot recente ou FVG)
  quality: QualityScore; // 0-100
  confidence: number;    // 0-100
  factors: QualityFactor[]; // Lista de razões (ex: "BOS Bullish")
}
```

---

## 2. Backtesting Engine

### `utils/backtestEngine.ts`

Classe para simulação histórica.

**Construtor**:
```typescript
const engine = new BacktestEngine({
  initialCapital: 10000,
  riskPerTrade: 0.02, // 2% por trade
  takerFee: 0.0004,   // 0.04% fee
  slippage: 0.0002,   // 0.02% slippage
  minScore: 50,       // Score mínimo para entrar
  minConfidence: 60   // Confiança mínima
});
```

**Método Principal**:
```typescript
const result = engine.run(symbol: string, ohlcData: OHLCPoint[]);
```

**Saída**: `BacktestSummary`

```typescript
interface BacktestSummary {
  winRate: number;       // % trades vencedores
  profitFactor: number;  // Gross Profit / Gross Loss
  totalPnL: number;      // PnL Líquido
  maxDrawdown: number;   // Maior queda percentual da Equity
  equityCurve: Array<{ timestamp: number; equity: number }>;
}
```

---

## 3. Sistema de Alertas

### `services/alertSystem.ts`

Serviço Singleton para monitoramento em background.

**Inicialização**:
```typescript
AlertSystem.getInstance().start([
  { symbol: 'BTCUSDT', interval: '1m', minScore: 70 },
  { symbol: 'ETHUSDT', interval: '5m', minScore: 65 }
]);
```

**Callback**:
```typescript
AlertSystem.getInstance().subscribe((signal) => {
  console.log(`Novo Sinal Detectado: ${signal.symbol} - ${signal.type.toUpperCase()}`);
});
```

---

## 4. Tipos e Utilitários

### Smart Money (`utils/smartMoney.ts`)
```typescript
interface SmartMoneyResult {
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  liquidityZones: LiquidityZone[];
}
```
**Optimizações**: Algoritmo de clusterização de liquidez O(N log N).

### Market Structure (`utils/marketStructure.ts`)
```typescript
interface MarketStructureResult {
  currentTrend: 'bullish' | 'bearish' | 'ranging';
  structureBreaks: StructureBreak[]; // BOS, CHOCH
}
```
