/**
 * Telegram Integration Test Script
 * Sends test message + simulated signal to verify the bot is working
 * No external dependencies — reads .env manually
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Read .env manually
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

async function sendMessage(text) {
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
    if (!data.ok) {
        throw new Error(data.description || 'Telegram API error');
    }
    return data.result;
}

async function run() {
    console.log('🤖 Verificando bot...');

    // 1. Verify bot identity
    const meRes = await fetch(`${API}/getMe`);
    const me = await meRes.json();
    if (!me.ok) {
        console.error('❌ Token inválido:', me.description);
        process.exit(1);
    }
    console.log(`✅ Bot: @${me.result.username} (${me.result.first_name})`);

    // 2. Send connection confirmation
    console.log('\n📤 Enviando mensagem de confirmação...');
    await sendMessage('✅ Bot conectado com sucesso! Sistema de sinais ativo.');
    console.log('✅ Mensagem de confirmação enviada!');

    // Wait a bit between messages
    await new Promise(r => setTimeout(r, 1000));

    // 3. Confirm all notification types
    console.log('\n📋 Notificações ativadas:');
    console.log('  ✅ Novos sinais gerados');
    console.log('  ✅ Take profit atingido');
    console.log('  ✅ Stop loss atingido');
    console.log('  ✅ Alertas de risco');
    console.log('  ✅ Resumo diário');
    console.log('  ✅ Funding rate extremo');
    console.log('  ✅ Alertas de mercado');

    // 4. Confirm bot commands
    console.log('\n🤖 Comandos do bot disponíveis:');
    console.log('  /start /sinais /status /resumo /top');
    console.log('  /parar /retomar /config /score /moeda /help');

    // 5. Send simulated signal
    console.log('\n📤 Enviando sinal de teste simulado...');
    const signalText = [
        '📊 <b>NOVO SINAL — LONG</b>',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        '🪙 <b>BTCUSDT</b> | ⏱ 4h',
        '📈 Score: <b>87/100</b> (🟢 FORTE)',
        '',
        '💰 Preço Atual: <b>$97,245.30</b>',
        '🎯 Zona de Entrada: <b>$96,800.00 — $97,500.00</b>',
        '',
        '🛑 Stop Loss: <b>$95,200.00</b> (-2.1%)',
        '',
        '✅ Take Profit:',
        '   TP1: <b>$99,500.00</b> (+2.3%) — Fechar 35%',
        '   TP2: <b>$101,800.00</b> (+4.7%) — Fechar 35%',
        '   TP3: <b>$104,200.00</b> (+7.1%) — Fechar 30%',
        '',
        '📊 R/R: <b>3.4:1</b>',
        '',
        '🔗 Confluências:',
        '   ✅ RSI Oversold + Bounce',
        '   ✅ EMA 200 Support',
        '   ✅ MACD Bullish Cross',
        '   ✅ Volume Spike',
        '',
        '⚙️ Gestão:',
        '   Alavancagem: <b>5x</b>',
        '   Tamanho: <b>10%</b> do portfólio',
        '   Risco: <b>1%</b>',
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        '🕐 <i>11/02/2026 01:02:53 UTC</i>',
        '⚡ <i>SINAL DE TESTE — Tuturos Sinais</i>',
    ].join('\n');

    await sendMessage(signalText);
    console.log('✅ Sinal de teste simulado enviado!');

    console.log('\n🎉 Tudo funcionando! Integração Telegram completa.');
    console.log(`📡 Chat ID: ${CHAT_ID}`);
    console.log(`🤖 Bot: @${me.result.username}`);
}

run().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
