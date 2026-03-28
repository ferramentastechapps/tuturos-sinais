# Correção: Inconsistência de Status dos Sinais

## Problema Identificado

A página de resultados não estava mostrando sinais ativos, wins ou stops devido a uma **inconsistência nos valores de status** entre diferentes partes do sistema.

### Sintomas
- API retorna 27 sinais totais, mas 0 para cada filtro (ACTIVE, CLOSED_TP, CLOSED_SL)
- Frontend mostra "Nenhum sinal encontrado" em todas as abas
- Sinais existem no banco mas com status incompatíveis

### Causa Raiz

**Inconsistência de maiúsculas/minúsculas:**

1. **signalEngine.ts** criava sinais com `status: 'pending'` (minúsculo) no objeto em memória
2. **signalEngine.ts** salvava no banco com `status: 'PENDING'` (maiúsculo) 
3. **signalEngine.ts** filtrava sinais carregados por `'active'` e `'pending'` (minúsculo)
4. **tradeTracker.ts** buscava sinais com `'ACTIVE'` e `'PENDING'` (maiúsculo)
5. **tradeTracker.ts** atualizava para `'hit_tp'` e `'hit_sl'` (minúsculo)
6. **Frontend** filtrava por `'ACTIVE'`, `'CLOSED_TP'`, `'CLOSED_SL'` (maiúsculo)

**Resultado:** Sinais ficavam "órfãos" com status que não correspondia aos filtros.

## Correções Aplicadas

### 1. Padronização de Status (MAIÚSCULO)

**backend/src/engine/signalEngine.ts:**
```typescript
// Linha 756: objeto em memória
status: 'PENDING',  // era 'pending'

// Linha 1081: filtro de carregamento
activeSignals = loadedSignals.filter(s => s.status === 'ACTIVE' || s.status === 'PENDING')
// era: s.status === 'active' || s.status === 'pending'
```

**backend/src/trading/tradeTracker.ts:**
```typescript
// Linha 228: atualização de TP
db.tradeSignal.update({ where: { id: signal.id }, data: { status: 'CLOSED_TP' } })
// era: status: 'hit_tp'

// Linha 280: atualização de SL
const dbStatus = isWin ? 'CLOSED_TP' : 'CLOSED_SL';
// era: const dbStatus = isWin ? 'hit_tp' : 'hit_sl';
```

**backend/src/types/trading.ts:**
```typescript
status: 'PENDING' | 'ACTIVE' | 'CLOSED_TP' | 'CLOSED_SL' | 'CANCELLED';
// era: 'pending' | 'active' | 'hit_tp' | 'hit_sl' | 'cancelled'
```

### 2. Script de Migração de Dados

Criado `backend/scripts/fix_signal_status.mjs` para atualizar sinais existentes no banco:
- Converte `pending` → `PENDING`
- Converte `active` → `ACTIVE`
- Converte `hit_tp` → `CLOSED_TP`
- Converte `hit_sl` → `CLOSED_SL`
- Converte `cancelled` → `CANCELLED`

## Status Padronizados

| Status | Significado | Quando é definido |
|--------|-------------|-------------------|
| `PENDING` | Aguardando entrada | Quando sinal é criado |
| `ACTIVE` | Posição aberta | Quando preço entra na zona de entrada |
| `CLOSED_TP` | Fechado com lucro (WIN) | Quando bate qualquer TP |
| `CLOSED_SL` | Fechado no stop (LOSS ou WIN) | Quando bate SL (classificado por PnL) |
| `CANCELLED` | Cancelado manualmente | Quando usuário cancela |

## Deploy

Para aplicar as correções na VPS:

```bash
# 1. Fazer build do backend
cd backend
npm run build

# 2. Executar script de migração na VPS
ssh root@212.85.10.239
cd /root/tuturos-sinais/backend
node scripts/fix_signal_status.mjs

# 3. Reiniciar o backend
pm2 restart signal-engine

# 4. Verificar logs
pm2 logs signal-engine --lines 50
```

## Verificação

Após o deploy, verificar:
1. Novos sinais são criados com `PENDING`
2. Sinais são ativados para `ACTIVE` quando preço entra
3. Sinais fecham com `CLOSED_TP` ou `CLOSED_SL`
4. Frontend mostra sinais nas abas corretas
