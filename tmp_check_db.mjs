import fs from 'fs';

const envFile = fs.readFileSync('c:/Users/jotas/tuturos-sinais/.env', 'utf-8');
let URL = '';
let KEY = '';
for (const line of envFile.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) URL = line.split('=')[1].trim().replace(/"/g, '');
  if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) KEY = line.split('=')[1].trim().replace(/"/g, '');
}

async function run() {
    const res1 = await fetch(`${URL}/rest/v1/active_signals?select=id,status,created_at,updated_at&limit=50`, {
        headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    });
    const active = await res1.json();
    console.log('ACTIVE SIGNALS:', active);
    if(Array.isArray(active)) {
      console.log('CLOSED ACTIVE SIGNALS:', active.filter((a) => a.status === 'CLOSED_TP' || a.status === 'CLOSED_SL'));
    }

    const res2 = await fetch(`${URL}/rest/v1/trade_signals?select=id,status,created_at,ml_data&limit=50&order=created_at.desc`, {
        headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    });
    const trades = await res2.json();
    console.log('TRADE SIGNALS:', trades);
    if(Array.isArray(trades)) {
      console.log('CLOSED TRADE SIGNALS:', trades.filter((a) => a.status === 'hit_tp' || a.status === 'hit_sl'));
    }
}

run();
