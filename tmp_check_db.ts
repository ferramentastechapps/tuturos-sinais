import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Users/jotas/tuturos-sinais/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
    const { data: active, error: err1 } = await supabase.from('active_signals').select('*').limit(10);
    console.log('ACTIVE:', active?.map((a: any) => ({ id: a.id, status: a.status, created: a.created_at, updated: a.updated_at })));
    
    const { data: trades, error: err2 } = await supabase.from('trade_signals').select('*').limit(10);
    console.log('TRADES:', trades?.map((t: any) => ({ id: t.id, status: t.status, created: t.created_at, updated: t.updated_at })));
}

run();
