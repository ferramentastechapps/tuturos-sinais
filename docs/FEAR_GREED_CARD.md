# Card de Ganância do Mercado (Fear & Greed Index)

## Descrição

Card visual na dashboard que mostra o **Índice de Medo e Ganância** do mercado cripto em tempo real, usando a API da Alternative.me.

## O que é o Fear & Greed Index?

É um indicador de sentimento do mercado que varia de **0 a 100**:

- **0-25**: 🔴 **Medo Extremo** - Oportunidade de compra
- **26-45**: 🟠 **Medo** - Cautela, mas pode ser entrada
- **46-55**: 🟡 **Neutro** - Mercado equilibrado
- **56-75**: 🟢 **Ganância** - Cuidado com topos
- **76-100**: 🟢 **Ganância Extrema** - Risco de correção alta

## Elementos Visuais

### 1. Valor Grande e Colorido
- Número de 0-100 em destaque
- Cor muda conforme o nível (vermelho → laranja → amarelo → verde)

### 2. Termômetro Horizontal
- Barra gradiente de vermelho (medo) a verde (ganância)
- Indicador branco mostra a posição atual
- Escala de 0 a 100 abaixo

### 3. Label Descritivo
- "Medo Extremo", "Medo", "Neutro", "Ganância", "Ganância Extrema"

### 4. Ícone de Tendência
- 📉 Seta para baixo (medo)
- ➖ Linha horizontal (neutro)
- 📈 Seta para cima (ganância)

### 5. Interpretação
- Conselho prático baseado no valor atual
- Exemplo: "Oportunidade de compra" quando está em medo extremo

### 6. Timestamp
- Horário da última atualização

## Atualização

- Atualiza automaticamente a cada **5 minutos**
- Usa cache para evitar sobrecarga da API
- Fallback para valor neutro (50) em caso de erro

## Uso Estratégico

O robô de sinais já usa este índice como uma das 25 features do ML:
- Ajuda a identificar extremos de mercado
- Medo extremo = possível fundo (oportunidade de compra)
- Ganância extrema = possível topo (cuidado com entradas)

## Localização

Aparece na **dashboard principal** junto com:
- Card de Portfolio
- Card de Operações Recentes
- Card de Alertas Ativos
- Card de ML Performance

## Fonte de Dados

API: https://api.alternative.me/fng/
- Gratuita e sem necessidade de API key
- Atualizada diariamente às 00:00 UTC
- Dados históricos disponíveis
