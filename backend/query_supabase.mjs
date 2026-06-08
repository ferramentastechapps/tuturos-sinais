import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://owchjtzucnhsvlkwdapn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Y2hqdHp1Y25oc3Zsa3dkYXBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODgyNzI0NCwiZXhwIjoyMDg0NDAzMjQ0fQ.rPk-VmP35j-7BiFQgkTkG99yVgVExWc3xF3G-yPUbVg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    console.log('--- SUPABASE DATA CHECK ---');
    
    const { data: signals, error: sigError } = await supabase
        .from('trade_signals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (sigError) {
        console.error('Error fetching trade_signals:', sigError);
    } else {
        console.log(`Total trade_signals fetched: ${signals.length}`);
        for (const s of signals) {
            console.log(`- ID: ${s.id} | Symbol: ${s.pair} | TradeType: ${s.trade_type} | Status: ${s.status} | CreatedAt: ${s.created_at}`);
        }
    }

    const { data: mlData, error: mlError } = await supabase
        .from('ml_training_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (mlError) {
        console.error('Error fetching ml_training_data:', mlError);
    } else {
        console.log(`Total ml_training_data fetched: ${mlData.length}`);
        for (const m of mlData) {
            console.log(`- ID: ${m.id} | Symbol: ${m.symbol} | TradeType: ${m.trade_type} | OutcomeLabel: ${m.outcome_label} | CreatedAt: ${m.created_at}`);
        }
    }
}

run();
