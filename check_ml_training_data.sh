#!/bin/bash

echo "🔍 VERIFICANDO DADOS DE TREINAMENTO ML"
echo "======================================"
echo ""

ssh root@212.85.10.239 << 'EOF'

echo "📊 1. ESTRUTURA DE TABELAS SUPABASE"
echo "-----------------------------------"
cd /root/tuturos-sinais/backend

# Verificar se há dados de treinamento
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function checkData() {
  console.log('📋 Verificando tabelas de ML...\n');
  
  // 1. Tabela de sinais (fonte de dados)
  const { data: signals, error: signalsError } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true });
  
  console.log('✓ signals:', signals?.length || 0, 'registros');
  
  // 2. Tabela de treinamento
  const { data: training, error: trainingError } = await supabase
    .from('ml_training_data')
    .select('*', { count: 'exact', head: true });
  
  console.log('✓ ml_training_data:', training?.length || 0, 'registros');
  
  // 3. Últimos sinais com resultado
  const { data: recentSignals } = await supabase
    .from('signals')
    .select('symbol, strategy, status, result, created_at')
    .in('status', ['win', 'loss'])
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('\n📈 Últimos 10 sinais finalizados:');
  recentSignals?.forEach(s => {
    console.log(\`  - \${s.symbol} [\${s.strategy}] \${s.status} (\${s.result}) - \${s.created_at}\`);
  });
  
  // 4. Últimos dados de treinamento
  const { data: recentTraining } = await supabase
    .from('ml_training_data')
    .select('symbol, strategy, result, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('\n🤖 Últimos 10 dados de treinamento:');
  recentTraining?.forEach(t => {
    console.log(\`  - \${t.symbol} [\${t.strategy}] \${t.result} - \${t.created_at}\`);
  });
  
  // 5. Estatísticas por estratégia
  const { data: stats } = await supabase
    .from('signals')
    .select('strategy, status')
    .in('status', ['win', 'loss']);
  
  console.log('\n📊 Estatísticas por estratégia:');
  const strategyStats = {};
  stats?.forEach(s => {
    if (!strategyStats[s.strategy]) {
      strategyStats[s.strategy] = { win: 0, loss: 0, total: 0 };
    }
    strategyStats[s.strategy][s.status]++;
    strategyStats[s.strategy].total++;
  });
  
  Object.entries(strategyStats).forEach(([strategy, data]) => {
    const winRate = ((data.win / data.total) * 100).toFixed(1);
    console.log(\`  - \${strategy}: \${data.total} sinais (Win: \${data.win}, Loss: \${data.loss}, Taxa: \${winRate}%)\`);
  });
}

checkData().catch(console.error);
" 2>&1

echo ""
echo "🔄 2. PROCESSOS PM2 ATIVOS"
echo "--------------------------"
pm2 list

echo ""
echo "📝 3. LOGS RECENTES DO SIGNAL-ENGINE"
echo "------------------------------------"
pm2 logs signal-engine --lines 30 --nostream | grep -i "training\|ml\|learn" || echo "Nenhum log de ML encontrado"

echo ""
echo "📂 4. ARQUIVOS DE TREINAMENTO"
echo "-----------------------------"
ls -lh /root/tuturos-sinais/backend/scripts/*train* 2>/dev/null || echo "Nenhum script de treinamento encontrado"
ls -lh /root/tuturos-sinais/backend/scripts/*ml* 2>/dev/null || echo "Nenhum script ML encontrado"

echo ""
echo "⚙️  5. VERIFICANDO CRON JOBS"
echo "---------------------------"
crontab -l | grep -i "train\|ml" || echo "Nenhum cron job de treinamento configurado"

EOF

echo ""
echo "✅ Verificação concluída!"
