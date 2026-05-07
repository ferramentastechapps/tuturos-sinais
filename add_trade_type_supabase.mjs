#!/usr/bin/env node

/**
 * Adiciona coluna trade_type na tabela ml_training_data do Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Ler .env
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

console.log('🚀 Adicionando coluna trade_type no Supabase da VPS\n');
console.log('='.repeat(60));

async function addTradeTypeColumn() {
    try {
        // 1. Verificar quantos registros existem
        console.log('\n📊 1. Verificando dados existentes...');
        const { count: totalCount, error: countError } = await supabase
            .from('ml_training_data')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        console.log(`   Total de registros: ${totalCount}`);

        // 2. Verificar se a coluna já existe
        console.log('\n🔍 2. Verificando se coluna trade_type já existe...');
        const { data: sample, error: sampleError } = await supabase
            .from('ml_training_data')
            .select('*')
            .limit(1);

        if (sampleError) throw sampleError;

        const hasTradeType = sample && sample.length > 0 && 'trade_type' in sample[0];

        if (hasTradeType) {
            console.log('   ✅ Coluna trade_type já existe!');
            
            // Verificar quantos têm NULL
            const { count: nullCount } = await supabase
                .from('ml_training_data')
                .select('*', { count: 'exact', head: true })
                .is('trade_type', null);

            console.log(`   Registros com trade_type NULL: ${nullCount}`);

            if (nullCount > 0) {
                console.log('\n📝 3. Atualizando registros NULL...');
                const { error: updateError } = await supabase
                    .from('ml_training_data')
                    .update({ trade_type: 'swing' })
                    .is('trade_type', null);

                if (updateError) throw updateError;
                console.log(`   ✅ ${nullCount} registros atualizados para 'swing'`);
            }
        } else {
            console.log('   ⚠️  Coluna trade_type NÃO existe!');
            console.log('\n❌ ERRO: Não é possível adicionar coluna via API do Supabase.');
            console.log('\n💡 SOLUÇÃO: Execute este SQL no Supabase Dashboard:');
            console.log('   https://supabase.com/dashboard\n');
            console.log('   ALTER TABLE ml_training_data ADD COLUMN trade_type TEXT;');
            console.log('   UPDATE ml_training_data SET trade_type = \'swing\' WHERE trade_type IS NULL;\n');
            process.exit(1);
        }

        // 4. Verificar distribuição
        console.log('\n📈 4. Distribuição por trade_type:');
        const { data: distribution, error: distError } = await supabase
            .from('ml_training_data')
            .select('trade_type, outcome_label');

        if (distError) throw distError;

        const stats = {};
        distribution.forEach(row => {
            const type = row.trade_type || 'NULL';
            if (!stats[type]) {
                stats[type] = { total: 0, wins: 0, losses: 0 };
            }
            stats[type].total++;
            if (row.outcome_label === 1) stats[type].wins++;
            if (row.outcome_label === 0) stats[type].losses++;
        });

        Object.entries(stats).forEach(([type, data]) => {
            const winRate = data.total > 0 ? ((data.wins / data.total) * 100).toFixed(1) : 0;
            console.log(`   ${type}: ${data.total} registros (${data.wins}W/${data.losses}L - ${winRate}%)`);
        });

        console.log('\n' + '='.repeat(60));
        console.log('✅ SUCESSO! Coluna trade_type configurada corretamente!');
        console.log('='.repeat(60));
        console.log('\n🚀 Próximo passo: Fazer rebuild do backend na VPS');
        console.log('   ssh vps');
        console.log('   cd ~/tuturos-sinais/backend');
        console.log('   npx prisma db pull');
        console.log('   npx prisma generate');
        console.log('   npm run build');
        console.log('   pm2 restart backend\n');

    } catch (error) {
        console.error('\n❌ Erro:', error.message);
        process.exit(1);
    }
}

addTradeTypeColumn();
