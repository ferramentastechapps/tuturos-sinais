// Testar todos os endpoints usados pela dashboard
const API_URL = 'https://sinaiscripto.ftech-apps.com.br/api';

async function testDashboardAPIs() {
  console.log('🧪 Testando endpoints da Dashboard...\n');

  const tests = [
    { name: 'Portfolio', url: `${API_URL}/portfolio` },
    { name: 'Positions', url: `${API_URL}/positions` },
    { name: 'Signals History', url: `${API_URL}/signals/history?page=1&limit=5` },
    { name: 'ML Stats', url: `${API_URL}/ml/stats` },
    { name: 'Fear & Greed', url: 'https://api.alternative.me/fng/' },
  ];

  for (const test of tests) {
    console.log(`\n📡 ${test.name}:`);
    console.log(`   URL: ${test.url}`);
    
    try {
      const res = await fetch(test.url);
      
      if (!res.ok) {
        console.log(`   ❌ Status: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log(`   Resposta: ${text.substring(0, 200)}`);
        continue;
      }

      const json = await res.json();
      console.log(`   ✅ Status: ${res.status}`);
      console.log(`   📊 Dados:`, JSON.stringify(json, null, 2).substring(0, 300));
      
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }
}

testDashboardAPIs();
