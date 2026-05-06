# 🚀 Feature: Melhorias no Backtesting

## 📋 Resumo

Implementadas 3 melhorias principais na página de Backtesting:

1. **Seletor de Robô Funcional** (Swing vs Scalping)
2. **Estratégias Dinâmicas** carregadas do banco de dados
3. **Interface para Adicionar Novas Estratégias**

## ✨ Funcionalidades Implementadas

### 1. Seletor de Robô

**Localização**: Seção "Configurações do Robô"

**Funcionalidade**:
- Toggle entre "Swing Trading" e "Scalping"
- Carrega configurações específicas de cada robô
- Botão "Usar Config Swing/Scalping (90d)"

**Diferenças**:

| Parâmetro | Swing | Scalping |
|-----------|-------|----------|
| **Símbolos** | BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT | BTCUSDT, ETHUSDT, SOLUSDT |
| **Score Mínimo** | 75 | 70 |
| **Max Posições** | 5 | 8 |
| **Capital/Posição** | 10% | 5% |
| **Timeframe** | 1h | 5m |
| **Estratégia** | DEFAULT | SCALPING_BOT |

### 2. Estratégias Dinâmicas

**Localização**: Nova seção "Estratégias Disponíveis"

**Funcionalidade**:
- Grid de cards com todas as estratégias disponíveis
- Carregadas dinamicamente do banco de dados
- Seleção visual com indicador de estratégia ativa
- Mostra: Nome, Tipo, Timeframe, Descrição, Indicadores

**Estratégias Padrão**:
1. Signal Engine Padrão (Score) - 1h Swing
2. Robô de Scalping (5m) - 5m Scalping
3. EMA Cross Volume - 15m Swing
4. RSI Divergence - 1h Swing
5. Bollinger Squeeze - 15m Day-Trade
6. VWAP Reversion - 5m Scalping
7. MACD Cross - 4h Swing
8. ADX Trend Follow - 4h Swing
9. Order Block + FVG SMC - 15m Day-Trade
10. Golden Cross Swing - 1d Position

### 3. Adicionar Novas Estratégias

**Localização**: Botão "+ Nova Estratégia" na seção de estratégias

**Campos do Formulário**:
- **Nome da Estratégia** * (obrigatório)
- **Tipo**: Swing Trading, Scalping, Day Trade, Position Trading
- **Timeframe**: 1m, 5m, 15m, 30m, 1h, 4h, 1d
- **Indicadores**: Lista separada por vírgula (ex: EMA, RSI, MACD)
- **Descrição** * (obrigatório)

**Validação**:
- Nome e descrição obrigatórios
- Feedback visual de sucesso/erro
- Recarrega lista automaticamente após criação

## 🔧 Implementação Técnica

### Frontend

**Arquivo**: `src/pages/Backtesting.tsx`

**Mudanças**:
1. Adicionado estado `selectedRobot` ('swing' | 'scalping')
2. Adicionado estado `availableStrategies` (array)
3. Adicionado estado `showAddStrategy` (boolean)
4. Criado componente `AddStrategyForm`
5. useEffect para carregar estratégias na montagem
6. Atualizado `handleLoadBotConfig` para aceitar tipo de robô

**Novo Componente**: `AddStrategyForm`
- Formulário controlado com React state
- Validação client-side
- POST para `/api/backtest/strategies`
- Callback `onSuccess` para recarregar lista

### Backend

**Arquivo**: `backend/src/server/routes/backtestRoutes.ts`

**Novos Endpoints**:

#### GET `/api/backtest/strategies`
```typescript
// Retorna todas as estratégias disponíveis
Response: {
  success: boolean;
  strategies: Array<{
    id: string;
    name: string;
    description: string;
    type: string;
    timeframe: string;
    indicators: string[];
    created_at: string;
  }>;
}
```

#### POST `/api/backtest/strategies`
```typescript
// Cria uma nova estratégia
Body: {
  name: string;
  description: string;
  type: 'swing' | 'scalping' | 'day-trade' | 'position';
  timeframe: string;
  indicators: string[];
}

Response: {
  success: boolean;
  strategy: { ... };
}
```

#### GET `/api/backtest/robot-config/:type`
```typescript
// Retorna configuração do robô (swing ou scalping)
Params: type = 'swing' | 'scalping'

Response: {
  success: boolean;
  config: {
    symbols: string[];
    signal: {
      minScore: number;
      maxSimultaneousPositions: number;
      maxCapitalPerPosition: number;
      allowLong: boolean;
      allowShort: boolean;
      useMLFilter: boolean;
    };
    timeframe: string;
    strategyId: string;
  };
}
```

### Serviço

**Arquivo**: `src/services/backtestService.ts`

**Mudança**: `loadBotConfig`
```typescript
// ANTES
export const loadBotConfig = async (): Promise<Partial<BacktestConfig>>

// DEPOIS
export const loadBotConfig = async (
  robotType: 'swing' | 'scalping' = 'swing'
): Promise<Partial<BacktestConfig>>
```

Agora usa o novo endpoint `/api/backtest/robot-config/:type` com fallback para o método antigo.

### Banco de Dados

**Arquivo**: `backend/sql/create_backtest_strategies_table.sql`

