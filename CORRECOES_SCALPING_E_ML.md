# Correções Aplicadas: Scalping + ML + Sinais Duplicados

## Resumo das Alterações

### 1. ✅ Cancelamento Automático de Sinais Duplicados

**Problema:** Múltiplos sinais ativos para a mesma moeda

**Solução:** 
- Quando novo sinal é gerado, cancela automaticamente sinais antigos da mesma moeda
- Implementado em `backend/src/trading/tradeTracker.ts`
- Método `cancelOldSignalsForPair()` chamado antes de `registerNewSignal()`

**Arquivo:** `backend/src/trading/tradeTracker.ts`

```typescript
// 0. CANCELAR SINAIS ANTIGOS DA MESMA MOEDA
await this.cancelOldSignalsForPair(signal.pair!);
```

### 2. ✅ Scalping com Stop Loss Dinâmico

**Problema:** SL sempre fixo em 1x ATR

**Solução:**
- SL ajustado por volatilidade (RVOL)
- RVOL > 1.5 = 0.9x ATR (mais espaço)
- RVOL normal = 0.8x ATR (mais apertado)

**Arquivo:** `backend/src/engine/scalpingEngine.ts`

```typescript
const volatilityMultiplier = rvol > 1.5 ? 0.9 : 0.8;
stopLossDistance = Math.max(atrPercent * volatilityMultiplier, 0.3);
```

### 3. ✅ Take Profits Contextuais

**Problema:** TPs sempre fixos (1.2:1, 2:1, 3:1)

**Solução:**
- Order Blocks = TPs Fibonacci (1.5:1, 2:1, 3:1)
- Liquidity Sweeps = TPs ambiciosos (1.8:1, 2.5:1, 3.5:1)
- BB Squeeze = TPs aumentados 20%
- Padrão = TPs conservadores (1.3:1, 2:1, 3:1)

**Arquivo:** `backend/src/engine/scalpingEngine.ts`

```typescript
if (usingStructuralStop) {
    tp1Distance = stopLossDistance * 1.5;
    tp2Distance = stopLossDistance * 2.0;
    tp3Distance = stopLossDistance * 3.0;
} else if (isSweepLow || isSweepHigh) {
    tp1Distance = stopLossDistance * 1.8;
    tp2Distance = stopLossDistance * 2.5;
    tp3Distance = stopLossDistance * 3.5;
} else {
    const tpScale = bb.isSqueeze ? 1.2 : 1.0;
    tp1Distance = stopLossDistance * 1.3 * tpScale;
    tp2Distance = stopLossDistance * 2.0 * tpScale;
    tp3Distance = stopLossDistance * 3.0 * tpScale;
}
```

### 4. ✅ Alavancagem Inteligente

**Problema:** Alavancagem sempre entre 2x-20x sem contexto

**Solução:**
- Score alto (≥85) = +20% alavancagem
- Score baixo (<70) = -20% alavancagem
- RVOL extremo (>2.0) = -15% alavancagem
- Limites: 3x - 25x

**Arquivo:** `backend/src/engine/scalpingEngine.ts`

```typescript
let dynamicLeverage = Math.round((accountRiskLevel / stopLossDistance) / (marginPercent / 100));

if (score >= 85) {
    dynamicLeverage = Math.round(dynamicLeverage * 1.2);
} else if (score < 70) {
    dynamicLeverage = Math.round(dynamicLeverage * 0.8);
}

if (rvol > 2.0) {
    dynamicLeverage = Math.round(dynamicLeverage * 0.85);
}

if (dynamicLeverage < 3) dynamicLeverage = 3;
if (dynamicLeverage > 25) dynamicLeverage = 25;
```

### 5. ✅ Sistema de ML Unificado

**Confirmado:** Scalping e Principal usam o MESMO sistema de aprendizado

- Mesma tabela: `ml_training_data`
- Mesmas features: 25 indicadores
- Mesmo modelo: `current_model.onnx`
- Mesmo job: Diário às 23:55 UTC

**Vantagens:**
- Mais dados para treinar (scalping gera mais trades)
- Aprendizado cruzado entre timeframes
- Modelo mais robusto

## Arquivos Modificados

1. `backend/src/trading/tradeTracker.ts`
   - Adicionado `cancelOldSignalsForPair()`
   - Modificado `registerNewSignal()`

2. `backend/src/engine/scalpingEngine.ts`
   - Stop Loss dinâmico
   - Take Profits contextuais
   - Alavancagem inteligente

## Documentação Criada

1. `docs/FIX_SINAIS_DUPLICADOS.md` - Cancelamento de sinais
2. `docs/FIX_SCALPING_DINAMICO.md` - Melhorias no scalping
3. `RESUMO_ML_APRENDIZADO.md` - Sistema de ML
4. `docs/ML_APRENDIZADO_COMPLETO.md` - Detalhes técnicos ML
5. `docs/ML_FLUXO_VISUAL.md` - Diagramas do ML
6. `docs/ML_FAQ.md` - 20 perguntas frequentes

## Como Fazer Deploy

### Opção 1: Script Automático
```bash
chmod +x deploy_scalping_fix.sh
./deploy_scalping_fix.sh
```

### Opção 2: Manual
```bash
# 1. Compilar localmente
cd backend
npm run build

# 2. Enviar para VPS
rsync -avz --exclude 'node_modules' backend/ root@212.85.10.239:/root/tuturos-sinais/backend/

# 3. Compilar no VPS
ssh root@212.85.10.239 'cd /root/tuturos-sinais/backend && npm run build'

# 4. Reiniciar PM2
ssh root@212.85.10.239 'cd /root/tuturos-sinais/backend && pm2 restart all'

# 5. Ver logs
ssh root@212.85.10.239 'pm2 logs --lines 30'
```

## Verificação Pós-Deploy

### 1. Verificar Logs
```bash
ssh root@212.85.10.239 'pm2 logs --lines 50'
```

Procure por:
- `[TradeTracker] Cancelando X sinal(is) antigo(s)...`
- `[SCALPING-DIAG] ... SL: X% (Xx ATR)`
- `[Scalping] Sinal enviado: ... R:R=X:1`

### 2. Verificar Sinais Ativos
```bash
ssh root@212.85.10.239 'cd /root/tuturos-sinais/backend && node -e "import(\"./dist/lib/dbClient.js\").then(({db}) => db.activeSignal.findMany({where:{status:{in:[\"PENDING\",\"ACTIVE\"]}}}).then(r => console.log(r)))"'
```

Deve mostrar apenas 1 sinal ativo por moeda.

### 3. Verificar ML
```bash
ssh root@212.85.10.239 'cd /root/tuturos-sinais/backend && node dist/scripts/check_ml_data.js'
```

## Resultados Esperados

✅ Apenas 1 sinal ativo por moeda
✅ Stops variados baseados em volatilidade
✅ TPs adaptados ao tipo de setup
✅ Alavancagem ajustada por qualidade
✅ ML aprendendo com ambos os robôs

## Suporte

Se houver problemas:
1. Verifique logs: `pm2 logs`
2. Verifique status: `pm2 status`
3. Reinicie se necessário: `pm2 restart all`
4. Consulte documentação em `docs/`
