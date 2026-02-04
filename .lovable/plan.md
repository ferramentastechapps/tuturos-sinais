
# Plano: Correção dos Erros de Build

## Resumo
Existem 8 erros de TypeScript que precisam ser corrigidos em 2 arquivos. Os erros são causados por incompatibilidades entre a API atual do hook `usePortfolio` e os testes escritos para uma versão anterior.

---

## Erro 1: `src/services/coingeckoOHLC.ts` - Propriedade `volume` ausente

### Problema
O arquivo `advancedSignalGenerator.ts` (linha 81) tenta acessar `d.volume` mas o tipo `OHLCPoint` não possui essa propriedade.

### Solução
Adicionar a propriedade opcional `volume` ao tipo `OHLCPoint`:

```text
// Antes
interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Depois
interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;  // Opcional pois CoinGecko OHLC não retorna volume
}
```

---

## Erro 2: `src/hooks/usePortfolio.test.ts` - Testes desatualizados

### Problema
Os testes usam a API antiga do hook:
- **API antiga**: `addAsset({ symbol, name, amount, averagePrice, currentPrice })`
- **API atual**: `addAsset(symbol, quantity, buyPrice, fee?)`

Além disso:
- Propriedade `amount` não existe mais (agora é `quantity`)
- Propriedade `totalValue` não está exposta diretamente (agora está em `summary.totalValue`)
- A chave do localStorage mudou de `"portfolio"` para `"crypto-portfolio"`

### Solução
Reescrever os testes para usar a nova API:

| Teste | Mudança Necessária |
|-------|-------------------|
| "should add asset" | Usar `addAsset("BTC", 1, 50000)` ao invés do objeto |
| "should calculate total value" | Acessar `summary.totalValue` ao invés de `totalValue` |
| "should remove asset" | Manter lógica, apenas atualizar chamada do `addAsset` |
| "should persist to localStorage" | Usar chave `"crypto-portfolio"` e verificar `quantity` |

**Nota importante**: O teste "should add asset" não funcionará corretamente porque `addAsset` depende de `livePrices` de uma API externa. Para testes unitários funcionarem, seria necessário mockar o hook `useCryptoPrices`.

---

## Arquivos a Modificar

1. **`src/services/coingeckoOHLC.ts`**
   - Adicionar `volume?: number` ao tipo `OHLCPoint`

2. **`src/hooks/usePortfolio.test.ts`**
   - Atualizar todas as chamadas de `addAsset` para a nova assinatura
   - Mudar `amount` para `quantity`
   - Mudar `totalValue` para `summary.totalValue`
   - Atualizar chave do localStorage de `"portfolio"` para `"crypto-portfolio"`

---

## Detalhes Técnicos

### Novo formato do teste de adicionar asset:
```typescript
act(() => {
  result.current.addAsset("BTC", 1, 50000);
});

expect(result.current.assets[0].quantity).toBe(1);
```

### Novo formato do teste de valor total:
```typescript
expect(result.current.summary.totalValue).toBe(expectedValue);
```

### Consideração sobre mocking:
Os testes atuais podem falhar silenciosamente porque `addAsset` verifica se o símbolo existe em `livePrices` antes de adicionar. Para testes completos, seria necessário:
- Mockar `useCryptoPrices` para retornar dados de teste
- Ou criar um wrapper de teste que forneça os dados necessários

Por enquanto, as correções de tipo resolverão os erros de build, mas os testes podem precisar de mocking adicional para passar com sucesso.
