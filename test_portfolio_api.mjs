// Testar API de portfolio
const API_URL = 'https://sinaiscripto.ftech-apps.com.br/api';

async function testPortfolio() {
  console.log('🧪 Testando API de Portfolio...\n');

  try {
    // 1. Portfolio
    console.log('📊 Portfolio:');
    const portfolioRes = await fetch(`${API_URL}/portfolio`);
    const portfolio = await portfolioRes.json();
    console.log(JSON.stringify(portfolio, null, 2));
    console.log('');

    // 2. Positions
    console.log('📈 Positions:');
    const positionsRes = await fetch(`${API_URL}/positions`);
    const positions = await positionsRes.json();
    console.log(JSON.stringify(positions, null, 2));
    console.log('');

    // 3. Closed Orders
    console.log('📋 Closed Orders:');
    const ordersRes = await fetch(`${API_URL}/paper-trading/closed-orders`);
    if (ordersRes.ok) {
      const orders = await ordersRes.json();
      console.log(JSON.stringify(orders, null, 2));
    } else {
      console.log('Endpoint não encontrado');
    }
    console.log('');

    // 4. Metrics
    console.log('📊 Metrics:');
    const metricsRes = await fetch(`${API_URL}/paper-trading/metrics`);
    if (metricsRes.ok) {
      const metrics = await metricsRes.json();
      console.log(JSON.stringify(metrics, null, 2));
    } else {
      console.log('Endpoint não encontrado');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testPortfolio();
