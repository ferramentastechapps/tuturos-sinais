# 🧪 Como Testar os Dados Reais

## 🚀 Iniciar o Sistema

```bash
npm run dev
```

Acesse: `http://localhost:5173`

---

## ✅ O que Testar

### 1. Fear & Greed Index (Sentimento de Mercado)
**Localização:** Página Trading (Index)

**O que verificar:**
- [ ] O valor do índice (0-100) está sendo exibido
- [ ] A classificação está correta (Extreme Fear, Fear, Neutral, Greed, Extreme Greed)
- [ ] O gauge visual está funcionando
- [ ] A tendência (Alta/Baixa/Lateral) está sendo mostrada
- [ ] Loading skeleton aparece durante carregamento

**Como testar:**
1. Abra a página principal (Trading)
2. Procure o card "Sentimento" no lado direito
3. Verifique se o número está entre 0-100
4. Aguarde 1 hora e veja se atualiza automaticamente

**API usada:** https://api.alternative.me/fng/

---

### 2. Indicadores Técnicos Reais
**Localização:** Página Trading (Index) - Painel "Análise Técnica"

**O que verificar:**
- [ ] RSI (14) mostra valor entre 0-100
- [ ] MACD mostra valor calculado
- [ ] EMAs (20, 50, 200) mostram preços reais
- [ ] VWAP está sendo calculado
- [ ] Bollinger Bands mostra banda superior
- [ ] Sinais (COMPRA/VENDA/NEUTRO) estão corretos
- [ ] Contadores de sinais (bullish/bearish/neutral) estão funcionando
- [ ] Tendência geral está sendo calculada corretamente
- [ ] Loading skeleton aparece durante carregamento

**Como testar:**
1. Abra a página principal (Trading)
2. Procure o card "Análise Técnica"
3. Verifique se os valores fazem sentido com o preço atual do BTC
4. Aguarde 5 minutos e veja se os valores atualizam

**Exemplo de valores esperados para BTC:**
- RSI: 30-70 (normal), <30 (oversold), >70 (overbought)
- EMA 20: Próximo ao preço atual
- EMA 200: Mais distante do preço atual

---

### 3. Sinais de Trading Reais
**Localização:** Página Trading (Index) - Painel "Sinais de Trade"

**O que verificar:**
- [ ] Sinais estão sendo gerados para BTC, ETH, SOL
- [ ] Cada sinal tem: tipo (LONG/SHORT), entry, take profit, stop loss
- [ ] Risk/Reward ratio está calculado
- [ ] Confidence score está entre 60-95%
- [ ] Indicadores que geraram o sinal estão listados
- [ ] Timeframe está definido (4H)
- [ ] Tabs "Ativos" e "Histórico" funcionam
- [ ] Loading skeleton aparece durante carregamento

**Como testar:**
1. Abra a página principal (Trading)
2. Procure o card "Sinais de Trade"
3. Verifique se há sinais ativos
4. Clique nas tabs "Ativos" e "Histórico"
5. Aguarde 10 minutos e veja se novos sinais aparecem

**Lógica dos sinais:**
- **LONG:** Quando 60%+ dos indicadores são bullish
- **SHORT:** Quando 60%+ dos indicadores são bearish
- **Nenhum sinal:** Quando não há consenso claro

---

## 🔍 Verificar APIs no Console

Abra o DevTools (F12) e vá para a aba "Network":

### Fear & Greed Index
```
Request: https://api.alternative.me/fng/?limit=1
Response: { "data": [{ "value": "62", "value_classification": "Greed", ... }] }
```

### Preços CoinGecko
```
Request: https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana...
Response: [{ "id": "bitcoin", "current_price": 67542.30, ... }]
```

### Dados Históricos CoinGecko
```
Request: https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30
Response: { "prices": [[timestamp, price], ...] }
```

---

## 🐛 Troubleshooting

### Sinais não aparecem
**Possíveis causas:**
1. Não há consenso claro nos indicadores (normal)
2. Erro ao buscar dados históricos (verifique console)
3. Rate limit da API CoinGecko (aguarde alguns minutos)

**Solução:**
- Verifique o console do navegador (F12)
- Aguarde 10 minutos para nova tentativa
- Verifique se os preços estão sendo atualizados

### Indicadores não carregam
**Possíveis causas:**
1. Dados históricos insuficientes
2. Erro na API CoinGecko
3. Símbolo não encontrado

**Solução:**
- Verifique o console do navegador
- Tente recarregar a página
- Verifique sua conexão com internet

### Fear & Greed Index mostra 50 (Neutral)
**Possível causa:**
- API Alternative.me está fora do ar (raro)
- Fallback para valor neutro foi ativado

**Solução:**
- Aguarde alguns minutos
- Verifique se a API está online: https://api.alternative.me/fng/

---

## 📊 Comparar com Dados Reais

### Fear & Greed Index
Compare com: https://alternative.me/crypto/fear-and-greed-index/

### Preços
Compare com: https://www.coingecko.com/

### Indicadores Técnicos
Compare com: https://www.tradingview.com/chart/

---

## ⏱️ Intervalos de Atualização

| Dado | Atualização | Cache |
|------|-------------|-------|
| Preços | 30s | 15s |
| Indicadores | 5min | 3min |
| Sinais | 10min | 5min |
| Fear & Greed | 1h | 30min |

---

## 🎯 Checklist Final

- [ ] Sistema inicia sem erros
- [ ] Preços estão atualizando a cada 30s
- [ ] Fear & Greed Index mostra valor real
- [ ] Indicadores técnicos estão calculados
- [ ] Sinais aparecem (ou não, se não houver consenso)
- [ ] Loading states funcionam
- [ ] Não há erros no console
- [ ] APIs estão respondendo corretamente

---

## 🚨 Importante

- **Rate Limits:** CoinGecko free tier tem limite de 10-50 calls/min
- **Sinais:** Nem sempre haverá sinais ativos (é normal!)
- **Dados históricos:** Precisam de 50+ pontos para cálculos
- **Fear & Greed:** Atualiza 1x por dia na fonte original

---

## 📝 Logs Úteis

Para debug, adicione no console:

```javascript
// Ver dados do Fear & Greed
localStorage.getItem('REACT_QUERY_OFFLINE_CACHE')

// Forçar refresh
window.location.reload()

// Limpar cache
localStorage.clear()
```
