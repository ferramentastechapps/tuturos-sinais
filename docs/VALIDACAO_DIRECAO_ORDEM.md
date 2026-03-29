# Validação de Direção de Ordem Pendente

## Problema Identificado

Quando uma ordem fica pendente por muito tempo esperando o preço entrar na zona de entrada, os indicadores podem mudar e a direção do sinal pode se inverter (de SHORT para LONG ou vice-versa). Isso causava ativação de ordens em direção contrária à tendência atual.

## Solução Implementada

### 1. Validação Antes da Ativação

Quando uma ordem pendente está prestes a ser ativada (preço entra na zona de entrada), o sistema agora:

1. **Recalcula os indicadores atuais**
2. **Determina a direção atual do mercado**
3. **Compara com a direção original do sinal**
4. **Cancela a ordem se a direção mudou**

### 2. Lógica de Validação

**Indicadores verificados:**
- RSI (Relative Strength Index)
- EMA 20, 50, 200 (Exponential Moving Averages)

**Contagem de confluências:**
```typescript
bullishCount = 0
bearishCount = 0

// RSI
if (rsi > 55) bullishCount++
if (rsi < 45) bearishCount++

// EMAs
if (price > EMA20) bullishCount++ else bearishCount++
if (price > EMA50) bullishCount++ else bearishCount++
if (price > EMA200) bullishCount++ else bearishCount++

// Direção atual
currentDirection = bullishCount >= bearishCount ? 'LONG' : 'SHORT'
```

**Decisão:**
- Se `currentDirection === originalDirection` → ✅ Ativa a ordem
- Se `currentDirection !== originalDirection` → ❌ Cancela a ordem

### 3. Fluxo Completo

```
Ordem PENDING
    ↓
Preço entra na zona de entrada
    ↓
Validar direção atual
    ↓
    ├─ Direção válida → ATIVA ordem
    │                    └─ Status: ACTIVE
    │                    └─ Notificação: "Ordem ativada"
    │
    └─ Direção mudou → CANCELA ordem
                       └─ Status: CANCELLED
                       └─ Notificação: "Ordem cancelada - Direção mudou"
                       └─ Remove da memória
```

## Implementação

### Arquivo: `backend/src/trading/tradeTracker.ts`

#### 1. Modificação em `processPriceUpdate()`

```typescript
if (signal.status === 'PENDING') {
  const isEntered = update.price >= signal.entry_range_low && 
                    update.price <= signal.entry_range_high;

  if (isEntered) {
    // NOVA VALIDAÇÃO
    const isDirectionValid = await this.validateSignalDirection(signal, update.price);
    
    if (!isDirectionValid) {
      // CANCELAR ORDEM
      console.log(`[TradeTracker] ⚠️  Signal ${signal.pair} CANCELADO: Direção mudou`);
      signal.status = 'CANCELLED';
      
      await db.activeSignal.update({ 
        where: { id: signal.id }, 
        data: { status: 'CANCELLED' } 
      });
      
      this.sendCancellationNotification(signal, 'Direção do mercado mudou');
      this.removeSignalFromMemory(signal.id, signal.pair);
      continue;
    }
    
    // ATIVAR ORDEM (direção válida)
    signal.status = 'ACTIVE';
    // ... resto do código de ativação
  }
}
```

#### 2. Nova Função: `validateSignalDirection()`

```typescript
private async validateSignalDirection(signal: ActiveSignal, currentPrice: number): Promise<boolean> {
  // 1. Buscar dados OHLC atuais
  const ohlc = await fetchOHLC(signal.pair, '1h', 100);
  
  // 2. Calcular indicadores
  const rsi = calculateRSI(closes);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  
  // 3. Contar confluências
  let bullishCount = 0;
  let bearishCount = 0;
  // ... lógica de contagem
  
  // 4. Determinar direção atual
  const currentDirection = bullishCount >= bearishCount ? 'LONG' : 'SHORT';
  const originalDirection = signal.type.toUpperCase();
  
  // 5. Comparar
  return currentDirection === originalDirection;
}
```

#### 3. Nova Função: `sendCancellationNotification()`

```typescript
private async sendCancellationNotification(signal: ActiveSignal, reason: string) {
  const message = `
🚫 ORDEM CANCELADA

Par: ${signal.pair}
Tipo: ${signal.type.toUpperCase()}
Motivo: ${reason}

A ordem pendente foi cancelada porque as condições de mercado mudaram.
  `;
  
  await sendTelegramMessage(message);
}
```

## Exemplos de Uso

### Exemplo 1: Ordem Cancelada (Direção Mudou)

```
[TradeTracker] Signal BTCUSDT PENDING
[TradeTracker] Preço entrou na zona: $45,000
[TradeTracker] Validando direção...
[TradeTracker] 🔄 Direção mudou: SHORT → LONG (bull:4 bear:2)
[TradeTracker] ⚠️  Signal BTCUSDT CANCELADO: Direção mudou
[Telegram] 🚫 ORDEM CANCELADA - BTCUSDT SHORT - Direção do mercado mudou
```

### Exemplo 2: Ordem Ativada (Direção Válida)

```
[TradeTracker] Signal ETHUSDT PENDING
[TradeTracker] Preço entrou na zona: $2,500
[TradeTracker] Validando direção...
[TradeTracker] ✅ Direção validada: LONG (bull:5 bear:1)
[TradeTracker] Signal ETHUSDT ACTIVATED at $2,500
[Telegram] ✅ ORDEM ATIVADA - ETHUSDT LONG
```

## Benefícios

1. **Evita trades contra a tendência:** Não ativa ordens quando o mercado mudou de direção
2. **Reduz perdas:** Cancela ordens que teriam alta probabilidade de loss
3. **Melhora win rate:** Só ativa ordens com confluência atual
4. **Transparência:** Notifica o usuário sobre cancelamentos
5. **Rastreabilidade:** Registra eventos de cancelamento no banco

## Monitoramento

### Logs a Observar

```bash
pm2 logs signal-engine --lines 50
```

Procurar por:
- `[TradeTracker] Validando direção...` - Validação iniciada
- `[TradeTracker] ✅ Direção validada` - Ordem será ativada
- `[TradeTracker] 🔄 Direção mudou` - Ordem será cancelada
- `[TradeTracker] ⚠️  Signal CANCELADO` - Ordem cancelada

### Verificar Cancelamentos no Banco

```sql
SELECT * FROM active_signals WHERE status = 'CANCELLED';
SELECT * FROM signal_events WHERE event_type = 'CANCELLED';
```

## Deploy

```bash
cd backend
npm run build
ssh root@212.85.10.239
cd /root/tuturos-sinais/backend
npm run build
pm2 restart signal-engine
pm2 logs signal-engine --lines 30
```

## Testes

Para testar a funcionalidade:

1. Criar um sinal pendente
2. Aguardar o mercado mudar de direção
3. Aguardar o preço entrar na zona de entrada
4. Verificar se a ordem foi cancelada
5. Verificar notificação no Telegram
