# 🔍 Seletor de Moedas - Documentação

## ✨ Nova Funcionalidade

Agora você pode **buscar e selecionar qualquer criptomoeda** disponível para análise técnica e geração de sinais!

---

## 🎯 Onde Encontrar

**Localização:** Página Trading (Index) - Coluna Central (acima do gráfico)

O seletor aparece como um botão grande mostrando:
- Símbolo da moeda atual (ex: BTCUSDT)
- Nome da moeda (ex: Bitcoin)
- Preço atual
- Variação 24h

---

## 🚀 Como Usar

### 1. Abrir o Seletor
Clique no botão do seletor (mostra a moeda atual)

### 2. Buscar Moeda
- Digite o nome ou símbolo no campo de busca
- Exemplos: "BTC", "Bitcoin", "ETH", "Ethereum"
- A busca é instantânea e case-insensitive

### 3. Selecionar Moeda
- Clique na moeda desejada da lista
- O seletor fecha automaticamente
- Todos os componentes atualizam para a moeda selecionada

---

## 📊 O que Atualiza Automaticamente

Quando você seleciona uma nova moeda, os seguintes componentes são atualizados:

### ✅ Gráficos
- **Candlestick Chart** - Gráfico de velas
- **Advanced Chart** - Gráfico avançado com indicadores
- **Mini Chart** - Gráfico de linha pequeno

### ✅ Análise Técnica
- **Technical Panel** - Todos os indicadores (RSI, MACD, EMAs, etc)
- Recalcula com dados históricos da moeda selecionada
- Atualiza sinais (COMPRA/VENDA/NEUTRO)
- Recalcula tendência geral

### ✅ Sinais de Trading
- **Signals Panel** - Gera sinais específicos para a moeda
- Calcula Entry, Take Profit, Stop Loss
- Atualiza confidence score
- Lista indicadores relevantes

### ✅ Informações da Moeda
- Preço atual
- Variação 24h
- Volume 24h
- Máxima e mínima 24h

---

## 🎨 Interface do Seletor

### Botão Principal
```
┌─────────────────────────────────────────┐
│ ⭐ BTCUSDT              $67,542.30      │
│    Bitcoin              +2.45%          │
└─────────────────────────────────────────┘
```

### Modal de Busca
```
┌─────────────────────────────────────────┐
│ Selecionar Criptomoeda                  │
│ Escolha uma moeda para análise...       │
├─────────────────────────────────────────┤
│ 🔍 Buscar por nome ou símbolo...        │
├─────────────────────────────────────────┤
│                                         │
│ ⭐ BTCUSDT    Bitcoin    $67,542.30 ↑  │
│    📈 +2.45%  Vol: $28.54B             │
│                                         │
│ ⭐ ETHUSDT    Ethereum   $3,456.78  ↓  │
│    📉 -1.23%  Vol: $15.23B             │
│                                         │
│    SOLUSDT    Solana    $178.45     ↑  │
│    📈 +5.67%  Vol: $3.46B              │
│                                         │
├─────────────────────────────────────────┤
│ 11 moedas • 7 em alta • 4 em baixa     │
└─────────────────────────────────────────┘
```

---

## 🌟 Recursos do Seletor

### ⭐ Favoritos
- Moedas favoritas têm ícone de estrela
- Aparecem no topo da lista
- Definidas no serviço CoinGecko

### 📈 Indicadores Visuais
- **↑ Verde** - Moeda em alta (24h positivo)
- **↓ Vermelho** - Moeda em baixa (24h negativo)
- **Volume** - Volume de negociação em bilhões

### 🔍 Busca Inteligente
- Busca por símbolo: "BTC", "ETH", "SOL"
- Busca por nome: "Bitcoin", "Ethereum", "Solana"
- Case-insensitive (maiúsculas/minúsculas)
- Resultados instantâneos

### 📊 Estatísticas
- Total de moedas disponíveis
- Quantas em alta vs baixa
- Atualizado em tempo real

---

## 💡 Moedas Disponíveis

Atualmente suportadas (via CoinGecko):

1. **BTCUSDT** - Bitcoin ⭐
2. **ETHUSDT** - Ethereum ⭐
3. **SOLUSDT** - Solana ⭐
4. **BNBUSDT** - BNB
5. **XRPUSDT** - XRP
6. **ADAUSDT** - Cardano
7. **DOGEUSDT** - Dogecoin
8. **AVAXUSDT** - Avalanche
9. **MATICUSDT** - Polygon
10. **DOTUSDT** - Polkadot
11. **LINKUSDT** - Chainlink

⭐ = Favorito (aparece na sidebar)

---

## 🔄 Fluxo de Atualização

