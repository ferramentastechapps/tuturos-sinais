# Fix: Cancelamento Automático de Sinais Duplicados

## Problema
Múltiplos sinais ativos para a mesma moeda causavam confusão e dificultavam o gerenciamento de posições.

## Solução Implementada

### 1. Lógica de Cancelamento Automático
Quando um novo sinal é gerado para uma moeda, todos os sinais antigos (PENDING ou ACTIVE) dessa moeda são automaticamente cancelados.

### 2. Alterações no Código

**Arquivo: `backend/src/trading/tradeTracker.ts`**

- Adicionado método `cancelOldSignalsForPair()` que:
  - Busca todos os sinais ativos/pendentes da moeda
  - Atualiza o status para 'CANCELLED' no banco de dados
  - Remove os sinais da memória
  - Registra evento de cancelamento

- Modificado `registerNewSignal()` para:
  - Chamar `cancelOldSignalsForPair()` ANTES de criar o novo sinal
  - Garantir que apenas 1 sinal ativo por moeda existe

### 3. Fluxo de Execução

```
1. Novo sinal detectado para BTCUSDT
2. cancelOldSignalsForPair('BTCUSDT') é chamado
3. Sinais antigos são marcados como CANCELLED
4. Novo sinal é registrado
5. Apenas o novo sinal fica ativo
```

### 4. Teste
Execute o script de teste:
```bash
node backend/scripts/test_cancel_old_signals.mjs
```

## Benefícios
- ✅ Apenas 1 sinal ativo por moeda
- ✅ Evita confusão com sinais antigos
- ✅ Facilita gerenciamento de posições
- ✅ Histórico preservado (status CANCELLED)


## Status da Implementação

✅ **CONCLUÍDO** - A lógica de cancelamento automático foi implementada com sucesso.

### Arquivos Modificados

1. **backend/src/trading/tradeTracker.ts**
   - Adicionado método `cancelOldSignalsForPair()`
   - Modificado `registerNewSignal()` para cancelar sinais antigos

### Como Funciona

Quando `registerNewSignal()` é chamado:

```typescript
// 0. CANCELAR SINAIS ANTIGOS DA MESMA MOEDA
await this.cancelOldSignalsForPair(signal.pair!);

// 1. Criar novo sinal...
```

O método `cancelOldSignalsForPair()`:
1. Busca todos os sinais em memória para aquela moeda
2. Para cada sinal antigo:
   - Atualiza status para 'CANCELLED' no DB
   - Remove da memória
   - Registra evento de cancelamento
3. Garante que apenas o novo sinal ficará ativo

### Próximos Passos

Para testar em produção:
1. Compile o backend: `npm run build` (no diretório backend)
2. Reinicie o servidor
3. Observe os logs quando novos sinais forem gerados
4. Verifique no dashboard que apenas 1 sinal por moeda está ativo

### Logs Esperados

```
[TradeTracker] Registering new signal for BTCUSDT...
[TradeTracker] Cancelando 2 sinal(is) antigo(s) para BTCUSDT...
[TradeTracker] ✅ Sinal BTCUSDT-1234567890 cancelado
[TradeTracker] ✅ Sinal BTCUSDT-1234567891 cancelado
```