**Nova Tabela**: `backtest_strategies`

```sql
CREATE TABLE backtest_strategies (
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL, -- swing, scalping, day-trade, position
    timeframe TEXT NOT NULL,
    indicators TEXT[],
    config JSONB,
    is_active BOOLEAN,
    created_by TEXT
);
```

**Índices**:
- `idx_backtest_strategies_type`
- `idx_backtest_strategies_timeframe`
- `idx_backtest_strategies_created_at`

**Trigger**: `update_backtest_strategies_updated_at`

**Seed Data**: 10 estratégias padrão inseridas automaticamente

## 📦 Deploy

### 1. Banco de Dados

Execute o script SQL no Supabase:

```bash
# Via Supabase Dashboard
# SQL Editor → New Query → Cole o conteúdo de:
backend/sql/create_backtest_strategies_table.sql
```

Ou via CLI:

```bash
psql $DATABASE_URL -f backend/sql/create_backtest_strategies_table.sql
```

### 2. Backend

```bash
cd backend
npm run build
pm2 restart signal-engine
```

### 3. Frontend

```bash
npm run build
# Deploy para seu hosting (Vercel, Netlify, etc.)
```

## 🧪 Testes

### Teste 1: Seletor de Robô

1. Acesse `/backtesting`
2. Vá para aba "Configuração"
3. Clique em "📊 Swing Trading"
4. Clique em "🤖 Usar Config Swing (90d)"
5. Verifique se carregou: Score 75, 5 posições, 5 símbolos
6. Clique em "⚡ Scalping"
7. Clique em "🤖 Usar Config Scalping (90d)"
8. Verifique se carregou: Score 70, 8 posições, 3 símbolos

### Teste 2: Estratégias Dinâmicas

1. Role até "Estratégias Disponíveis"
2. Verifique se aparecem 10 estratégias padrão
3. Clique em uma estratégia
4. Verifique se o campo "Estratégia" no formulário foi atualizado
5. Verifique se o card ficou destacado (borda azul + ícone ✓)

### Teste 3: Adicionar Estratégia

1. Clique em "+ Nova Estratégia"
2. Preencha:
   - Nome: "Minha Estratégia Teste"
   - Tipo: "Swing Trading"
   - Timeframe: "1h"
   - Indicadores: "EMA, RSI"
   - Descrição: "Teste de criação de estratégia"
3. Clique em "✓ Criar Estratégia"
4. Verifique se aparece na lista
5. Clique nela para selecionar

## 🐛 Troubleshooting

### Estratégias não aparecem

**Causa**: Tabela não criada no Supabase

**Solução**:
```bash
# Execute o script SQL
psql $DATABASE_URL -f backend/sql/create_backtest_strategies_table.sql
```

### Erro ao criar estratégia

**Causa**: Permissões do Supabase

**Solução**:
```sql
-- No Supabase SQL Editor
GRANT ALL ON backtest_strategies TO anon, authenticated;
```

### Config do robô não carrega

**Causa**: Endpoint não disponível

**Solução**:
```bash
# Rebuild e restart do backend
cd backend
npm run build
pm2 restart signal-engine
pm2 logs signal-engine --lines 50
```

## 📊 Métricas de Sucesso

- ✅ Seletor de robô funcional
- ✅ Estratégias carregadas dinamicamente
- ✅ Formulário de criação funcional
- ✅ Persistência no banco de dados
- ✅ UI responsiva e intuitiva
- ✅ Feedback visual claro

## 🔮 Próximos Passos

1. **Editar Estratégias**: Permitir edição de estratégias existentes
2. **Deletar Estratégias**: Adicionar botão de exclusão
3. **Duplicar Estratégias**: Clonar estratégia como base
4. **Importar/Exportar**: JSON de estratégias
5. **Compartilhar**: Compartilhar estratégias entre usuários
6. **Favoritos**: Marcar estratégias favoritas
7. **Estatísticas**: Mostrar performance de cada estratégia
8. **Templates**: Biblioteca de templates prontos

## 📝 Notas

- As estratégias padrão são inseridas automaticamente no primeiro deploy
- O seletor de robô usa configurações hardcoded no backend (pode ser movido para .env)
- A tabela `backtest_strategies` é compartilhada entre todos os usuários (adicionar `user_id` para multi-tenant)
- O formulário valida apenas no client-side (adicionar validação no backend)

## 🎨 Screenshots

### Antes
- Dropdown estático com estratégias hardcoded
- Sem seletor de robô
- Sem opção de adicionar estratégias

### Depois
- Toggle visual Swing/Scalping
- Grid de cards com estratégias dinâmicas
- Botão "+ Nova Estratégia" com formulário
- Indicador visual de estratégia selecionada
- Badges de indicadores em cada card

## ✅ Checklist de Deploy

- [ ] Executar SQL no Supabase
- [ ] Rebuild do backend
- [ ] Restart do PM2
- [ ] Rebuild do frontend
- [ ] Deploy do frontend
- [ ] Testar seletor de robô
- [ ] Testar listagem de estratégias
- [ ] Testar criação de estratégia
- [ ] Verificar logs do backend
- [ ] Verificar console do browser
