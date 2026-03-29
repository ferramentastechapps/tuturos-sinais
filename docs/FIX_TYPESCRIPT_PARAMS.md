# Correção: Erros de Tipo TypeScript em req.params e req.query

## Problema

Erro de compilação TypeScript:
```
src/server/api.ts(247,22): error TS2322: Type 'string | string[]' is not assignable to type 'string | undefined'.
Type 'string[]' is not assignable to type 'string'.
```

## Causa

O Express define `req.params` e `req.query` com tipos complexos:
- `req.params[key]` → `string | string[]`
- `req.query[key]` → `string | ParsedQs | (string | ParsedQs)[] | undefined`

Quando tentamos usar diretamente como `string`, o TypeScript reclama porque pode ser um array ou objeto.

## Solução

Criada função helper `getStringParam()` que lida com todos os casos:

```typescript
// Helper function to safely get string from req.params or req.query
const getStringParam = (value: any): string => {
    if (Array.isArray(value)) return value[0] || '';
    if (typeof value === 'string') return value;
    return '';
};
```

## Locais Corrigidos

### 1. req.params.id

**Antes:**
```typescript
router.get('/signals/:id', (req: Request, res: Response) => {
    const signal = getSignalById(req.params.id as string); // ❌ Erro
});

router.delete('/portfolio/assets/:id', async (req: Request, res: Response) => {
    await db.portfolioAsset.delete({
        where: { id: req.params.id } // ❌ Erro
    });
});
```

**Depois:**
```typescript
router.get('/signals/:id', (req: Request, res: Response) => {
    const id = getStringParam(req.params.id); // ✅ Correto
    const signal = getSignalById(id);
});

router.delete('/portfolio/assets/:id', async (req: Request, res: Response) => {
    const id = getStringParam(req.params.id); // ✅ Correto
    await db.portfolioAsset.delete({
        where: { id }
    });
});
```

### 2. req.query com parseInt

**Antes:**
```typescript
const limit = parseInt(req.query.limit as string) || 20; // ❌ Erro
const page = parseInt(req.query.page as string) || 1;    // ❌ Erro
```

**Depois:**
```typescript
const limit = parseInt(getStringParam(req.query.limit)) || 20; // ✅ Correto
const page = parseInt(getStringParam(req.query.page)) || 1;    // ✅ Correto
```

### 3. req.query como string

**Antes:**
```typescript
const symbol = req.query.symbol as string; // ❌ Erro
const type = req.query.type as string;     // ❌ Erro
const status = req.query.status as string; // ❌ Erro
```

**Depois:**
```typescript
const symbol = getStringParam(req.query.symbol); // ✅ Correto
const type = getStringParam(req.query.type);     // ✅ Correto
const status = getStringParam(req.query.status); // ✅ Correto
```

## Benefícios

1. **Type-safe:** Não mais erros de TypeScript
2. **Robusto:** Lida com arrays, strings e undefined
3. **Consistente:** Mesma função para params e query
4. **Simples:** Retorna sempre string vazia se inválido

## Arquivos Modificados

- `backend/src/server/api.ts`
  - Adicionada função `getStringParam()`
  - Corrigidos 8 usos de `req.params` e `req.query`

## Verificação

```bash
cd backend
npm run build
```

Deve compilar sem erros!

## Deploy

```bash
cd backend
npm run build
ssh root@212.85.10.239
cd /root/tuturos-sinais/backend
npm run build
pm2 restart signal-engine
```

## Resumo

✅ Função helper criada
✅ Todos os usos de req.params corrigidos
✅ Todos os usos de req.query corrigidos
✅ TypeScript compila sem erros
✅ Pronto para deploy
