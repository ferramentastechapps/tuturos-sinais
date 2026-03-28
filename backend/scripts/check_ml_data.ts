import { db } from '../src/lib/dbClient.js';

async function checkMLData() {
    try {
        const total = await db.mLTrainingData.count();
        const wins = await db.mLTrainingData.count({ where: { outcome_label: 1 } });
        const losses = await db.mLTrainingData.count({ where: { outcome_label: 0 } });
        
        console.log('\n📊 Estatísticas de Dados de Treinamento ML\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Total de sinais fechados: ${total}`);
        console.log(`Wins (TP): ${wins}`);
        console.log(`Losses (SL): ${losses}`);
        
        if (total > 0) {
            const winRate = (wins / total) * 100;
            console.log(`Win Rate: ${winRate.toFixed(2)}%`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            if (total >= 50) {
                console.log('\n✅ Dados suficientes para treinar o modelo!');
            } else {
                console.log(`\n⚠️  Precisa de ${50 - total} sinais a mais para treinar (mínimo: 50)`);
            }
        } else {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('\n⚠️  Nenhum dado de treinamento encontrado.');
            console.log('Os dados são coletados automaticamente quando trades fecham (TP ou SL).');
        }
        
        await db.$disconnect();
    } catch (error) {
        console.error('Erro ao consultar dados:', error);
        process.exit(1);
    }
}

checkMLData();
