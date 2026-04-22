# 🚀 COMANDOS PARA DEPLOY DA FASE 1

## 📋 PASSO A PASSO COMPLETO

### **1️⃣ VERIFICAR MUDANÇAS LOCALMENTE**

```bash
# Ver arquivos modificados
git status

# Ver diferenças
git diff backend/src/lib/config.ts
git diff backend/src/engine/signalEngine.ts
git diff backend/src/engine/scalpingEngine.ts
```

---

### **2️⃣ FAZER COMMIT DAS MUDANÇAS**

```bash
# Adicionar arquivos modificados
git add backend/src/lib/config.ts
git add backend/src/engine/signalEngine.ts
git add backend/src/engine/scalpingEngine.ts
git add FASE1_IMPLEMENTADA.md
git add FASE1_RESUMO_VISUAL.md
git add ANALISE_DETALHADA_ROBOS.md
git add COMANDOS_DEPLOY_FASE1.md

# Fazer commit
git commit -m "FASE 1: Vetos críticos implementados

- Score mínimo 1H: 85 → 90
- ICT confirmações: 1 → 2  
- ML threshold 1H: 55% → 65%
- Score mínimo 5M: 80 → 85
- ML threshold 5M: 62% → 65%
- Limite diário: 13 → 8 sinais/dia
- Veto contra tendência macro 4H

Objetivo: Melhorar win rate de 32.7% para 50%+
Redução esperada: 60-70% dos sinais (apenas os melhores)"

# Enviar para o repositório
git push
```

---

### **3️⃣ CONECTAR NO VPS**

```bash
# Conectar via SSH
ssh root@212.85.10.239

# Ou se tiver configurado alias
ssh vps-sinais
```

---

### **4️⃣ ATUALIZAR CÓDIGO NO VPS**

```bash
# Ir para o diretório do projeto
cd /root/sinais-cripto

# Verificar branch atual
git branch

# Fazer backup antes de atualizar (opcional mas recomendado)
cp backend/src/lib/config.ts backend/src/lib/config.ts.backup
cp backend/src/engine/signalEngine.ts backend/src/engine/signalEngine.ts.backup
cp backend/src/engine/scalpingEngine.ts backend/src/engine/scalpingEngine.ts.backup

# Atualizar código
git pull

# Verificar se atualizou
git log -1
```

---

### **5️⃣ REINICIAR BACKEND**

```bash
# Reiniciar o backend
pm2 restart backend

# Verificar se está rodando
pm2 status

# Ver logs em tempo real
pm2 logs backend --lines 50
```

---

### **6️⃣ MONITORAR LOGS (CRÍTICO!)**

```bash
# Ver logs gerais
pm2 logs backend --lines 100

# Filtrar por FASE 1 (vetos novos)
pm2 logs backend | grep "FASE 1"

# Filtrar por vetos
pm2 logs backend | grep "VETO"

# Filtrar por scores
pm2 logs backend | grep "score="

# Filtrar por ICT
pm2 logs backend | grep "ICT"

# Filtrar por ML
pm2 logs backend | grep "filtered by ML"

# Ver sinais gerados
pm2 logs backend | grep "Signal generated"

# Ver limite diário
pm2 logs backend | grep "Limite diário"
```

---

### **7️⃣ VERIFICAR FUNCIONAMENTO**

```bash
# Verificar se backend está respondendo
curl http://localhost:3001/api/health

# Verificar sinais ativos
curl http://localhost:3001/api/signals | jq

# Verificar estatísticas
curl http://localhost:3001/api/stats | jq
```

---

### **8️⃣ MONITORAR TELEGRAM**

Abra o Telegram e verifique:

1. **Canal Principal (1H):**
   - Sinais devem diminuir drasticamente
   - Score deve ser ≥90
   - Deve ter 2+ confirmações ICT
   - Não deve ter sinais contra tendência

2. **Canal Scalping (5M):**
   - Sinais devem diminuir
   - Score deve ser ≥85
   - Qualidade deve melhorar

---

### **9️⃣ COMANDOS DE DIAGNÓSTICO**

```bash
# Ver quantos sinais foram gerados hoje
pm2 logs backend | grep "Signal generated" | wc -l

# Ver quantos sinais foram vetados por score
pm2 logs backend | grep "score=" | grep "VETADO" | wc -l

# Ver quantos sinais foram vetados por ICT
pm2 logs backend | grep "VETO ICT" | wc -l

# Ver quantos sinais foram vetados por ML
pm2 logs backend | grep "filtered by ML" | wc -l

# Ver quantos sinais foram vetados por tendência
pm2 logs backend | grep "contra tendência" | wc -l

# Ver limite diário atingido
pm2 logs backend | grep "Limite diário.*atingido"
```

---

### **🔟 ROLLBACK (SE NECESSÁRIO)**

Se algo der errado, você pode reverter:

