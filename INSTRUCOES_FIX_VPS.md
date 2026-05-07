# 🚀 INSTRUÇÕES: Fix Filtro ML Analytics na VPS

## 🎯 PROBLEMA

O filtro de robôs não funciona porque:
- A tabela `ml_training_data` **na VPS** não tem a coluna `trade_type`
- Você estava consultando o Supabase **local** (20 registros mock)
- Mas o site usa o Supabase **da VPS** (45045 registros reais)

---

## ✅ SOLUÇÃO

### PASSO 1: Conectar na VPS

```bash
ssh seu-usuario@seu-servidor-vps
```

### PASSO 2: Adicionar coluna no Supabase

**Opção A: Via Supabase Dashboard**

1. Abra: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em "SQL Editor"
4. Cole e execute:

```sql
-- Adicionar coluna
ALTER TABLE ml_training_data 
ADD COLUMN IF NOT EXISTS trade_type TEXT;

-- Atualizar registros existentes
UPDATE ml_training_data 
SET trade_type = 'swing' 
WHERE trade_type IS NULL;

-- Verificar
SELECT 
    trade_type,
    COUNT(*) as total,
    SUM(CASE WHEN outcome_label = 1 THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN outcome_label = 0 THEN 1 ELSE 0 END) as losses
FROM ml_training_data
GROUP BY trade_type;
```

**Resultado esperado:**
```
trade_type | total | wins | losses
-----------|-------|------|-------
swing      | 45045 | 148  | 334
```

**Opção B: Via psql (se tiver acesso direto)**

```bash
psql $DATABASE_URL -c "ALTER TABLE ml_training_data ADD COLUMN IF NOT EXISTS trade_type TEXT;"
psql $DATABASE_URL -c "UPDATE ml_training_data SET trade_type = 'swing' WHERE trade_type IS NULL;"
```

### PASSO 3: Executar script de deploy na VPS

```bash
cd ~/tuturos-sinais
bash fix_filtro_vps.sh
```

**OU manualmente:**

```bash
cd ~/tuturos-sinais/backend

# Atualizar Prisma
npx prisma db pull
npx prisma generate

# Rebuild
npm run build

# Restart
pm2 restart backend
```

### PASSO 4: Testar

1. Abra: https://sinaiscripto.ftech-apps.com.br/ml-analytics
2. Clique em "Swing Trading" - deve mostrar 45045 sinais
3. Clique em "Scalping" - deve mostrar 0 sinais
4. Clique em "Todos" - deve mostrar 45045 sinais

---

## 🔍 VERIFICAÇÃO

### Verificar se a coluna foi adicionada:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ml_training_data'
AND column_name = 'trade_type';
```

### Verificar quantos registros têm trade_type:

```sql
SELECT 
    COUNT(*) as total,
    COUNT(trade_type) as com_tipo,
    COUNT(*) - COUNT(trade_type) as sem_tipo
FROM ml_training_data;
```

### Verificar distribuição:

```sql
SELECT trade_type, COUNT(*) as total
FROM ml_training_data
GROUP BY trade_type;
```

---

## 🐛 TROUBLESHOOTING

### Erro: "permission denied"

**Solução:** Use o usuário com permissões de admin no Supabase

### Filtro ainda não funciona após deploy

**Solução:**
1. Limpe o cache do navegador (Ctrl+Shift+R)
2. Verifique os logs: `pm2 logs backend`
3. Verifique se o backend reiniciou: `pm2 status`

### Números não batem

**Solução:**
1. Verifique se TODOS os registros têm trade_type:
   ```sql
   SELECT COUNT(*) FROM ml_training_data WHERE trade_type IS NULL;
   ```
2. Se houver NULL, execute o UPDATE novamente

---

## 📝 NOTAS

- **Backup:** O Supabase faz backup automático, mas se quiser garantir:
  ```bash
  pg_dump $DATABASE_URL > backup_antes_fix.sql
  ```

- **Rollback:** Se algo der errado:
  ```sql
  ALTER TABLE ml_training_data DROP COLUMN trade_type;
  ```

- **Identificar Scalping:** Depois que funcionar, você pode marcar sinais de scalping:
  ```sql
  -- Exemplo: marcar sinais com PnL pequeno como scalping
  UPDATE ml_training_data
  SET trade_type = 'scalping'
  WHERE ABS(outcome_pnl) < 2.0;
  ```

---

## ✅ CHECKLIST

- [ ] 1. Conectei na VPS
- [ ] 2. Executei o SQL no Supabase
- [ ] 3. Verifiquei que a coluna foi adicionada
- [ ] 4. Executei `npx prisma db pull`
- [ ] 5. Executei `npx prisma generate`
- [ ] 6. Executei `npm run build`
- [ ] 7. Executei `pm2 restart backend`
- [ ] 8. Testei o filtro no site
- [ ] 9. Filtro funciona! 🎉

---

**Pronto para executar! 🚀**
