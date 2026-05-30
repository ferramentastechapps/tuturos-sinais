// Mostra o conteúdo das tabelas de bloqueio no Supabase
// node show_block_tables.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://owchjtzucnhsvlkwdapn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Y2hqdHp1Y25oc3Zsa3dkYXBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODgyNzI0NCwiZXhwIjoyMDg0NDAzMjQ0fQ.rPk-VmP35j-7BiFQgkTkG99yVgVExWc3xF3G-yPUbVg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function showBlockTables() {
    const tables = ['pair_blacklist', 'blocked_pairs', 'coin_blacklist', 'symbol_block', 'signal_filter'];

    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(100);
        if (error) {
            console.log(`\n❌ ${table}: ${error.message}`);
            continue;
        }
        console.log(`\n📋 Tabela: ${table} (${data.length} registros)`);
        if (data.length === 0) {
            console.log('   (vazia)');
        } else {
            console.table(data);
        }
    }
}

showBlockTables().catch(console.error);