```
1. Usuário seleciona moeda
   ↓
2. Estado selectedPair atualiza
   ↓
3. Componentes recebem novo símbolo via props
   ↓
4. Hooks fazem novas queries com o símbolo
   ↓
5. APIs buscam dados da nova moeda
   ↓
6. Indicadores são recalculados
   ↓
7. Sinais são regenerados
   ↓
8. Interface atualiza automaticamente
```

---

## ⚡ Performance

### Cache Inteligente
- Dados de cada moeda são cacheados
- Troca entre moedas é instantânea se já carregadas
- Cache expira conforme configuração:
  - Preços: 15 segundos
  - Indicadores: 3 minutos
  - Sinais: 5 minutos

### Rate Limiting
- Sinais são gerados sob demanda
- Evita sobrecarga da API CoinGecko
- Máximo 1 moeda por vez para sinais

---

## 🎯 Casos de Uso

### 1. Análise Rápida
```
1. Abrir seletor
2. Buscar "ETH"
3. Selecionar Ethereum
4. Ver indicadores e sinais instantaneamente
```

### 2. Comparação de Moedas
```
1. Analisar Bitcoin (indicadores, sinais)
2. Trocar para Ethereum
3. Comparar indicadores
4. Decidir qual tradear
```

### 3. Monitoramento de Favoritos
```
1. Verificar BTC (favorito)
2. Verificar ETH (favorito)
3. Verificar SOL (favorito)
4. Escolher melhor oportunidade
```

### 4. Descoberta de Oportunidades
```
1. Buscar moedas menos conhecidas
2. Analisar indicadores técnicos
3. Verificar se há sinais de entrada
4. Avaliar risk/reward
```

---

## 🛠️ Arquivos Modificados

### Novo Arquivo:
- `src/components/trading/CoinSelector.tsx` - Componente do seletor

### Arquivos Atualizados:
- `src/pages/Index.tsx` - Integração do seletor
- `src/hooks/useRealTimeSignals.ts` - Aceita símbolo opcional
- `src/components/trading/SignalsPanel.tsx` - Aceita símbolo via props
- `src/components/trading/TechnicalPanel.tsx` - Já aceitava símbolo

---

## 🎨 Customização

### Adicionar Mais Moedas
Edite `src/services/coingecko.ts`:

```typescript
const SYMBOL_TO_ID: Record<string, string> = {
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  // Adicione aqui:
  UNIUSDT: 'uniswap',
  AAVEUSDT: 'aave',
  // ...
};
```

### Marcar como Favorito
No mesmo arquivo, ajuste a lógica:

```typescript
isFavorite: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'NOVAMOEDA'].includes(...)
```

---

## 🐛 Troubleshooting

### Moeda não aparece na busca
**Causa:** Moeda não está mapeada no `SYMBOL_TO_ID`
**Solução:** Adicione o mapeamento em `coingecko.ts`

### Indicadores não carregam
**Causa:** Dados históricos insuficientes
**Solução:** Aguarde alguns minutos, API pode estar lenta

### Sinais não aparecem
**Causa:** Não há consenso claro nos indicadores (normal)
**Solução:** Tente outra moeda ou aguarde mercado se definir

---

## 📱 Responsividade

O seletor é totalmente responsivo:

- **Desktop:** Modal grande com lista completa
- **Tablet:** Modal médio, scroll vertical
- **Mobile:** Modal fullscreen, fácil de usar com dedos

---

## ✅ Checklist de Teste

- [ ] Abrir seletor
- [ ] Buscar por símbolo (ex: "BTC")
- [ ] Buscar por nome (ex: "Bitcoin")
- [ ] Selecionar moeda
- [ ] Verificar se gráficos atualizam
- [ ] Verificar se indicadores atualizam
- [ ] Verificar se sinais atualizam
- [ ] Trocar entre várias moedas
- [ ] Verificar performance (deve ser rápido)
- [ ] Testar em mobile

---

## 🎉 Benefícios

✅ **Flexibilidade** - Analise qualquer moeda disponível
✅ **Rapidez** - Troca instantânea entre moedas
✅ **Intuitivo** - Interface simples e clara
✅ **Completo** - Todos os dados atualizam automaticamente
✅ **Eficiente** - Cache inteligente e rate limiting
✅ **Responsivo** - Funciona em qualquer dispositivo

---

## 🚀 Próximas Melhorias (Opcional)

1. **Adicionar mais moedas** - Expandir lista de suportadas
2. **Filtros avançados** - Por volume, variação, market cap
3. **Comparação lado a lado** - Comparar 2 moedas
4. **Alertas personalizados** - Por moeda específica
5. **Histórico de análises** - Salvar moedas analisadas
6. **Favoritos customizáveis** - Usuário escolhe favoritos

---

Aproveite a nova funcionalidade! 🎯
