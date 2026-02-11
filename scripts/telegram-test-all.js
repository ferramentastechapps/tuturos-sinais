/**
 * Telegram All Notifications Test
 * Sends one message of EACH type to verify all 7 notifications work
 * No external dependencies
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Read .env
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    let val = trimmed.slice(eqIndex + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
    }
    env[key] = val;
});

const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = env.TELEGRAM_CHAT_ID;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

if (!BOT_TOKEN || !CHAT_ID) {
    console.error('❌ TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não encontrado no .env');
    process.exit(1);
}

async function send(text) {
    const res = await fetch(`${API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: CHAT_ID,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
        }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description);
    return data.result;
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));
const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

async function run() {
    console.log('🤖 Enviando todas as 7 notificações de teste...\n');

    // ──────── 1. NOVO SINAL ────────
    console.log('1/7 📊 Enviando Novo Sinal...');
    await send([
        '🟢 SINAL LONG — BTCUSDT',
        '━━━━━━━━━━━━━━━━━━━━',
        '💯 Score: 87/100 (FORTE)',
        '⏱ Timeframe: 4h',
        '📊 Preço Atual: $97,245.30',
        '',
        '📈 ENTRADA',
        'Zona: $96,800.00 — $97,500.00',
        '',
        '🛑 STOP LOSS',
        'Preço: $95,200.00',
        'Distância: -2.1%',
        '',
        '🎯 TAKE PROFITS',
        'TP1: $99,500.00 (+2.3%) — fechar 35%',
        'TP2: $101,800.00 (+4.7%) — fechar 35%',
        'TP3: $104,200.00 (+7.1%) — fechar 30%',
        '',
        '⚖️ RISCO/RETORNO: 1:3.4',
        '',
        '📊 CONFLUÊNCIAS ATIVAS',
        '✅ RSI Oversold + Bounce',
        '✅ EMA 200 Support',
        '✅ MACD Bullish Cross',
        '✅ Volume Spike',
        '',
        '💰 GESTÃO DE RISCO',
        'Alavancagem sugerida: 5x',
        'Tamanho sugerido: 10% do capital',
        'Risco: 1% do capital',
        '',
        `🕐 ${ts()}`,
    ].join('\n'));
    console.log('  ✅ Novo Sinal enviado!');
    await delay(1500);

    // ──────── 2. TAKE PROFIT ────────
    console.log('2/7 ✅ Enviando Take Profit...');
    await send([
        '✅ TAKE PROFIT ATINGIDO — BTCUSDT',
        '━━━━━━━━━━━━━━━━━━━━',
        '📍 TP1 atingido: $99,500.00 (+2.3%)',
        '⏱ Duração: 6h 45min',
        '💵 Resultado parcial: +2.3%',
        '📊 Posição restante: 65% ainda aberta',
        '🎯 Próximo alvo: TP2 $101,800.00',
    ].join('\n'));
    console.log('  ✅ Take Profit enviado!');
    await delay(1500);

    // ──────── 3. STOP LOSS ────────
    console.log('3/7 ❌ Enviando Stop Loss...');
    await send([
        '❌ STOP LOSS ATINGIDO — ETHUSDT',
        '━━━━━━━━━━━━━━━━━━━━',
        '📍 Stop: $3,150.00 (-2.8%)',
        '⏱ Duração: 3h 20min',
        '💵 Resultado: -2.8%',
        '📉 Win Rate hoje: 66.7% (2W / 1L)',
    ].join('\n'));
    console.log('  ✅ Stop Loss enviado!');
    await delay(1500);

    // ──────── 4. ALERTA DE RISCO ────────
    console.log('4/7 ⚠️ Enviando Alerta de Risco...');
    await send([
        '⚠️ ALERTA DE RISCO',
        '━━━━━━━━━━━━━━━━━━━━',
        '🔴 Tipo: Drawdown Diário Aviso',
        '📊 Valor atual: 3.2% (limite: 3%)',
        '💡 Ação: Reduzir tamanho das posições. Drawdown de 3.2%.',
        `🕐 ${ts()}`,
    ].join('\n'));
    console.log('  ✅ Alerta de Risco enviado!');
    await delay(1500);

    // ──────── 5. RESUMO DIÁRIO ────────
    console.log('5/7 📋 Enviando Resumo Diário...');
    await send([
        `📊 RESUMO DO DIA — ${new Date().toISOString().split('T')[0]}`,
        '━━━━━━━━━━━━━━━━━━━━',
        '📈 Sinais gerados: 12',
        '✅ Vencedores: 8 (66.7%)',
        '❌ Perdedores: 4 (33.3%)',
        '',
        '💰 PERFORMANCE',
        'PnL do dia: +3.2%',
        'Melhor operação: SOLUSDT +5.4%',
        'Pior operação: ADAUSDT -2.1%',
        '',
        '🏆 TOP SINAIS DO DIA',
        '1. BTCUSDT LONG — Score 92',
        '2. ETHUSDT LONG — Score 87',
        '3. SOLUSDT SHORT — Score 84',
        '',
        '⚠️ ALERTAS DO DIA',
        '- Drawdown diário atingiu 3.2%',
        '- Funding rate BTC elevado (+0.12%)',
        '',
        '🕐 Próximo resumo: amanhã 23:00 UTC',
    ].join('\n'));
    console.log('  ✅ Resumo Diário enviado!');
    await delay(1500);

    // ──────── 6. ALERTA DE MERCADO ────────
    console.log('6/7 🚨 Enviando Alerta de Mercado...');
    await send([
        '🚨 ALERTA DE MERCADO',
        '━━━━━━━━━━━━━━━━━━━━',
        '📊 SOLUSDT — 📉 Crash detectado! Queda de 6.2%',
        '📉 Variação de -6.2% nos últimos 15 minutos',
        '💧 Liquidações: $85M em 1 hora',
        '⚠️ Movimento rápido de queda. Verifique stops e reduza exposição.',
        `🕐 ${ts()}`,
    ].join('\n'));
    console.log('  ✅ Alerta de Mercado enviado!');
    await delay(1500);

    // ──────── 7. FUNDING RATE ────────
    console.log('7/7 ⚡ Enviando Funding Rate...');
    await send([
        '⚡ FUNDING RATE EXTREMO',
        '━━━━━━━━━━━━━━━━━━━━',
        '📊 BTCUSDT',
        '💹 Funding: +0.15% (muito alto)',
        '📌 Sinal contrário: viés de QUEDA',
        '⚠️ Funding alto = muitos longs. Possível queda. Cuidado com LONG.',
        `🕐 ${ts()}`,
    ].join('\n'));
    console.log('  ✅ Funding Rate enviado!');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Todas as 7 notificações enviadas com sucesso!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📊 1. Novo Sinal         ✅');
    console.log('✅ 2. Take Profit        ✅');
    console.log('❌ 3. Stop Loss          ✅');
    console.log('⚠️  4. Alerta de Risco    ✅');
    console.log('📋 5. Resumo Diário      ✅');
    console.log('🚨 6. Alerta de Mercado  ✅');
    console.log('⚡ 7. Funding Rate       ✅');
    console.log('');
    console.log('Verifique todas as mensagens no Telegram! 📱');
}

run().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
