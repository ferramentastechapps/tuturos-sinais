# Feature: Filtros de Data e Robô no ML Analytics

## Problema
O usuário não conseguia filtrar os dados de ML por:
- Período (hoje, ontem, semana, mês)
- Tipo de robô (Swing vs Scalping)

## Solução Implementada

### Frontend (src/pages/MLAnalytics.tsx)
Adicionado card de filtros com:

1. **Filtro de Data**:
   - Todos (padrão)
   - Hoje
   - Ontem
   - Última Semana
   - Último Mês

2. **Filtro de Robô**:
   - Todos Robôs (padrão)
   - Swing Trading
   - Scalping

3. **Botão "Limpar Filtros"**:
   - Aparece quando algum filtro está ativo
   - Reseta para "Todos"

### Lógica de Filtros
- `getDateRange()`: Calcula range de datas baseado no filtro
- `loadData()`: Envia parâmetros de filtro para API
- Query params: `?startDate=...&endDate=...&robotType=...`

### Backend (Necessário Implementar)
Os endpoints precisam aceitar estes parâmetros:

**GET /api/ml/stats**
- `startDate` (opcional): ISO string
- `endDate` (opcional): ISO string  
- `robotType` (opcional): 'swing' | 'scalping'

**GET /api/ml/learning-history**
- `startDate` (opcional): ISO string
- `endDate` (opcional): ISO string
- `robotType` (opcional): 'swing' | 'scalping'
- `limit` (opcional): número de registros

## Próximos Passos

### 1. Implementar Filtros no Backend
Modificar os endpoints em `backend/src/server/api.ts`:

```typescript
// GET /api/ml/stats
router.get('/ml/stats', async (req, res) => {
    const { startDate, endDate, robotType } = req.query;
    
    let query = supabase
        .from('ml_training_data')
        .select('*');
    
    if (startDate) {
        query = query.gte('created_at', startDate);
    }
    if (endDate) {
        query = query.lte('created_at', endDate);
    }
    if (robotType && robotType !== 'all') {
        query = query.eq('trade_type', robotType);
    }
    
    // ... resto da lógica
});

// GET /api/ml/learning-history
router.get('/ml/learning-history', async (req, res) => {
    const { startDate, endDate, robotType, limit = 10 } = req.query;
    
    let query = supabase
        .from('ml_training_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(parseInt(limit as string));
    
    if (startDate) {
        query = query.gte('created_at', startDate);
    }
    if (endDate) {
        query = query.lte('created_at', endDate);
    }
    if (robotType && robotType !== 'all') {
        query = query.eq('trade_type', robotType);
    }
    
    // ... resto da lógica
});
```

### 2. Adicionar Campo `trade_type` na Tabela
Se ainda não existe, adicionar coluna na tabela `ml_training_data`:

```sql
ALTER TABLE ml_training_data 
ADD COLUMN IF NOT EXISTS trade_type VARCHAR(20);

-- Atualizar registros existentes baseado no timeframe ou outra lógica
UPDATE ml_training_data 
SET trade_type = CASE 
    WHEN timeframe = '5m' THEN 'scalping'
    ELSE 'swing'
END
WHERE trade_type IS NULL;
```

### 3. Garantir que Novos Registros Incluam `trade_type`
Modificar onde os dados são salvos para incluir o tipo de robô:

```typescript
// Ao salvar novo registro ML
await supabase.from('ml_training_data').insert({
    symbol: signal.symbol,
    result: result,
    profit_percent: profitPercent,
    trade_type: signal.source === 'scalping' ? 'scalping' : 'swing', // ou outra lógica
    // ... outros campos
});
```

## UI/UX

### Aparência
- Card de filtros com gradiente roxo/rosa
- Ícones para cada filtro (Calendar, BrainCircuit)
- Botão "Limpar Filtros" aparece apenas quando necessário

### Comportamento
- Filtros aplicam automaticamente ao mudar
- Loading state enquanto carrega dados filtrados
- Auto-refresh a cada 15s mantém filtros ativos

## Arquivos Modificados
- `src/pages/MLAnalytics.tsx` - Adicionado UI e lógica de filtros

## Arquivos a Modificar (Backend)
- `backend/src/server/api.ts` - Adicionar suporte a query params
- `backend/sql/migrations/` - Script para adicionar coluna `trade_type`
- `backend/src/services/mlService.ts` - Incluir `trade_type` ao salvar

## Teste Manual
1. Abrir ML Analytics
2. Selecionar "Hoje" no filtro de data
3. Verificar que apenas operações de hoje aparecem
4. Selecionar "Scalping" no filtro de robô
5. Verificar que apenas operações de scalping aparecem
6. Clicar em "Limpar Filtros"
7. Verificar que todos os dados voltam a aparecer
