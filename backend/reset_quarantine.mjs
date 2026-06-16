// Script para resetar pares em quarentena (status BLOCKED/BLOCKED_ACTIVE)
// Uso: node reset_quarantine.mjs
// Libera os pares para voltar a gerar sinais normalmente.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://owchjtzucnhsvlkwdapn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Y2hqdHp1Y25oc3Zsa3dkYXBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODgyNzI0NCwiZXhwIjoyMDg0NDAzMjQ0fQ.rPk-VmP35j-7BiFQgkTkG99yVgVExWc3xF3G-yPUbVg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function resetQuarantine() {
    console.log('🔍 Buscando pares em quarentena (BLOCKED / BLOCKED_ACTIVE)...\n');

    // Buscar sinais bloqueados nas tabelas relevantes
    const { data: blocked, error: fetchErr } = await supabase
        .from('active_signals')
        .select('id, pair, status, created_at, trade_type')
        .in('status', ['BLOCKED', 'BLOCKED_ACTIVE']);

    if (fetchErr) {
        console.error('❌ Erro ao buscar sinais bloqueados:', fetchErr.message);
        process.exit(1);
    }

    if (!blocked || blocked.length === 0) {
        console.log('✅ Nenhum par em quarentena na tabela active_signals. Verificando trade_signals...');
    } else {
        console.log(`📊 Sinais em quarentena encontrados: ${blocked.length}`);
        const byPair = {};
        for (const s of blocked) {
            if (!byPair[s.pair]) byPair[s.pair] = [];
            byPair[s.pair].push(s.status);
        }
        for (const [pair, statuses] of Object.entries(byPair)) {
            console.log(`  ${pair}: [${statuses.join(', ')}]`);
        }

        const now = new Date().toISOString();
        const { data: updated, error: updateErr } = await supabase
            .from('active_signals')
            .update({ status: 'CLOSED', closed_at: now })
            .in('status', ['BLOCKED', 'BLOCKED_ACTIVE'])
            .select('id, pair');

        if (updateErr) {
            console.error('❌ Erro ao atualizar quarentena:', updateErr.message);
        } else {
            console.log(`\n✅ ${updated?.length ?? 0} registros de quarentena fechados em active_signals!`);
            if (updated) {
                for (const r of updated) {
                    console.log(`  ✔ ${r.pair} (${r.id}) → CLOSED`);
                }
            }
        }
    }

    // Verificar também a tabela trade_signals
    const { data: blockedTs, error: fetchTsErr } = await supabase
        .from('trade_signals')
        .select('id, pair, status, created_at')
        .in('status', ['BLOCKED', 'BLOCKED_ACTIVE']);

    if (fetchTsErr) {
        console.error('❌ Erro ao buscar em trade_signals:', fetchTsErr.message);
    } else if (blockedTs && blockedTs.length > 0) {
        console.log(`\n📊 Sinais bloqueados em trade_signals: ${blockedTs.length}`);
        for (const s of blockedTs) {
            console.log(`  ${s.pair}: ${s.status} (${s.created_at?.slice(0, 10)})`);
        }

        const now = new Date().toISOString();
        const { data: updatedTs, error: updateTsErr } = await supabase
            .from('trade_signals')
            .update({ status: 'cancelled', updated_at: now })
            .in('status', ['BLOCKED', 'BLOCKED_ACTIVE'])
            .select('id, pair');

        if (updateTsErr) {
            console.error('❌ Erro ao atualizar trade_signals:', updateTsErr.message);
        } else {
            console.log(`✅ ${updatedTs?.length ?? 0} registros de quarentena fechados em trade_signals!`);
        }
    } else {
        console.log('\n✅ Nenhum par bloqueado em trade_signals.');
    }

    console.log('\n🚀 Reset de quarentena concluído! Os pares voltarão ao fluxo normal no próximo ciclo.');
}

resetQuarantine().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