```bash
# No VPS
cd /root/sinais-cripto

# Restaurar backups
cp backend/src/lib/config.ts.backup backend/src/lib/config.ts
cp backend/src/engine/signalEngine.ts.backup backend/src/engine/signalEngine.ts
cp backend/src/engine/scalpingEngine.ts.backup backend/src/engine/scalpingEngine.ts

# Reiniciar
pm2 restart backend

# Ou reverter pelo git
git reset --hard HEAD~1
pm2 restart backend
```

---

## 📊 CHECKLIST DE VALIDAÇÃO

Após o deploy, verifique:

```
DEPLOY:
├─ [ ] Código atualizado no VPS (git pull)
├─ [ ] Backend reiniciado (pm2 restart)
├─ [ ] Backend rodando (pm2 status)
└─ [ ] Logs sem erros (pm2 logs)

FUNCIONAMENTO:
├─ [ ] API respondendo (/api/health)
├─ [ ] Sinais diminuíram drasticamente
├─ [ ] Vetos aparecendo nos logs
├─ [ ] Score ≥90 nos sinais 1H
└─ [ ] Score ≥85 nos sinais 5M

QUALIDADE:
├─ [ ] Sinais com 2+ confirmações ICT
├─ [ ] Sinais a favor da tendência macro
├─ [ ] ML ≥65% nos sinais aprovados
├─ [ ] Máximo 8 sinais por dia
└─ [ ] Telegram mostrando sinais de qualidade
```

---

## ⚠️ PROBLEMAS COMUNS E SOLUÇÕES

### **Problema 1: Nenhum sinal sendo gerado**

```bash
# Verificar se os vetos estão muito rigorosos
pm2 logs backend | grep "VETO" | tail -50

# Solução temporária: Reduzir score para 88
# Editar: backend/src/engine/signalEngine.ts
# Linha ~785: const finalMinScore = 88;
```

### **Problema 2: Backend não reinicia**

```bash
# Ver erro
pm2 logs backend --err

# Verificar sintaxe TypeScript
cd /root/sinais-cripto/backend
npm run build

# Se houver erro de sintaxe, reverter mudanças
git reset --hard HEAD~1
pm2 restart backend
```

### **Problema 3: Logs muito verbosos**

```bash
# Filtrar apenas sinais importantes
pm2 logs backend | grep -E "(Signal generated|VETO|Limite diário)"

# Salvar logs em arquivo
pm2 logs backend --lines 1000 > logs_fase1.txt
```

### **Problema 4: Win rate não melhora após 7 dias**

```bash
# Verificar estatísticas
curl http://localhost:3001/api/stats | jq

# Analisar sinais fechados
# Verificar no dashboard web

# Se win rate continuar baixo:
# 1. Revisar Fase 2 (trailing stop)
# 2. Revisar Fase 3 (filtros avançados)
# 3. Considerar ajustar parâmetros
```

---

## 📈 MÉTRICAS PARA ACOMPANHAR

### **Diariamente (Primeiros 7 dias):**

```bash
# 1. Quantos sinais foram gerados?
pm2 logs backend | grep "Signal generated" | wc -l

# 2. Qual o score médio?
pm2 logs backend | grep "score=" | grep "PASSOU"

# 3. Quantos vetos por tipo?
pm2 logs backend | grep "VETO" | sort | uniq -c

# 4. Win rate dos novos sinais?
# Verificar no dashboard web ou Supabase
```

### **Semanalmente:**

```bash
# 1. Win rate geral melhorou?
# 2. Expectativa matemática é positiva?
# 3. Sinais estão com qualidade alta?
# 4. Pronto para Fase 2?
```

---

## 🎯 PRÓXIMOS PASSOS

Após validar a Fase 1 (3-7 dias):

1. **Se win rate melhorou para 45%+:**
   - ✅ Implementar Fase 2 (trailing stop)
   - ✅ Implementar Fase 3 (filtros avançados)

2. **Se win rate melhorou para 40-44%:**
   - ⚠️ Implementar Fase 2 primeiro
   - ⚠️ Aguardar mais dados antes da Fase 3

3. **Se win rate não melhorou (<40%):**
   - ❌ Revisar parâmetros da Fase 1
   - ❌ Analisar sinais perdedores
   - ❌ Ajustar vetos se necessário

---

## 📞 SUPORTE

Se precisar de ajuda:

1. **Verificar logs:** `pm2 logs backend --lines 200`
2. **Verificar status:** `pm2 status`
3. **Verificar API:** `curl http://localhost:3001/api/health`
4. **Rollback:** Seguir instruções acima

---

## ✅ CONCLUSÃO

Após executar todos os comandos acima:

```
✅ Fase 1 implementada com sucesso
✅ Backend rodando com novos vetos
✅ Monitoramento ativo
✅ Aguardando resultados (3-7 dias)

🎯 Objetivo: Win Rate 32.7% → 50%+
📊 Redução esperada: 60-70% dos sinais
🚀 Próximo passo: Fase 2 (trailing stop)
```

**BOA SORTE! 🍀**
