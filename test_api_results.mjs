// Testar endpoints de resultados
const API_URL = 'https://sinaiscripto.ftech-apps.com.br/api';

async function testEndpoints() {
  console.log('🧪 Testando endpoints de resultados...\n');

  const tests = [
    { name: 'Sinais ATIVOS', url: `${API_URL}/signals/history?status=ACTIVE&page=1&limit=10` },
    { name: 'Sinais WIN (CLOSED_TP)', url: `${API_URL}/signals/history?status=CLOSED_TP&page=1&limit=10` },
    { name: 'Sinais STOP (CLOSED_SL)', url: `${API_URL}/signals/history?status=CLOSED_SL&page=1&limit=10` },
    { name: 'Todos os sinais', url: `${API_URL}/signals/history?page=1&limit=10` },
  ];

  for (const test of tests) {
    console.log(`\n📡 ${test.name}:`);
    console.log(`   URL: ${test.url}`);
    
    try {
      const res = await fetch(test.url);
      
      if (!res.ok) {
        console.log(`   ❌ Status: ${res.status} ${res.statusText}`);
        continue;
      }

      const json = await res.json();
      console.log(`   ✅ Status: ${res.status}`);
      console.log(`   📊 Total: ${json.pagination?.total || 0}`);
      console.log(`   📄 Sinais retornados: ${json.data?.length || 0}`);
      
      if (json.data?.length > 0) {
        console.log(`   📋 Primeiros sinais:`);
        json.data.slice(0, 3).forEach(s => {
          console.log(`      ${s.id?.substring(0,8)}... | ${s.pair} | ${s.type} | ${s.status}`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }
}

testEndpoints();
