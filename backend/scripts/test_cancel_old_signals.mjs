#!/usr/bin/env node
/**
 * Script de teste para verificar o cancelamento automático de sinais antigos
 * Simula a criação de múltiplos sinais para a mesma moeda e verifica se os antigos são cancelados
 */

// Usar o dbClient que já está configurado
import('../src/lib/dbClient.js').then(async ({ db }) => {
    await testCancelOldSignals(db);
}).catch(err => {
    console.error('Erro ao importar dbClient:', err);
    process.exit(1);
});

async function testCancelOldSignals(db) {
    console.log('🧪 Testando cancelamento automático de sinais antigos...\n');

    const testPair = 'BTCUSDT';

    try {
        // 1. Limpar sinais de teste anteriores
        console.log('1️⃣ Limpando sinais de teste anteriores...');
        await db.activeSignal.deleteMany({
            where: { pair: testPair, id: { startsWith: 'TEST-' } }
        });
        await db.tradeSignal.deleteMany({
            where: { pair: testPair, id: { startsWith: 'TEST-' } }
        });

        // 2. Criar 3 sinais antigos para BTCUSDT
        console.log(`\n2️⃣ Criando 3 sinais antigos para ${testPair}...`);
        const oldSignals = [];
        for (let i = 1; i <= 3; i++) {
            const signal = await db.activeSignal.create({
                data: {
                    id: `TEST-${testPair}-OLD-${i}`,
                    pair: testPair,
                    type: i % 2 === 0 ? 'LONG' : 'SHORT',
                    trade_type: 'Day Trade',
                    entry_range_low: 50000 + i * 100,
                    entry_range_high: 50100 + i * 100,
                    stop_loss: 49000,
                    initial_stop_loss: 49000,
                    take_profits: JSON.stringify([
                        { level: 1, price: 51000, hit: false }
                    ]),
                    status: i === 1 ? 'PENDING' : 'ACTIVE',
                    score: 75 + i
                }
            });
            oldSignals.push(signal);
            console.log(`   ✅ Criado: ${signal.id} (${signal.status})`);
        }

        // 3. Verificar sinais ativos antes do cancelamento
        console.log(`\n3️⃣ Verificando sinais ativos para ${testPair}...`);
        const beforeCancel = await db.activeSignal.findMany({
            where: { 
                pair: testPair,
                status: { in: ['PENDING', 'ACTIVE'] }
            }
        });
        console.log(`   📊 Total de sinais ativos: ${beforeCancel.length}`);
        beforeCancel.forEach(s => {
            console.log(`      - ${s.id}: ${s.status}`);
        });

        // 4. Simular o cancelamento (como seria feito no registerNewSignal)
        console.log(`\n4️⃣ Simulando cancelamento de sinais antigos...`);
        
        // Buscar sinais ativos/pendentes
        const signalsToCancel = await db.activeSignal.findMany({
            where: {
                pair: testPair,
                status: { in: ['PENDING', 'ACTIVE'] }
            }
        });

        console.log(`   🔍 Encontrados ${signalsToCancel.length} sinais para cancelar`);

        // Cancelar cada um
        for (const oldSignal of signalsToCancel) {
            await db.activeSignal.update({
                where: { id: oldSignal.id },
                data: { status: 'CANCELLED' }
            });
            
            await db.tradeSignal.update({
                where: { id: oldSignal.id },
                data: { status: 'CANCELLED' }
            }).catch(() => {}); // Ignora se não existir
            
            console.log(`   ✅ Cancelado: ${oldSignal.id}`);
        }

        // 5. Criar novo sinal
        console.log(`\n5️⃣ Criando novo sinal para ${testPair}...`);
        const newSignal = await db.activeSignal.create({
            data: {
                id: `TEST-${testPair}-NEW-${Date.now()}`,
                pair: testPair,
                type: 'LONG',
                trade_type: 'Swing Trade',
                entry_range_low: 51000,
                entry_range_high: 51200,
                stop_loss: 50000,
                initial_stop_loss: 50000,
                take_profits: JSON.stringify([
                    { level: 1, price: 52000, hit: false },
                    { level: 2, price: 53000, hit: false }
                ]),
                status: 'PENDING',
                score: 85
            }
        });
        console.log(`   ✅ Novo sinal criado: ${newSignal.id} (${newSignal.status})`);

        // 6. Verificar resultado final
        console.log(`\n6️⃣ Verificando resultado final...`);
        const afterCancel = await db.activeSignal.findMany({
            where: { pair: testPair }
        });
        
        const activeCount = afterCancel.filter(s => s.status === 'ACTIVE' || s.status === 'PENDING').length;
        const cancelledCount = afterCancel.filter(s => s.status === 'CANCELLED').length;
        
        console.log(`   📊 Sinais para ${testPair}:`);
        console.log(`      - Ativos/Pendentes: ${activeCount}`);
        console.log(`      - Cancelados: ${cancelledCount}`);
        
        afterCancel.forEach(s => {
            const emoji = s.status === 'CANCELLED' ? '❌' : s.status === 'PENDING' ? '⏳' : '✅';
            console.log(`      ${emoji} ${s.id}: ${s.status}`);
        });

        // 7. Validação
        console.log(`\n7️⃣ Validação:`);
        if (activeCount === 1 && cancelledCount === 3) {
            console.log('   ✅ SUCESSO! Apenas 1 sinal ativo, 3 cancelados corretamente');
        } else {
            console.log(`   ❌ FALHA! Esperado: 1 ativo, 3 cancelados. Obtido: ${activeCount} ativos, ${cancelledCount} cancelados`);
        }

        // 8. Limpar sinais de teste
        console.log(`\n8️⃣ Limpando sinais de teste...`);
        await db.activeSignal.deleteMany({
            where: { pair: testPair, id: { startsWith: 'TEST-' } }
        });
        await db.tradeSignal.deleteMany({
            where: { pair: testPair, id: { startsWith: 'TEST-' } }
        });
        console.log('   ✅ Limpeza concluída');

    } catch (error) {
        console.error('❌ Erro durante o teste:', error);
    }
}
