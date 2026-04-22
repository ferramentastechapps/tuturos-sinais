import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Credenciais do Supabase não encontradas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n🔍 VERIFICANDO DADOS DE TREINAMENTO NO SUPABASE');
console.log('================================================\n');

async function checkData() {
  try {
    // 1. Verificar tabela ml_training_data
    console.log('📊 1. Tabela ml_training_data:');
    const { data: trainingData, error: trainingError, count: trainingCount } = await supabase
      .from('ml_training_data')
      .select('*', { count: 'exact', head: false })
      .order('created_at', { ascending: false })
      .limit(10);

    if (trainingError) {
      console.log('   ⚠️  Erro:', trainingError.message);
    } else {
      console.log(`   ✅ Total de registros: ${trainingCount || 0}`);
      
      if (trainingData && trainingData.length > 0) {
        console.log('\n   📋 Últimos 10 registros:');
        trainingData.forEach((row, i) => {
          const outcome = row.outcome_label === 1 ? 'WIN' : 'LOSS';
          const pnl = row.outcome_pnl ? `${row.outcome_pnl.toFixed(2)}%` : 'N/A';
          console.log(`   ${i+1}. ${row.symbol} [${row.strategy || 'N/A'}] ${outcome} (${pnl}) - ${row.created_at}`);
        });
        
        // Estatísticas
        const { data: stats } = await supabase
          .from('ml_training_data')
          .select('outcome_label, strategy');
        
        if (stats) {
          const wins = stats.filter(s => s.outcome_label === 1).length;
          const losses = stats.filter(s => s.outcome_label === 0).length;
          const total = stats.length;
          const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : 0;
          
          console.log('\n   📈 Estatísticas:');
          console.log(`   - Wins: ${wins}`);
          console.log(`   - Losses: ${losses}`);
          console.log(`   - Win Rate: ${winRate}%`);
          
          // Por estratégia
          const byStrategy = {};
          stats.forEach(s => {
            const strat = s.strategy || 'unknown';
            if (!byStrategy[strat]) byStrategy[strat] = { wins: 0, losses: 0 };
            if (s.outcome_label === 1) byStrategy[strat].wins++;
            else byStrategy[strat].losses++;
          });
          
          console.log('\n   📊 Por estratégia:');
          Object.entries(byStrategy).forEach(([strat, data]) => {
            const total = data.wins + data.losses;
            const wr = ((data.wins / total) * 100).toFixed(1);
            console.log(`   - ${strat}: ${total} sinais (${data.wins}W/${data.losses}L) - ${wr}%`);
          });
        }
      } else {
        console.log('   ⚠️  Nenhum registro encontrado');
      }
    }

    // 2. Verificar tabela signals (fonte de dados)
    console.log('\n📊 2. Tabela signals (sinais finalizados):');
    const { data: signals, error: signalsError, count: signalsCount } = await supabase
      .from('signals')
      .select('*', { count: 'exact', head: false })
      .in('status', ['win', 'loss', 'CLOSED_TP', 'CLOSED_SL'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (signalsError) {
      console.log('   ⚠️  Erro:', signalsError.message);
    } else {
      console.log(`   ✅ Total de sinais finalizados: ${signalsCount || 0}`);
      
      if (signals && signals.length > 0) {
        console.log('\n   📋 Últimos 10 sinais finalizados:');
        signals.forEach((s, i) => {
          const status = s.status || s.result || 'N/A';
          console.log(`   ${i+1}. ${s.symbol} [${s.strategy}] ${status} - ${s.created_at}`);
        });
      }
    }

    // 3. Verificar sinais ativos
    console.log('\n📊 3. Sinais ativos:');
    const { count: activeCount } = await supabase
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    console.log(`   ✅ Total de sinais ativos: ${activeCount || 0}`);

    // 4. Verificar dados de hoje
    const today = new Date().toISOString().split('T')[0];
    const { count: todayCount } = await supabase
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00`);

    console.log(`   ✅ Sinais criados hoje: ${todayCount || 0}`);

    // 5. Resumo final
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO:');
    console.log('='.repeat(50));
    console.log(`✅ Dados de treinamento: ${trainingCount || 0} registros`);
    console.log(`✅ Sinais finalizados: ${signalsCount || 0} registros`);
    console.log(`✅ Sinais ativos: ${activeCount || 0} registros`);
    console.log(`✅ Sinais hoje: ${todayCount || 0} registros`);
    
    if ((trainingCount || 0) >= 50) {
      console.log('\n✅ DADOS SUFICIENTES PARA TREINAR O MODELO!');
    } else {
      const needed = 50 - (trainingCount || 0);
      console.log(`\n⚠️  Precisa de mais ${needed} sinais finalizados para treinar (mínimo: 50)`);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

checkData();
