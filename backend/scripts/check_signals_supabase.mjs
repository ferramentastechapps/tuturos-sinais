import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
let URL = '';
let KEY = '';
for (const line of envFile.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) URL = line.split('=')[1].trim().replace(/"/g, '');
  if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) KEY = line.split('=')[1].trim().replace(/"/g, '');
}

if (!URL || !KEY) {
  console.error('❌ Não foi possível ler as credenciais do Supabase do .env');
  process.exit(1);
}

async function checkSignals() {
  try {
    console.log('🔍 Verificando sinais no banco...\n');

    // Buscar todos os sinais
    const res = await fetch(`${URL}/rest/v1/trade_signals?select=id,pair,type,status,created_at&order=created_at.desc&limit=100`, {
      headers: { 
        'apikey': KEY, 
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      console.error('❌ Erro na API:', res.status, res.statusText);
      const text = await res.text();
      console.error('Resposta:', text);
      return;
    }

    const signals = await res.json();
    
    console.log(`📊 Total de sinais: ${signals.length}\n`);

    // Contar por status
    const statusCount = {};
    signals.forEach(s => {
      statusCount[s.status] = (statusCount[s.status] || 0) + 1;
    });

    console.log('📈 Contagem por Status:');
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log('\n📋 Últimos 10 sinais:');
    signals.slice(0, 10).forEach(s => {
      console.log(`   ${s.id.substring(0, 8)}... | ${s.pair} | ${s.type} | ${s.status} | ${new Date(s.created_at).toLocaleString()}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

checkSignals();
