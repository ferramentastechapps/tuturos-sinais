# 🔍 Diagnóstico: Dados de Treinamento ML

## 📊 Status Atual

### ✅ Robôs Ativos no VPS (212.85.10.239)
1. **signal-engine** (PM2 ID: 0) - Robô de Swing Trade
   - Status: Online (58min uptime)
   - Memória: 189.9 MB
   - Localização: `/var/www/signal-dashboard/backend/`

2. **telegram-bot** (PM2 ID: 2) - Bot de notificações
   - Status: Online (58min uptime)
   - Memória: 88.4 MB

3. **nextjs** (PM2 ID: 3) - Frontend/Dashboard
   - Status: Online (52min uptime)
   - Memória: 55.7 MB

### 📂 Scripts de Treinamento Disponíveis

#### No VPS (`/var/www/signal-dashboard/backend/scripts/`):
- ✅ `train_super_robot.sh` - Script principal de treinamento
- ✅ `migrate_historical_to_training.py` - Migra dados históricos
- ✅ `retrain_model.py` - Retreina o modelo
- ✅ `retrain_from_sqlite.py` - Treina a partir do SQLite
- ✅ `check_ml_simple.mjs` - Verifica dados de treinamento
- ✅ `check_ml_data.ts` - Verifica dados ML
- ✅ `export_ml_data.ts` - Exporta dados ML
- ✅ `auto_retrain.sh` - Retreinamento automático

#### No diretório ML (`/opt/ml-training/`):
- ✅ `train_model.py` - Script de treinamento (com erro de dependência)
- ✅ `check_signals.py` - Verifica sinais
- ✅ `setup_training.sh` - Setup inicial

## ⚠️ Problemas Identificados

### 1. Erro no Treinamento ML
**Problema**: Script `/opt/ml-training/train_model.py` está com erro de importação:
```
ImportError: cannot import name 'mapping' from 'onnx'
```

**Causa**: Incompatibilidade de versões entre `onnx` e `skl2onnx`

**Impacto**: O cron job de treinamento automático (domingos às 3h) está falhando

### 2. Erro no TradeTracker
**Problema**: Logs mostram erro ao carregar sinais:
```
Error querying the database: Error code 14: Unable to open the database file
```

**Causa**: Problema com o arquivo do banco de dados SQLite (Prisma)

**Impacto**: Pode estar impedindo o salvamento de dados de treinamento

### 3. Cron Job Configurado
✅ **Existe** um cron job para treinamento automático:
```
0 3 * * 0 python3 /opt/ml-training/train_model.py >> /var/log/train_model.log 2>&1
```
- Executa: Todo domingo às 3h da manhã
- Mas está falhando devido ao erro de dependências

## 🔧 Soluções Necessárias

### Solução 1: Corrigir Dependências Python
```bash
ssh root@212.85.10.239
cd /opt/ml-training
pip3 install --upgrade onnx==1.15.0 skl2onnx==1.16.0
```

### Solução 2: Usar Script Correto de Treinamento
O script correto está em `/var/www/signal-dashboard/backend/scripts/train_super_robot.sh`
que usa seu próprio venv e dependências atualizadas.

**Atualizar cron job**:
```bash
# Remover cron antigo
crontab -e
# Substituir por:
0 3 * * 0 /var/www/signal-dashboard/backend/scripts/train_super_robot.sh >> /var/log/train_super_robot.log 2>&1
```

### Solução 3: Corrigir Erro do Prisma
```bash
ssh root@212.85.10.239
cd /var/www/signal-dashboard/backend
npx prisma generate
npx prisma migrate deploy
pm2 restart signal-engine
```

## 📋 Verificação de Dados

### Como Verificar se Dados Estão Sendo Salvos

#### 1. Via Script Local
```bash
cd backend/scripts
node check_ml_simple.mjs
```

#### 2. Via SSH no VPS
```bash
ssh root@212.85.10.239
cd /var/www/signal-dashboard/backend/scripts
node check_ml_simple.mjs
```

#### 3. Verificar Supabase Diretamente
```bash
# Executar migração em modo dry-run
ssh root@212.85.10.239
cd /var/www/signal-dashboard/backend/scripts
python3 migrate_historical_to_training.py --dry-run
```

## 🎯 Plano de Ação

### Imediato (Fazer Agora)
1. ✅ Corrigir dependências Python no `/opt/ml-training/`
2. ✅ Atualizar cron job para usar `train_super_robot.sh`
3. ✅ Corrigir erro do Prisma/SQLite
4. ✅ Verificar se dados estão sendo salvos

### Curto Prazo (Próximos Dias)
1. Executar migração manual de dados históricos
2. Treinar modelo com dados existentes
3. Monitorar logs de treinamento
4. Validar que novos sinais estão salvando features ML

### Médio Prazo (Próxima Semana)
1. Configurar monitoramento automático de treinamento
2. Criar dashboard de métricas ML
3. Implementar alertas de falha de treinamento
4. Documentar processo de retreinamento

## 📊 Sobre os 3 Robôs

### 1. Robô de Swing Trade (signal-engine)
- **Localização**: `/var/www/signal-dashboard/backend/`
- **Processo PM2**: `signal-engine`
- **Estratégia**: Sinais de médio prazo (horas/dias)
- **Treinamento ML**: ✅ Configurado (mas com erro)

### 2. Robô de Scalping
- **Localização**: Integrado no `signal-engine`
- **Estratégia**: Sinais de curto prazo (minutos)
- **Logs**: Mostram "Scalping Running" a cada minuto
- **Treinamento ML**: ✅ Usa mesmo sistema de ML

### 3. Robô de Cupons de Desconto
- **Localização**: Provavelmente `/root/affiliate-hub/`
- **Processo**: Detectado nos logs (node process)
- **Memória**: ~81 MB
- **Treinamento ML**: ❌ Não usa ML (é um bot diferente)

## 🚀 Scripts Criados para Diagnóstico

1. `Check-MLData.ps1` - Verifica status de treinamento
2. `Quick-VPSCheck.ps1` - Status geral do VPS
3. `Clean-VPSMemory.ps1` - Limpeza de memória

## 📝 Próximos Passos

Execute os scripts de correção na ordem:
1. `Fix-ML-Dependencies.ps1` - Corrige dependências
2. `Fix-Prisma-Database.ps1` - Corrige banco de dados
3. `Update-ML-Cron.ps1` - Atualiza cron job
4. `Test-ML-Training.ps1` - Testa treinamento manual
5. `Verify-ML-Data.ps1` - Verifica dados salvos

## ❓ Perguntas Respondidas

**Q: Os dados estão sendo salvos para treinamento?**
A: ⚠️ Parcialmente. O sistema está configurado, mas há erros:
   - TradeTracker com erro de banco de dados
   - Cron job de treinamento falhando
   - Precisa correção urgente

**Q: Os 3 robôs estão rodando?**
A: ✅ Sim, todos ativos:
   - Swing Trade: ✅ Online
   - Scalping: ✅ Online (integrado no signal-engine)
   - Cupons: ✅ Online (affiliate-hub)

**Q: O treinamento automático está funcionando?**
A: ❌ Não. Cron job configurado mas falhando por erro de dependências.
