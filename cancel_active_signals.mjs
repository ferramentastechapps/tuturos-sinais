// Script para cancelar AGORA todos os sinais ativos no Supabase
// Uso: node cancel_active_signals.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://owchjtzucnhsvlkwdapn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Y2hqdHp1Y25oc3Zsa3dkYXBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODgyNzI0NCwiZXhwIjoyMDg0NDAzMjQ0fQ.rPk-VmP35j-7BiFQgkTkG99yVgVExWc3xF3G-yPUbVg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function cancelActiveSignals() {
    console.log('🔍 Buscando sinais ativos...');

    // Primeiro: listar os ativos para confirmar
    const { data: active, error: fetchErr } = await supabase
        .from('trade_signals')
        .select('id, pair, status, created_at, trade_type')
        .in('status', ['active', 'ACTIVE', 'PENDING', 'pending']);

    if (fetchErr) {
        console.error('❌ Erro ao buscar sinais:', fetchErr.message);
        process.exit(1);
    }

    console.log(`\n📊 Sinais encontrados: ${active.length}`);
    if (active.length === 0) {
        console.log('✅ Nenhum sinal ativo. Nada a fazer.');
        process.exit(0);
    }

    // Listar o que será cancelado
    const grouped = {};
    for (const s of active) {
        const key = s.status;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s.pair);
    }
    for (const [status, pairs] of Object.entries(grouped)) {
        console.log(`  [${status}] ${pairs.length} sinais: ${pairs.join(', ')}`);
    }

    // Confirmar cancelamento
    const now = new Date().toISOString();

    // Cancelar status 'active' — o único status ativo nessa tabela
    const { data: updatedActive, error: errActive } = await supabase
        .from('trade_signals')
        .update({ status: 'cancelled', updated_at: now })
        .in('status', ['active'])
        .select('id');

    // Não existe PENDING nessa tabela — só active/hit_tp/hit_sl/cancelled
    const totalCancelled = updatedActive?.length ?? 0;

    if (errActive) console.error('⚠️  Erro ao cancelar sinais ativos:', errActive.message);

    if (totalCancelled > 0) {
        console.log(`\n✅ ${totalCancelled} sinais cancelados com sucesso!`);
    } else {
        console.log('\n⚠️  Nenhum sinal foi atualizado. Verifique os valores de status no banco.');
    }

    // Verificação final
    const { count } = await supabase
        .from('trade_signals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

    console.log(`\n📋 Sinais ativos restantes: ${count ?? 0}`);
}

cancelActiveSignals().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
