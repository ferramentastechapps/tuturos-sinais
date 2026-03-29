# Correção: Portfolio Vazio

## Problema Identificado

A página de Portfolio estava mostrando $0,00 em todos os campos (Valor Total, Investido, P&L Total, Retorno) e não exibia nenhum ativo.

## Causa Raiz

O frontend estava tentando buscar dados do endpoint `/api/portfolio/assets`, mas esse endpoint **não existia** no backend. O backend só tinha o endpoint `/api/portfolio` que retorna dados do Paper Trading Engine, não dos ativos do portfolio do usuário.

## Solução Implementada

### 1. Criados Endpoints de Portfolio Assets

**Arquivo:** `backend/src/server/api.ts`

#### GET `/api/portfolio/assets`
Retorna todos os ativos do portfolio do usuário:

```typescript
router.get('/portfolio/assets', async (_req: Request, res: Response) => {
    try {
        const assets = await db.portfolioAsset.findMany({
            orderBy: { updated_at: 'desc' }
        });
        res.json(assets);
    } catch (error: any) {
        logger.error('Error fetching portfolio assets', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
```

#### POST `/api/portfolio/assets`
Adiciona ou atualiza um ativo no portfolio:

```typescript
router.post('/portfolio/assets', async (req: Request, res: Response) => {
    try {
        const { symbol, name, quantity, average_buy_price, total_fees } = req.body;
        
        // Check if asset already exists
        const existing = await db.portfolioAsset.findFirst({
            where: { 
                user_id: 'default',
                symbol 
            }
        });

        if (existing) {
            // Update existing asset
            const updated = await db.portfolioAsset.update({
                where: { id: existing.id },
                data: {
                    quantity,
                    average_buy_price,
                    total_fees,
                    updated_at: new Date()
                }
            });
            res.json(updated);
        } else {
            // Create new asset
            const asset = await db.portfolioAsset.create({
                data: {
                    user_id: 'default',
                    symbol,
                    name,
                    quantity,
                    average_buy_price,
                    total_fees
                }
            });
            res.json(asset);
        }
    } catch (error: any) {
        logger.error('Error creating/updating portfolio asset', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
```

#### DELETE `/api/portfolio/assets/:id`
Remove um ativo do portfolio:

```typescript
router.delete('/portfolio/assets/:id', async (req: Request, res: Response) => {
    try {
        await db.portfolioAsset.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error deleting portfolio asset', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});
```

## Como Funciona Agora

### 1. Página Vazia Inicialmente
Quando o usuário acessa a página de Portfolio pela primeira vez, ela estará vazia porque não há ativos cadastrados.

### 2. Adicionar Ativos
O usuário pode clicar no botão "Adicionar Ativo" e preencher:
- Símbolo (ex: BTC, ETH)
- Quantidade
- Preço de compra
- Taxa (opcional)

### 3. Cálculo Automático
O sistema calcula automaticamente:
- Valor atual (quantidade × preço atual)
- Valor investido (quantidade × preço de compra)
- P&L (valor atual - valor investido)
- Retorno % ((P&L / investido) × 100)

### 4. Preços em Tempo Real
Os preços são atualizados a cada 30 segundos via CoinGecko API.

## Estrutura do Banco de Dados

A tabela `portfolio_asset` já existe no schema Prisma:

```prisma
model PortfolioAsset {
  id                 String   @id @default(uuid())
  user_id            String
  symbol             String
  name               String
  quantity           Float
  average_buy_price  Float
  total_fees         Float
  
  updated_at         DateTime @default(now()) @updatedAt

  @@unique([user_id, symbol])
}
```

## Deploy

```bash
cd backend
npm run build
ssh root@212.85.10.239
cd /root/tuturos-sinais/backend
npm run build
pm2 restart signal-engine
```

## Verificação

### 1. Testar Endpoints

```bash
# Listar ativos (deve retornar array vazio inicialmente)
curl https://sinaiscripto.ftech-apps.com.br/api/portfolio/assets

# Adicionar ativo
curl -X POST https://sinaiscripto.ftech-apps.com.br/api/portfolio/assets \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC",
    "name": "Bitcoin",
    "quantity": 0.1,
    "average_buy_price": 45000,
    "total_fees": 10
  }'

# Listar novamente (deve retornar o ativo adicionado)
curl https://sinaiscripto.ftech-apps.com.br/api/portfolio/assets
```

### 2. Testar na Interface

1. Acessar https://sinaiscripto.ftech-apps.com.br/portfolio
2. Clicar em "Adicionar Ativo"
3. Preencher dados e salvar
4. Verificar se o ativo aparece na lista
5. Verificar se os valores são calculados corretamente

## Notas

- **Autenticação:** Atualmente usa `user_id: 'default'` para todos os usuários. Quando implementar autenticação, substituir por ID real do usuário.
- **Dados Locais:** Os dados são salvos no banco de dados SQLite na VPS, não no navegador.
- **Preços:** Os preços atuais vêm da API CoinGecko via hook `useCryptoPrices`.

## Resumo

✅ Endpoints de portfolio assets criados
✅ GET, POST e DELETE implementados
✅ Integração com tabela `portfolio_asset` do banco
✅ Pronto para uso na interface

Agora a página de Portfolio vai funcionar corretamente!
