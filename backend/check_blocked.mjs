// Diagnóstico: Verifica moedas/sinais bloqueados no Supabase
// node check_blocked.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://owchjtzucnhsvlkwdapn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Y2hqdHp1Y25oc3Zsa3dkYXBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODgyNzI0NCwiZXhwIjoyMDg0NDAzMjQ0fQ.rPk-VmP35j-7BiFQgkTkG99yVgVExWc3xF3G-yPUbVg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function checkBlocked() {
    console.log('🔍 Verificando moedas/sinais bloqueados no Supabase...\n');

    // 1. Distribuição geral de status
    const { data: allSignals } = await supabase
        .from('trade_signals')
        .select('pair, status, created_at')
        .order('created_at', { ascending: false });

    if (!allSignals) {
        console.error('❌ Sem dados na tabela trade_signals');
        return;
    }

    const statusCount = {};
    for (const s of allSignals) {
        statusCount[s.status] = (statusCount[s.status] ?? 0) + 1;
    }

    console.log('📊 Distribuição de Status (trade_signals):');
    for (const [status, count] of Object.entries(statusCount).sort((a, b) => b[1] - a[1])) {
        const bar = '█'.repeat(Math.min(30, Math.round(count / allSignals.length * 30)));
        console.log(`  ${status.padEnd(12)} ${String(count).padStart(5)}  ${bar}`);
    }

    // 2. Sinais com status "cancelled" agrupados por par
    const cancelled = allSignals.filter(s => s.status === 'cancelled');
    const cancelledByPair = {};
    for (const s of cancelled) {
        cancelledByPair[s.pair] = (cancelledByPair[s.pair] ?? 0) + 1;
    }

    console.log(`\n🚫 Pares com mais cancelamentos:`);
    Object.entries(cancelledByPair)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([pair, count]) => {
            console.log(`  ${pair.padEnd(12)} ${count} cancelados`);
        });

    // 3. Ainda ativos agora?
    const stillActive = allSignals.filter(s => s.status === 'active');
    console.log(`\n✅ Sinais ainda ACTIVE: ${stillActive.length}`);
    if (stillActive.length > 0) {
        stillActive.forEach(s => console.log(`  → ${s.pair} (${new Date(s.created_at).toLocaleString('pt-BR')})`));
    }

    // 4. Ver se tem tabelas de bloqueio de pares (ex: pair_blacklist, blocked_pairs)
    console.log('\n🔎 Checando outras tabelas de bloqueio...');
    const tablesToCheck = ['pair_blacklist', 'blocked_pairs', 'coin_blacklist', 'symbol_block', 'signal_filter'];
    for (const table of tablesToCheck) {
        const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' });
        if (!error) {
            console.log(`  ✅ Tabela '${table}' EXISTE`);
        }
        // silencia erros (tabela não existe)
    }
    console.log('  (tabelas não listadas = não existem no banco)');

    // 5. Últimos 5 sinais cancelados
    console.log('\n📋 Últimos 5 sinais cancelados:');
    const recent = allSignals
        .filter(s => s.status === 'cancelled')
        .slice(0, 5);
    recent.forEach(s => {
        console.log(`  ${s.pair.padEnd(12)} cancelado em ${new Date(s.created_at).toLocaleString('pt-BR')}`);
    });
}

checkBlocked().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
