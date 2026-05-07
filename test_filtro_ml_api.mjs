#!/usr/bin/env node

/**
 * Testa o filtro de robôs na API do ML Analytics
 */

const API_BASE = 'http://localhost:3001/api';

async function testarFiltro() {
    console.log('🔍 TESTE: Filtro de Robôs no ML Analytics\n');
    console.log('='.repeat(60));

    try {
        // 1. Testar SEM filtro
        console.log('\n📊 1. SEM FILTRO (todos os robôs):');
        const res1 = await fetch(`${API_BASE}/ml/stats`);
        const data1 = await res1.json();
        console.log(`   Total de sinais: ${data1.totalSignals}`);
        console.log(`   Wins: ${data1.wins} | Losses: ${data1.losses}`);
        console.log(`   Win Rate: ${data1.winRate.toFixed(1)}%`);

        // 2. Testar com filtro SWING
        console.log('\n\n🎯 2. FILTRO: robotType=swing');
        const res2 = await fetch(`${API_BASE}/ml/stats?robotType=swing`);
        const data2 = await res2.json();
        console.log(`   Total de sinais: ${data2.totalSignals}`);
        console.log(`   Wins: ${data2.wins} | Losses: ${data2.losses}`);
        console.log(`   Win Rate: ${data2.winRate.toFixed(1)}%`);

        // 3. Testar com filtro SCALPING
        console.log('\n\n⚡ 3. FILTRO: robotType=scalping');
        const res3 = await fetch(`${API_BASE}/ml/stats?robotType=scalping`);
        const data3 = await res3.json();
        console.log(`   Total de sinais: ${data3.totalSignals}`);
        console.log(`   Wins: ${data3.wins} | Losses: ${data3.losses}`);
        console.log(`   Win Rate: ${data3.winRate.toFixed(1)}%`);

        // 4. Testar learning-history SEM filtro
        console.log('\n\n📚 4. LEARNING HISTORY - SEM FILTRO:');
        const res4 = await fetch(`${API_BASE}/ml/learning-history?limit=5`);
        const data4 = await res4.json();
        console.log(`   Total de learnings: ${data4.learnings?.length || 0}`);
        data4.learnings?.forEach(l => {
            console.log(`   ${l.symbol} | ${l.trade_type || 'SEM_TIPO'} | ${l.result}`);
        });

        // 5. Testar learning-history com filtro SWING
        console.log('\n\n🎯 5. LEARNING HISTORY - FILTRO SWING:');
        const res5 = await fetch(`${API_BASE}/ml/learning-history?limit=5&robotType=swing`);
        const data5 = await res5.json();
        console.log(`   Total de learnings: ${data5.learnings?.length || 0}`);
        data5.learnings?.forEach(l => {
            console.log(`   ${l.symbol} | ${l.trade_type || 'SEM_TIPO'} | ${l.result}`);
        });

        // 6. Testar learning-history com filtro SCALPING
        console.log('\n\n⚡ 6. LEARNING HISTORY - FILTRO SCALPING:');
        const res6 = await fetch(`${API_BASE}/ml/learning-history?limit=5&robotType=scalping`);
        const data6 = await res6.json();
        console.log(`   Total de learnings: ${data6.learnings?.length || 0}`);
        data6.learnings?.forEach(l => {
            console.log(`   ${l.symbol} | ${l.trade_type || 'SEM_TIPO'} | ${l.result}`);
        });

        // RESUMO
        console.log('\n\n' + '='.repeat(60));
        console.log('📋 RESUMO:');
        console.log('='.repeat(60));

        const totalGeral = data1.totalSignals;
        const totalSwing = data2.totalSignals;
        const totalScalp = data3.totalSignals;

        console.log(`\n📊 Estatísticas:`);
        console.log(`   Total geral: ${totalGeral} sinais`);
        console.log(`   Swing: ${totalSwing} sinais`);
        console.log(`   Scalping: ${totalScalp} sinais`);
        console.log(`   Sem tipo: ${totalGeral - totalSwing - totalScalp} sinais`);

        if (totalSwing === 0 && totalScalp === 0) {
            console.log('\n❌ PROBLEMA CRÍTICO:');
            console.log('   Nenhum sinal tem trade_type definido!');
            console.log('   O filtro não funciona porque os dados não têm o campo.');
        } else if (totalSwing === totalGeral || totalScalp === totalGeral) {
            console.log('\n⚠️  PROBLEMA:');
            console.log('   O filtro não está funcionando - retorna os mesmos dados!');
        } else {
            console.log('\n✅ FILTRO FUNCIONANDO:');
            console.log('   Os dados mudam conforme o filtro aplicado.');
        }

        console.log('\n' + '='.repeat(60));

    } catch (error) {
        console.error('\n❌ Erro:', error.message);
        console.log('\n💡 Certifique-se de que o backend está rodando em http://localhost:3001');
        process.exit(1);
    }
}

testarFiltro();
