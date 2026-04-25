#!/usr/bin/env node

/**
 * Script para diagnosticar problema do dashboard não mostrando sinais
 */

const API_BASE = 'http://212.85.10.239:3001';

async function checkDashboard() {
    console.log('🔍 DIAGNÓSTICO: Dashboard não mostra sinais\n');
    console.log('═'.repeat(60));

    // 1. Verificar API de sinais ativos
    console.log('\n1️⃣ Verificando API /api/signals/active...');
    try {
        const res = await fetch(`${API_BASE}/api/signals/active`);
        const data = await res.json();
        console.log(`   Status: ${res.status}`);
        console.log(`   Sinais ativos: ${data.length || 0}`);
        if (data.length > 0) {
            console.log(`   Exemplo:`, JSON.stringify(data[0], null, 2).substring(0, 200));
        }
    } catch (error) {
        console.log(`   ❌ Erro: ${error.message}`);
    }

    // 2. Verificar API de histórico
    console.log('\n2️⃣ Verificando API /api/signals/history...');
    try {
        const res = await fetch(`${API_BASE}/api/signals/history`);
        const data = await res.json();
        console.log(`   Status: ${res.status}`);
        console.log(`   Sinais no histórico: ${data.length || 0}`);
        if (data.length > 0) {
            console.log(`   Últimos 3 sinais:`);
            data.slice(0, 3).forEach(s => {
                console.log(`     - ${s.pair} ${s.type} | Score: ${s.score || s.confidence} | Status: ${s.status} | ${new Date(s.created_at).toLocaleString()}`);
            });
        }
    } catch (error) {
        console.log(`   ❌ Erro: ${error.message}`);
    }

    // 3. Verificar API de resultados
    console.log('\n3️⃣ Verificando API /api/signals/results...');
    try {
        const res = await fetch(`${API_BASE}/api/signals/results`);
        const data = await res.json();
        console.log(`   Status: ${res.status}`);
        console.log(`   Total de sinais: ${data.total || 0}`);
        console.log(`   Wins: ${data.wins || 0}`);
        console.log(`   Losses: ${data.losses || 0}`);
        console.log(`   Win Rate: ${data.winRate || 0}%`);
    } catch (error) {
        console.log(`   ❌ Erro: ${error.message}`);
    }

    // 4. Verificar banco SQLite diretamente via SSH
    console.log('\n4️⃣ Verificando banco SQLite na VPS...');
    console.log('   Execute manualmente:');
    console.log('   ssh root@212.85.10.239');
    console.log('   cd /var/www/signal-dashboard/backend');
    console.log('   sqlite3 prisma/data/trading.db "SELECT COUNT(*) FROM TradeSignal;"');
    console.log('   sqlite3 prisma/data/trading.db "SELECT COUNT(*) FROM ActiveSignal;"');

    // 5. Verificar logs do PM2
    console.log('\n5️⃣ Verificar logs do signal-engine:');
    console.log('   ssh root@212.85.10.239 "pm2 logs signal-engine --lines 50"');

    console.log('\n═'.repeat(60));
    console.log('✅ Diagnóstico completo\n');
}

checkDashboard().catch(console.error);
