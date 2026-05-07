#!/usr/bin/env node

/**
 * Diagnóstico do Filtro de Robôs no ML Analytics
 * Verifica se os sinais têm trade_type correto e se o filtro funciona
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Ler .env manualmente
const envContent = readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
});

const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_KEY
);

console.log('🔍 DIAGNÓSTICO: Filtro de Robôs no ML Analytics\n');
console.log('=' .repeat(60));

async function diagnosticar() {
    try {
        // 1. Verificar TODOS os sinais fechados
        console.log('\n📊 1. TODOS OS SINAIS FECHADOS:');
        const { data: allSignals, error: allError } = await supabase
            .from('trade_signals')
            .select('id, pair, trade_type, status, created_at')
            .in('status', ['CLOSED_TP', 'CLOSED_SL'])
            .order('created_at', { ascending: false })
            .limit(20);

        if (allError) throw allError;

        console.log(`\nTotal de sinais fechados (últimos 20): ${allSignals?.length || 0}`);
        
        const tradeTypes = {};
        allSignals?.forEach(s => {
            const type = s.trade_type || 'SEM_TIPO';
            tradeTypes[type] = (tradeTypes[type] || 0) + 1;
        });

        console.log('\n📈 Distribuição por trade_type:');
        Object.entries(tradeTypes).forEach(([type, count]) => {
            console.log(`  ${type}: ${count} sinais`);
        });

        console.log('\n📋 Exemplos de sinais:');
        allSignals?.slice(0, 5).forEach(s => {
            console.log(`  ${s.pair} | ${s.trade_type || 'SEM_TIPO'} | ${s.status} | ${new Date(s.created_at).toLocaleString('pt-BR')}`);
        });

        // 2. Filtrar apenas SWING
        console.log('\n\n🎯 2. FILTRO: APENAS SWING TRADING:');
        const { data: swingSignals, error: swingError } = await supabase
            .from('trade_signals')
            .select('id, pair, trade_type, status')
            .in('status', ['CLOSED_TP', 'CLOSED_SL'])
            .ilike('trade_type', '%swing%')
            .limit(10);

        if (swingError) throw swingError;

        console.log(`Total de sinais SWING: ${swingSignals?.length || 0}`);
        swingSignals?.forEach(s => {
            console.log(`  ${s.pair} | ${s.trade_type} | ${s.status}`);
        });

        // 3. Filtrar apenas SCALPING
        console.log('\n\n⚡ 3. FILTRO: APENAS SCALPING:');
        const { data: scalpSignals, error: scalpError } = await supabase
            .from('trade_signals')
            .select('id, pair, trade_type, status')
            .in('status', ['CLOSED_TP', 'CLOSED_SL'])
            .ilike('trade_type', '%scalp%')
            .limit(10);

        if (scalpError) throw scalpError;

        console.log(`Total de sinais SCALPING: ${scalpSignals?.length || 0}`);
        scalpSignals?.forEach(s => {
            console.log(`  ${s.pair} | ${s.trade_type} | ${s.status}`);
        });

        // 4. Verificar sinais SEM trade_type
        console.log('\n\n⚠️  4. SINAIS SEM trade_type:');
        const { data: noTypeSignals, error: noTypeError } = await supabase
            .from('trade_signals')
            .select('id, pair, trade_type, status, created_at')
            .in('status', ['CLOSED_TP', 'CLOSED_SL'])
            .is('trade_type', null)
            .limit(10);

        if (noTypeError) throw noTypeError;

        console.log(`Total de sinais SEM trade_type: ${noTypeSignals?.length || 0}`);
        noTypeSignals?.forEach(s => {
            console.log(`  ${s.pair} | NULL | ${s.status} | ${new Date(s.created_at).toLocaleString('pt-BR')}`);
        });

        // 5. Verificar ML Training Data
        console.log('\n\n🧠 5. ML TRAINING DATA:');
        const { data: mlData, error: mlError } = await supabase
            .from('ml_training_data')
            .select('id, symbol, trade_type, outcome')
            .limit(10);

        if (mlError) throw mlError;

        console.log(`Total de amostras ML (primeiras 10): ${mlData?.length || 0}`);
        
        const mlTypes = {};
        mlData?.forEach(m => {
            const type = m.trade_type || 'SEM_TIPO';
            mlTypes[type] = (mlTypes[type] || 0) + 1;
        });

        console.log('\n📈 Distribuição ML por trade_type:');
        Object.entries(mlTypes).forEach(([type, count]) => {
            console.log(`  ${type}: ${count} amostras`);
        });

        // 6. RESUMO E DIAGNÓSTICO
        console.log('\n\n' + '='.repeat(60));
        console.log('📋 RESUMO DO DIAGNÓSTICO:');
        console.log('='.repeat(60));

        const totalSwing = swingSignals?.length || 0;
        const totalScalp = scalpSignals?.length || 0;
        const totalNoType = noTypeSignals?.length || 0;

        if (totalSwing === 0 && totalScalp === 0) {
            console.log('\n❌ PROBLEMA CRÍTICO:');
            console.log('   Nenhum sinal tem trade_type definido corretamente!');
            console.log('   O filtro não funciona porque os dados não têm o campo preenchido.');
            console.log('\n💡 SOLUÇÃO:');
            console.log('   1. Verificar se os robôs estão salvando o trade_type ao criar sinais');
            console.log('   2. Atualizar sinais existentes com o trade_type correto');
            console.log('   3. Verificar signalEngine.ts e scalpingEngine.ts');
        } else if (totalNoType > 0) {
            console.log('\n⚠️  PROBLEMA PARCIAL:');
            console.log(`   ${totalNoType} sinais não têm trade_type definido`);
            console.log(`   ${totalSwing} sinais são SWING`);
            console.log(`   ${totalScalp} sinais são SCALPING`);
            console.log('\n💡 SOLUÇÃO:');
            console.log('   Atualizar sinais antigos sem trade_type');
        } else {
            console.log('\n✅ DADOS OK:');
            console.log(`   ${totalSwing} sinais SWING encontrados`);
            console.log(`   ${totalScalp} sinais SCALPING encontrados`);
            console.log('\n🔍 Se o filtro não funciona no frontend:');
            console.log('   1. Verificar se o parâmetro está sendo enviado corretamente');
            console.log('   2. Verificar console do navegador para erros');
            console.log('   3. Verificar logs do backend');
        }

        console.log('\n' + '='.repeat(60));

    } catch (error) {
        console.error('\n❌ Erro no diagnóstico:', error.message);
        process.exit(1);
    }
}

diagnosticar();
