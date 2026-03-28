# Dashboard ML Stats - Estatísticas de Aprendizado

## Novo Card na Dashboard

Foi adicionado um card visual na dashboard principal que mostra em tempo real as estatísticas do sistema de Machine Learning.

## Informações Exibidas

### 1. Win Rate (Destaque Principal)
- Taxa de acerto do robô em formato grande e destacado
- Exemplo: **68.5%** win rate

### 2. Wins vs Losses
- 🟢 Quantidade de trades vencedores (TP)
- 🔴 Quantidade de trades perdedores (SL)

### 3. Take Profits Alcançados
Grid com 3 colunas mostrando:
- **TP1**: Quantos sinais atingiram o primeiro alvo
- **TP2**: Quantos sinais atingiram o segundo alvo
- **TP3**: Quantos sinais atingiram o terceiro alvo

### 4. PnL Médio
- Lucro/prejuízo médio por trade em percentual
- Colorido (verde para positivo, vermelho para negativo)

### 5. Total de Sinais
- Contador total de sinais analisados pelo sistema

## Localização

O card aparece na **dashboard principal** (página Index), junto com:
- Card de Valor do Portfolio
- Card de Operações Recentes
- Card de Alertas Ativos

## Atualização Automática

- Os dados são atualizados automaticamente a cada **30 segundos**
- Não precisa recarregar a página

## Endpoint da API

**GET** `/api/ml/stats`

Retorna:
```json
{
  "enabled": true,
  "loaded": true,
  "totalSignals": 150,
  "wins": 103,
  "losses": 47,
  "winRate": 68.67,
  "tp1Hits": 103,
  "tp2Hits": 67,
  "tp3Hits": 28,
  "avgPnl": 2.45
}
```

## Arquivos Criados/Modificados

### Novos Arquivos:
- `src/components/dashboard/MLStatsCard.tsx` - Componente visual do card
- `src/hooks/useMLStats.ts` - Hook para buscar dados da API
- `docs/DASHBOARD_ML_STATS.md` - Esta documentação

### Modificados:
- `backend/src/server/api.ts` - Adicionado endpoint `/api/ml/stats`
- `src/components/dashboard/DashboardOverview.tsx` - Adicionado MLStatsCard

## Design

O card usa:
- Gradiente roxo/rosa (tema ML/IA)
- Ícone de cérebro (BrainCircuit)
- Grid responsivo para os TPs
- Cores semânticas (verde para wins, vermelho para losses)
- Animações suaves de carregamento
