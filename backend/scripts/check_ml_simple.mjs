import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ler o arquivo JSONL local
const dataPath = join(__dirname, '../../ml_engine/data/historical_ml_data.jsonl');

try {
    const content = readFileSync(dataPath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.trim());
    
    let wins = 0;
    let losses = 0;
    let total = 0;
    
    for (const line of lines) {
        try {
            const data = JSON.parse(line);
            if (data.outcome_label !== undefined) {
                total++;
                if (data.outcome_label === 1) wins++;
                else if (data.outcome_label === 0) losses++;
            }
        } catch (e) {
            // Ignora linhas inválidas
        }
    }
    
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
        console.log(`\nTotal de linhas no arquivo: ${lines.length} (mas sem outcome_label)`);
    }
    
} catch (error) {
    console.error('Erro ao ler arquivo:', error.message);
    process.exit(1);
}
