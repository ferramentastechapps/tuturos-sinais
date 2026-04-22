# 🔍 Diagnóstico de Memória VPS

## Status Atual

### VPS Principal (212.85.10.239)
✅ **Status: OK**
- **Memória**: 6.0 GB livres de 7.8 GB (23% usado)
- **Disco**: 77 GB livres de 96 GB (20% usado)
- **Swap**: 1.9 GB livres de 2.0 GB

### Processos Principais
1. **next-server**: 799 MB (9.8%) - Frontend Next.js
2. **signal-engine**: 188 MB (2.3%) - Backend principal
3. **telegram-bot**: 88 MB (1.1%) - Bot do Telegram

## Alertas Recebidos

Os alertas de memória cheia (80-99%) estão vindo de **outro servidor** (138.68.39.135) que:
- Não está acessível via SSH
- Não está configurado no projeto atual
- Pode ser um servidor antigo ou de outro projeto

## Scripts de Manutenção

### 1. Verificar Status
```powershell
.\Quick-VPSCheck.ps1
```
Mostra:
- Uso de memória
- Top 5 processos
- Status PM2
- Uso de disco

### 2. Limpar Memória
```powershell
.\Clean-VPSMemory.ps1
```
Executa:
- Limpa cache npm
- Limpa logs PM2
- Remove arquivos temporários
- Limpa logs antigos do sistema
- Limpa cache apt
- Reinicia processos PM2

### 3. Monitoramento Contínuo
```powershell
# Via SSH direto
ssh root@212.85.10.239 "watch -n 5 free -h"

# Logs em tempo real
ssh root@212.85.10.239 "pm2 logs"
```

## Recomendações

### Curto Prazo
1. ✅ VPS atual está saudável, não precisa ação imediata
2. 🔍 Investigar origem dos alertas (servidor 138.68.39.135)
3. 📊 Configurar monitoramento automático

### Médio Prazo
1. **Automatizar limpeza**: Criar cron job para limpeza semanal
2. **Alertas inteligentes**: Configurar alertas apenas quando >80% por >10min
3. **Logs rotativos**: Configurar logrotate para PM2

### Longo Prazo
1. **Upgrade se necessário**: Se uso consistente >70%, considerar upgrade
2. **Otimização**: Revisar processos que consomem mais memória
3. **Cache Redis**: Implementar cache para reduzir carga

## Comandos Úteis

```bash
# Verificar memória
ssh root@212.85.10.239 "free -h"

# Top processos por memória
ssh root@212.85.10.239 "ps aux --sort=-%mem | head -10"

# Status PM2
ssh root@212.85.10.239 "pm2 list"

# Logs PM2
ssh root@212.85.10.239 "pm2 logs --lines 100"

# Reiniciar processo específico
ssh root@212.85.10.239 "pm2 restart signal-engine"

# Limpar logs PM2
ssh root@212.85.10.239 "pm2 flush"
```

## Troubleshooting

### Memória alta persistente
1. Identificar processo: `ps aux --sort=-%mem | head -10`
2. Verificar logs: `pm2 logs [nome-processo]`
3. Reiniciar processo: `pm2 restart [nome-processo]`
4. Se persistir: `pm2 delete [nome-processo] && pm2 start ...`

### Disco cheio
1. Verificar uso: `du -sh /* | sort -h`
2. Limpar logs: `journalctl --vacuum-time=1d`
3. Limpar npm: `npm cache clean --force`
4. Limpar apt: `apt-get clean && apt-get autoclean`

### PM2 não responde
1. Verificar processo: `pm2 list`
2. Matar e reiniciar: `pm2 kill && pm2 resurrect`
3. Se falhar: `pm2 delete all && pm2 start ecosystem.config.js`

## Próximos Passos

1. [ ] Identificar servidor 138.68.39.135
2. [ ] Configurar cron job de limpeza automática
3. [ ] Implementar monitoramento com alertas inteligentes
4. [ ] Documentar processo de escalabilidade
