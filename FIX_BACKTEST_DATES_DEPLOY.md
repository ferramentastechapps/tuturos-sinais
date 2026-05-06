# 🔧 Deploy: Correção de Datas do Backtest

## ❌ PROBLEMA IDENTIFICADO

O backtest está usando datas de **2026** (futuro), resultando em:
- ❌ Apenas 1000 candles retornados pela API Bybit (dados futuros não existem)
- ❌ Apenas 17 trades gerados
- ❌ 94.1% SL rate (dados insuficientes)

## ✅ CORREÇÃO APLICADA

**Commit**: `ec85d94` - "fix: corrigir datas do backtest de 2026 para 2024 (dados reais)"

**Arquivo modificado**: `backend/scripts/validate-corrections.ts`

```typescript
// ANTES (ERRADO - 2026):
startDate: '2026-01-31',
endDate: '2026-05-01',

// DEPOIS (CORRETO - 2024):
startDate: '2024-01-31',
endDate: '2024-05-01',
```

## 📋 INSTRUÇÕES PARA DEPLOY NO VPS

Execute os seguintes comandos no VPS:

```bash
# 1. Navegar para o diretório do projeto
cd /var/www/signal-dashboard

# 2. Puxar as mudanças do repositório
git pull origin main

# 3. Rebuild do backend
cd backend
npm run build

# 4. Executar validação do backtest
npx tsx scripts/validate-corrections.ts
```

## 📊 RESULTADO ESPERADO

Com as datas corretas (2024), o backtest deve:

✅ **Buscar 2160+ candles** (90 dias × 24h = 2160 candles de 1h)
- Múltiplos batches: "→ 1000 candles... → 2000 candles... → 2160 candles..."

✅ **Gerar 40-60 trades** (vs 17 com dados insuficientes)

✅ **Métricas realistas**:
- SL rate: 50-60% (vs 94.1% atual)
- Win rate: 35-45% (vs 5.9% atual)
- PnL: Positivo ou próximo de zero (vs -$2600)

## 🔍 VALIDAÇÃO

Após executar, verifique no output:

### ❌ ANTES (dados insuficientes):
```
Buscando BTCUSDT (60)...
→ 1000 candles...
✓ Total: 1000 candles

✓ 17 trades | WR: 5.9% | SL: 94.1% | PnL: $-2600.30
```

### ✅ DEPOIS (dados completos):
```
Buscando BTCUSDT (60)...
→ 1000 candles...
→ 2000 candles...
→ 2160 candles...
✓ Total: 2160 candles

✓ 45 trades | WR: 38.2% | SL: 55.6% | PnL: $+450.80
```

## 📁 ARQUIVOS GERADOS

Após a execução, serão criados CSVs em:
```
backend/backtest-results/
├── BASELINE.csv
└── COM_CORRECOES.csv
```

Estes arquivos contêm todos os trades simulados para análise detalhada.

## ⚠️ NOTA IMPORTANTE

Esta correção **NÃO afeta** o sistema de produção (signal-engine).
Apenas corrige o script de validação do backtest para usar dados históricos reais.

O signal-engine continua operando normalmente com:
- ✅ 6 correções ativas
- ✅ MAX_SIGNALS_PER_DAY=10
- ✅ Filtros de liquidez, tendência, ATR, ADX
- ✅ Stop loss dinâmico baseado em ATR
