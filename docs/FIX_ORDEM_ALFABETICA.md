# Fix: Ordem Alfabética - Ativo/Par

## Alteração

Padronizado o uso de "Ativo/Par" ou "Ativo" em ordem alfabética em todas as tabelas e formulários da interface.

## Arquivos Modificados

### 1. src/components/paperTrading/PaperHistory.tsx
**Antes:** `Par`
**Depois:** `Ativo/Par`

### 2. src/pages/SymbolAnalysis.tsx
**Antes:** `Par`
**Depois:** `Ativo/Par`

### 3. src/components/trades/TradesTable.tsx
**Mantido:** `Ativo` (já estava correto)

### 4. src/components/transactions/TransactionsTable.tsx
**Mantido:** `Ativo` (já estava correto)

### 5. src/components/portfolio/AddAssetDialog.tsx
**Antes:** `Par`
**Depois:** `Ativo/Par`

### 6. src/components/portfolio/PortfolioTable.tsx
**Mantido:** `Ativo` (já estava correto)

### 7. src/pages/SignalsGallery.tsx
**Antes:** `Ativo / Par` (com espaços)
**Depois:** `Ativo/Par` (sem espaços, padronizado)

### 8. src/pages/TaxReport.tsx
**Mantido:** `Ativo` (já estava correto)

## Padronização

Agora todos os lugares usam:
- `Ativo/Par` - quando mostra símbolo de trading (ex: BTCUSDT)
- `Ativo` - quando mostra apenas o ativo em contexto de portfólio

## Verificação

✅ Sem erros de compilação
✅ Ordem alfabética mantida
✅ Consistência visual melhorada
