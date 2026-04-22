#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://owchjtzucnhsvlkwdapn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93Y2hqdHp1Y25oc3Zsa3dkYXBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODgyNzI0NCwiZXhwIjoyMDg0NDAzMjQ0fQ.rPk-VmP35j-7BiFQgkTkG99yVgVExWc3xF3G-yPUbVg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRobotsStatus() {
  console.log('🤖 VERIFICANDO STATUS DOS ROBÔS\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Verificar sinais recentes (últimas 2 horas)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    const { data: recentSignals, error: recentError } = await supabase
      .from('trade_signals')
      .select('*')
      .gte('created_at', twoHoursAgo)
      .order('created_at', { ascending: false });
    
    if (recentError) throw recentError;
    
    console.log(`\n📊 SINAIS NAS ÚLTIMAS 2 HORAS: ${recentSignals?.length || 0}`);
    
    if (recentSignals && recentSignals.length > 0) {
      console.log('\n✅ ROBÔS ATIVOS - Últimos sinais:');
      recentSignals.slice(0, 5).forEach(signal => {
        const time = new Date(signal.created_at).toLocaleTimeString('pt-BR');
        console.log(`   ${time} | ${signal.pair} | ${signal.type} | Score: ${signal.score} | Status: ${signal.status}`);
      });
    } else {
      console.log('\n⚠️  NENHUM SINAL NAS ÚLTIMAS 2 HORAS - ROBÔS PODEM ESTAR PARADOS!');
    }
    
    // 2. Verificar último sinal de cada tipo
    console.log('\n' + '='.repeat(60));
    console.log('\n🔍 ÚLTIMO SINAL DE CADA ROBÔ:\n');
    
    const types = ['SCALPING', 'SWING', 'ML_PREDICTION'];
    
    for (const type of types) {
      const { data: lastSignal } = await supabase
        .from('trade_signals')
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (lastSignal) {
        const timeDiff = Date.now() - new Date(lastSignal.created_at).getTime();
        const minutesAgo = Math.floor(timeDiff / 60000);
        const hoursAgo = Math.floor(minutesAgo / 60);
        
        let timeStr = minutesAgo < 60 
          ? `${minutesAgo} minutos atrás`
          : `${hoursAgo}h ${minutesAgo % 60}min atrás`;
        
        let status = minutesAgo < 30 ? '✅' : minutesAgo < 120 ? '⚠️' : '❌';
        
        console.log(`${status} ${type.padEnd(15)} | ${lastSignal.pair} | ${timeStr}`);
      } else {
        console.log(`❌ ${type.padEnd(15)} | Nenhum sinal encontrado`);
      }
    }
    
    // 3. Estatísticas gerais
    console.log('\n' + '='.repeat(60));
    console.log('\n📈 ESTATÍSTICAS GERAIS:\n');
    
    const { data: stats } = await supabase
      .from('trade_signals')
      .select('status, type');
    
    if (stats) {
      const active = stats.filter(s => s.status === 'ACTIVE').length;
      const wins = stats.filter(s => s.status === 'CLOSED_TP').length;
      const losses = stats.filter(s => s.status === 'CLOSED_SL').length;
      const total = stats.length;
      
      console.log(`   Total de sinais: ${total}`);
      console.log(`   Ativos: ${active}`);
      console.log(`   Wins: ${wins}`);
      console.log(`   Losses: ${losses}`);
      
      if (wins + losses > 0) {
        const winRate = ((wins / (wins + losses)) * 100).toFixed(1);
        console.log(`   Win Rate: ${winRate}%`);
      }
    }
    
    // 4. Verificar ML Training
    console.log('\n' + '='.repeat(60));
    console.log('\n🧠 STATUS DO ML TRAINING:\n');
    
    const { data: mlData } = await supabase
      .from('ml_training_data')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (mlData) {
      const timeDiff = Date.now() - new Date(mlData.created_at).getTime();
      const hoursAgo = Math.floor(timeDiff / 3600000);
      
      console.log(`   Último treino: ${hoursAgo}h atrás`);
      console.log(`   Status: ${hoursAgo < 24 ? '✅ Ativo' : '⚠️ Desatualizado'}`);
    } else {
      console.log('   ❌ Nenhum dado de treino encontrado');
    }
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    process.exit(1);
  }
}

checkRobotsStatus();
