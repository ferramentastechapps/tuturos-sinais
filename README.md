# Tuturos Sinais 🚀

Sistema avançado de sinais de trading para criptomoedas com integração de Machine Learning, Gestão de Risco Dinâmica e Notificações via Telegram.

## 📋 Visão Geral

O **Tuturos Sinais** é uma plataforma completa que monitora o mercado de criptomoedas em tempo real, identifica oportunidades de trading com base em múltiplos indicadores técnicos (RSI, MACD, EMAs, Smart Money Concepts) e utiliza um modelo de Machine Learning (XGBoost/ONNX) para filtrar e validar os sinais.

### Funcionalidades Principais

- **Sinais em Tempo Real**: Monitoramento de múltiplos pares USDT perpétuos.
- **Machine Learning**: Modelo preditivo que atribui probabilidade de sucesso a cada sinal.
- **Gestão de Risco Dinâmica**: Ajuste automático de Stop Loss e Alavancagem baseado na volatilidade (ATR), Funding Rate e Sentimento do Mercado.
- **Dashboard Interativo**: Gráficos avançados, painel de sinais e métricas de portfólio.
- **Notificações Telegram**: Alertas instantâneos para novos sinais, Take Profits e Stop Losses (via Edge Function segura).
- **Integração Binance Futures**: Dados de preço, funding rate e open interest em tempo real.

## 🔄 Fluxo do Sistema

```ascii
[Binance API] ──> [Exchange Service] ──> [Adv. Signal Generator]
                                                │
                                                ▼
                                       [Dynamic Risk Adjuster]
                                                │
                                                ▼
[TensorFlow/ONNX] ──> [ML Prediction] ──> [Signal Filter]
                                                │
                                       ┌────────┴────────┐
                                       ▼                 ▼
                              [Dashboard UI]      [Telegram Bot]
```

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 18+
- Conta na Supabase (para Backend/Edge Functions)
- Bot no Telegram (para notificações)

### Passos
1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/tuturos-sinais.git
   cd tuturos-sinais
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente:
   Crie um arquivo `.env` na raiz com base no exemplo abaixo.
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## ⚙️ Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Supabase
VITE_SUPABASE_URL="https://seu-projeto.supabase.co"
VITE_SUPABASE_ANON_KEY="sua-chave-anonima"

# Telegram (Configuração via UI ou Edge Function recomendada)
# VITE_TELEGRAM_BOT_TOKEN removemos do frontend por segurança!
# Configure o token nos segredos da Edge Function no Supabase.
```

## 🤖 Configuração do Bot Telegram

1. Crie um bot com o [@BotFather](https://t.me/BotFather) e obtenha o Token.
2. No Dashboard do Supabase, vá em **Edge Functions** > **Secrets**.
3. Adicione o segredo `TELEGRAM_BOT_TOKEN` com o valor do seu token.
4. A Edge Function `telegram-proxy` já está configurada para usar esse segredo.

## 🧠 Machine Learning

O sistema utiliza um modelo **XGBoost** treinado com dados históricos e exportado para **ONNX**.
- **Retreinamento**: O script Python em `ml_engine/train_model.py` pode ser executado periodicamente para atualizar o modelo com novos dados.
- **Inferência**: Feita no navegador via `onnxruntime-web` para baixa latência.

## ⚠️ Aviso de Risco

**Este software é apenas para fins educacionais e informativos.** O trading de criptomoedas, especialmente futuros, envolve alto risco financeiro. O uso deste software não garante lucros. Opere com responsabilidade.

## 📝 Licença

MIT
