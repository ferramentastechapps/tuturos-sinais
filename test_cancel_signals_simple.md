# Teste Manual: Cancelamento de Sinais Duplicados

## Como Testar

### 1. Verificar Sinais Atuais
```bash
# No backend, execute:
node -e "import('./dist/lib/dbClient.js').then(({db}) => db.activeSignal.findMany({where:{status:{in:['PENDING','ACTIVE']}}}).then(r => console.log(r)))"
```

### 2. Observar o Comportamento em Produção

Quando o sistema gerar um novo sinal para uma moeda que já tem sinais ativos:

1. O log mostrará:
   ```
   [TradeTracker] Cancelando X sinal(is) antigo(s) para BTCUSDT...
   [TradeTracker] ✅ Sinal BTCUSDT-123456 cancelado
   [TradeTracker] Registering new signal for BTCUSDT...
   ```

2. No banco de dados:
   - Sinais antigos terão `status = 'CANCELLED'`
   - Apenas o novo sinal terá `status = 'PENDING'` ou 'ACTIVE'

### 3. Verificar no Dashboard

- Acesse a galeria de sinais
- Filtre por moeda específica (ex: BTCUSDT)
- Deve aparecer apenas 1 sinal ativo
- Sinais cancelados aparecerão com status "Cancelado"

## Código Implementado

A lógica está em `backend/src/trading/tradeTracker.ts`:

```typescript
private async cancelOldSignalsForPair(pair: string) {
    const existingSignals = this.activeSignals.get(pair) || [];
    
    for (const oldSignal of existingSignals) {
        oldSignal.status = 'CANCELLED';
        await db.activeSignal.update({
            where: { id: oldSignal.id },
            data: { status: 'CANCELLED' }
        });
        this.removeSignalFromMemory(oldSignal.id, pair);
    }
}
```

Chamado em `registerNewSignal()` ANTES de criar o novo sinal.
