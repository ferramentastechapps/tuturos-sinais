# 🚀 DEPLOY: Fix Filtro ML Analytics

## 📋 O QUE FOI CORRIGIDO

O filtro de robôs (Swing/Scalping) no ML Analytics não funcionava porque:

1. ❌ A tabela `MLTrainingData` não tinha a coluna `trade_type`
2. ❌ A API buscava de `trade_signals` (que só tem 65 sinais ativos)
3. ❌ Os dados reais estão em `ml_training_data` (25415 registros)

### ✅ Correções Aplicadas:

1. **Adicionada coluna `trade_type` em `MLTrainingData`**
2. **API `/ml/stats` agora busca de `ml_training_data`**
3. **API `/ml/learning-history` agora busca de `ml_training_data`**
4. **Filtro `robotType` agora funciona corretamente**

---

## 🔧 PASSOS PARA DEPLOY

### 1. Aplicar Migration no Supabase

Execute o SQL no Supabase SQL Editor:

```bash
# Abra o arquivo e execute no Supabase:
apply_trade_type_migration.sql
```

Ou copie e cole este SQL:

```sql
-- Adicionar coluna trade_type
ALTER TABLE "MLTrainingData" 
ADD COLUMN IF NOT EXISTS "trade_type" TEXT;

-- Atualizar registros existentes com 'swing'
UPDATE "MLTrainingData" 
SET "trade_type" = 'swing' 
WHERE "trade_type" IS NULL;

-- Verificar
SELECT trade_type, COUNT(*) as total
FROM "MLTrainingData"
GROUP BY trade_type;
```

### 2. Atualizar Prisma Schema

```bash
cd backend
npx prisma db pull
npx prisma generate
```

### 3. Rebuild e Restart do Backend

```bash
# No diretório backend
npm run build

# Restart do servidor (VPS)
pm2 restart backend
# OU
pm2 restart all
```

### 4. Verificar se funcionou

Abra o ML Analytics e teste:
1. Clique em "Swing Trading" - deve mostrar ~25415 sinais
2. Clique em "Scalping" - deve mostrar 0 sinais (ou os que tiver)
3. Clique em "Todos" - deve mostrar todos

---

## 🧪 TESTES

### Teste 1: Verificar coluna no banco

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'MLTrainingData'
AND column_name = 'trade_type';
```

**Esperado:** Deve retornar 1 linha com `trade_type | text`

### Teste 2: Verificar dados

```sql
SELECT 
    trade_type,
    COUNT(*) as total,
    SUM(CASE WHEN outcome_label = 1 THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN outcome_label = 0 THEN 1 ELSE 0 END) as losses
FROM "MLTrainingData"
GROUP BY trade_type;
```

**Esperado:**
```
trade_type | total | wins | losses
-----------|-------|------|-------
swing      | 25415 | 135  | 371
```

### Teste 3: Testar API

```bash
# Sem filtro
curl http://localhost:3001/api/ml/stats

# Com filtro swing
curl "http://localhost:3001/api/ml/stats?robotType=swing"

# Com filtro scalping
curl "http://localhost:3001/api/ml/stats?robotType=scalping"
```

**Esperado:** Os números devem mudar conforme o filtro!

---

## 📝 PRÓXIMOS PASSOS (Opcional)

### Identificar sinais de Scalping

Se você tiver sinais de scalping misturados, pode identificá-los assim:

```sql
-- Exemplo: Se você sabe que sinais de scalping têm características específicas
-- (ajuste a lógica conforme necessário)

-- Por símbolo
UPDATE "MLTrainingData"
SET trade_type = 'scalping'
WHERE symbol IN ('BTCUSDT', 'ETHUSDT') -- seus pares de scalping
AND entry_time > '2026-03-01'; -- data que começou scalping

-- Por PnL (scalping geralmente tem PnL menor)
UPDATE "MLTrainingData"
SET trade_type = 'scalping'
WHERE ABS(outcome_pnl) < 2.0; -- scalping tem ganhos/perdas menores

-- Verificar resultado
SELECT trade_type, COUNT(*) as total
FROM "MLTrainingData"
GROUP BY trade_type;
```

---

## 🎯 RESULTADO ESPERADO

Após o deploy, no ML Analytics:

**Filtro: Todos**
- Dados de Treino: 25415
- Win Rate: 29.9%
- 135W / 371L

**Filtro: Swing Trading**
- Dados de Treino: 25415 (ou menos se tiver scalping)
- Win Rate: ~29.9%
- 135W / 371L (ou menos)

**Filtro: Scalping**
- Dados de Treino: 0 (até você marcar alguns como scalping)
- Win Rate: N/A
- 0W / 0L

---

## ⚠️ IMPORTANTE

- **Backup:** Faça backup do banco antes de aplicar a migration
- **Teste local primeiro:** Se possível, teste em ambiente local
- **Monitore logs:** Após deploy, monitore os logs do backend para erros

---

## 🐛 TROUBLESHOOTING

### Erro: "column trade_type does not exist"

**Solução:** Execute a migration SQL novamente

### Filtro ainda não funciona

**Solução:** 
1. Limpe o cache do navegador (Ctrl+Shift+R)
2. Verifique se o backend foi reiniciado
3. Verifique os logs do backend

### Números não batem

**Solução:**
1. Verifique se todos os registros têm `trade_type` preenchido
2. Execute: `SELECT COUNT(*) FROM "MLTrainingData" WHERE trade_type IS NULL;`
3. Se houver NULL, execute o UPDATE novamente

---

**Pronto para deploy! 🚀**
