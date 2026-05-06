# 🎨 Deploy Frontend - Instruções

## Problema Atual
- ✅ Backend deployado com sucesso (código atualizado, PM2 rodando)
- ✅ SQL executado no Supabase (tabela `backtest_strategies` criada)
- ❌ Frontend NÃO deployado (ainda mostrando versão antiga)

## Solução

### Execute este comando:
```powershell
.\deploy-frontend-only.ps1
```

Este script vai:
1. Remover os arquivos CSV conflitantes na VPS
2. Fazer `git pull` do código atualizado
3. Instalar dependências do frontend
4. Fazer build do frontend (`npm run build`)

### Após o deploy:
1. Abra o dashboard no navegador
2. Pressione **Ctrl+F5** para forçar reload (limpar cache)
3. Vá para a página de **Backtesting**

### O que você deve ver:
1. **Toggle Swing/Scalping** no topo da página
2. **Grid de estratégias** com cards clicáveis
3. **Botão "Adicionar Estratégia"** para criar novas estratégias

## Arquivos Modificados no Frontend
- `src/pages/Backtesting.tsx` - Nova UI com selector e grid
- `src/services/backtestService.ts` - Suporte para robot type

## Endpoints Backend (já deployados)
- `GET /api/backtest/strategies` - Lista estratégias
- `POST /api/backtest/strategies` - Cria nova estratégia
- `GET /api/backtest/robot-config/:type` - Config do robô (swing/scalping)

## Troubleshooting

### Se o script falhar:
Execute manualmente na VPS:
```bash
ssh root@212.85.10.239
cd /var/www/signal-dashboard
rm -f backend/backtest-results/*.csv
git pull origin main
npm install
npm run build
```

### Se ainda não ver as mudanças:
1. Verifique se o build foi bem-sucedido (sem erros)
2. Limpe o cache do navegador (Ctrl+Shift+Delete)
3. Tente em modo anônimo/privado
4. Verifique o console do navegador (F12) para erros

## Próximos Passos (após deploy)
1. Testar toggle Swing/Scalping
2. Testar seleção de estratégias
3. Testar criação de nova estratégia
4. Executar backtest com diferentes configurações
