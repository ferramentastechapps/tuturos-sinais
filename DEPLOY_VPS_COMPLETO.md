# 🚀 DEPLOY COMPLETO: Fix Filtro ML Analytics na VPS

## 🎯 SITUAÇÃO

- **Problema:** Filtro de robôs não funciona
- **Causa:** Tabela `ml_training_data` não tem coluna `trade_type`
- **Onde:** Banco Supabase da VPS (45045 registros)

---

## ✅ SOLUÇÃO PASSO A PASSO

### PASSO 1: Adicionar coluna no Supabase

**Via Supabase Dashboard (RECOMENDADO):**

1. Acesse: https://supabase.com/dashboard
2. Selecione o projeto: `owchjtzucnhsvlkwdapn`
3. Vá em **SQL Editor**
4. Cole e execute este SQL:

```sql
-- Adicionar coluna trade_type
ALTER TABLE ml_training_data 
ADD COLUMN IF NOT EXISTS trade_type TEXT;

-- Atualizar todos os registros existentes
UPDATE ml_training_data 
SET trade_type = 'swing' 
WHERE trade_type IS NULL;

-- Verificar resultado
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

✅ **Confirme que o SQL foi executado com sucesso antes de continuar!**

---

### PASSO 2: Conectar na VPS e fazer deploy

```bash
# Conectar na VPS
ssh seu-usuario@seu-servidor-vps

# Ir para o diretório do projeto
cd ~/tuturos-sinais

# Fazer pull das mudanças do código
git pull origin main

# Ir para o backend
cd backend

# Atualizar Prisma com a nova coluna
npx prisma db pull
npx prisma generate

# Rebuild do backend
npm run build

# Restart do PM2
pm2 restart backend

# Verificar se está rodando
pm2 status
pm2 logs backend --lines 50
```

---

### PASSO 3: Testar

1. Abra: https://sinaiscripto.ftech-apps.com.br/ml-analytics
2. **Limpe o cache:** Ctrl+Shift+R (ou Cmd+Shift+R no Mac)
3. Teste os filtros:
   - Clique em "Swing Trading" → deve mostrar ~45045 sinais
   - Clique em "Scalping" → deve mostrar 0 sinais
   - Clique em "Todos" → deve mostrar ~45045 sinais

---

## 🔍 VERIFICAÇÕES

### Verificar se a coluna existe no Supabase:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ml_training_data'
AND column_name = 'trade_type';
```

**Esperado:** 1 linha com `trade_type | text`

### Verificar se todos os registros têm trade_type:

```sql
SELECT 
    COUNT(*) as total,
    COUNT(trade_type) as com_tipo,
    COUNT(*) FILTER (WHERE trade_type IS NULL) as sem_tipo
FROM ml_training_data;
```

**Esperado:** `sem_tipo = 0`

### Verificar logs do backend na VPS:

```bash
pm2 logs backend --lines 100
```

Procure por erros relacionados a `trade_type` ou `ml_training_data`.

---

## 🐛 TROUBLESHOOTING

### Problema: "Column trade_type does not exist"

**Causa:** O SQL não foi executado no Supabase

**Solução:** Execute o SQL no Supabase Dashboard novamente

### Problema: Filtro ainda não funciona

**Possíveis causas:**

1. **Cache do navegador**
   - Solução: Ctrl+Shift+R para limpar cache

2. **Backend não foi reiniciado**
   - Solução: `pm2 restart backend` na VPS

3. **Prisma não foi atualizado**
   - Solução: Execute `npx prisma db pull` e `npx prisma generate` novamente

4. **Código não foi atualizado**
   - Solução: `git pull origin main` na VPS

### Problema: Números não batem

**Causa:** Alguns registros ainda têm `trade_type = NULL`

**Solução:** Execute o UPDATE novamente:
```sql
UPDATE ml_training_data 
SET trade_type = 'swing' 
WHERE trade_type IS NULL;
```

---

## 📝 COMANDOS RÁPIDOS

### Deploy completo (copie e cole na VPS):

```bash
cd ~/tuturos-sinais && \
git pull origin main && \
cd backend && \
npx prisma db pull && \
npx prisma generate && \
npm run build && \
pm2 restart backend && \
pm2 logs backend --lines 20
```

### Verificar status:

```bash
pm2 status
pm2 logs backend --lines 50
```

### Rollback (se necessário):

```sql
ALTER TABLE ml_training_data DROP COLUMN trade_type;
```

---

## ✅ CHECKLIST FINAL

- [ ] 1. Executei o SQL no Supabase Dashboard
- [ ] 2. Verifiquei que retornou ~45045 registros com trade_type='swing'
- [ ] 3. Conectei na VPS via SSH
- [ ] 4. Executei `git pull origin main`
- [ ] 5. Executei `npx prisma db pull`
- [ ] 6. Executei `npx prisma generate`
- [ ] 7. Executei `npm run build`
- [ ] 8. Executei `pm2 restart backend`
- [ ] 9. Verifiquei logs com `pm2 logs backend`
- [ ] 10. Testei o filtro no site (Ctrl+Shift+R primeiro!)
- [ ] 11. Filtro funciona! 🎉

---

## 🎯 RESULTADO ESPERADO

**Antes:**
- Filtro "Swing": 45045 sinais
- Filtro "Scalping": 45045 sinais (não muda!)
- Filtro "Todos": 45045 sinais

**Depois:**
- Filtro "Swing": 45045 sinais ✅
- Filtro "Scalping": 0 sinais ✅
- Filtro "Todos": 45045 sinais ✅

---

**Pronto para executar! 🚀**

**Dúvidas? Me avise em qual passo está com dificuldade!**
