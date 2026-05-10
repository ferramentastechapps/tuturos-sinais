// ML Retrain Job — Automatiza o treinamento do modelo de IA

import cron from 'node-cron';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from '../lib/logger.js';
import { loadModel, clearSymbolCache } from '../ml/mlPredictionService.js';
import { config } from '../lib/config.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startMLRetrainJob() {
    if (!config.ml.enabled) {
        logger.info('ML Retraining disabled (ML is disabled in config).');
        return;
    }

    // Roda todo dia às 23:55 (final do dia)
    cron.schedule('55 23 * * *', async () => {
        logger.info('🎓 Iniciando o Job de Retreinamento Diário de Machine Learning...');
        await executeRetrain();
    }, {
        timezone: 'UTC'
    });

    logger.info('ML Retrain Job agendado (Diariamente às 23:55 UTC).');
}

/**
 * Executa o script Python train_model.py.
 * Ao finalizar, recarrega o novo ONNX no servidor ativo (Zero Downtime reload).
 */
export function executeRetrain(): Promise<boolean> {
    return new Promise((resolve) => {
        const backendDir = path.resolve(__dirname, '../../../');
        const scriptsDir = path.join(backendDir, 'scripts');
        
        // PASSO 1 — Backup do modelo atual
        const modelsDir = path.join(backendDir, 'ml_models_backup');
        if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });
        const currentModelPath = path.join(backendDir, 'current_model.onnx');
        if (fs.existsSync(currentModelPath)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(modelsDir, `model_backup_${timestamp}.onnx`);
            fs.copyFileSync(currentModelPath, backupPath);
            logger.info(`[MLRetrain] ✅ Backup criado: ${backupPath}`);
        }

        // Preferir retrain_from_sqlite.py (lê do SQLite local, sem depender do Supabase)
        // Fallback para retrain_model.py (lê do Supabase)
        const sqliteScript = path.join(scriptsDir, 'retrain_from_sqlite.py');
        const supabaseScript = path.join(scriptsDir, 'retrain_model.py');
        const trainScript = fs.existsSync(sqliteScript) ? sqliteScript : supabaseScript;

        if (!fs.existsSync(trainScript)) {
            logger.warn(`Script de treino não encontrado. Procurado em: ${sqliteScript}`);
            return resolve(false);
        }

        // Usar venv Python se disponível (tem todas as dependências instaladas)
        const venvPython = path.join(backendDir, '.venv_ml', 'bin', 'python3');
        const pythonCmd = fs.existsSync(venvPython) ? venvPython
            : process.platform === 'win32' ? 'python' : 'python3';

        // PASSO 2 — Mudar output para arquivo temporário
        const outputPath = path.join(backendDir, 'temp_model.onnx');
        const cmd = `"${pythonCmd}" "${trainScript}" --min-samples 30 --output "${outputPath}"`;

        logger.info(`[MLRetrain] Executando: ${cmd}`);

        exec(cmd, { cwd: backendDir }, async (error, stdout, stderr) => {
            if (stdout) logger.info('[MLRetrain] stdout:\n' + stdout);
            if (stderr) logger.warn('[MLRetrain] stderr:\n' + stderr);

            if (error) {
                logger.error('[MLRetrain] Falha no retreinamento', { code: error.code, message: error.message });
                return resolve(false);
            }

            // PASSO 3 — Validar métricas do modelo
            const metricsPath = path.join(backendDir, 'model_metrics.json');
            if (!fs.existsSync(metricsPath)) {
                logger.error('[MLRetrain] ❌ model_metrics.json não encontrado — abortando');
                return resolve(false);
            }
            const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
            if (metrics.accuracy < 0.55 || metrics.sampleSize < 50) {
                logger.warn(`[MLRetrain] ⚠️ Modelo rejeitado: accuracy=${metrics.accuracy.toFixed(3)}, samples=${metrics.sampleSize}`);
                fs.unlinkSync(outputPath); // apagar temp ruim
                return resolve(false);
            }

            // PASSO 4 — Substituir modelo apenas se passou na validação
            fs.renameSync(outputPath, currentModelPath);
            logger.info(`[MLRetrain] ✅ Novo modelo ativado: accuracy=${metrics.accuracy.toFixed(3)}`);

            // PASSO 5 — Limpar backups antigos, manter só os 10 mais recentes
            const backups = fs.readdirSync(modelsDir)
                .filter(f => f.startsWith('model_backup_') && f.endsWith('.onnx'))
                .map(f => ({ name: f, mtime: fs.statSync(path.join(modelsDir, f)).mtimeMs }))
                .sort((a, b) => b.mtime - a.mtime);
            backups.slice(10).forEach(f => fs.unlinkSync(path.join(modelsDir, f.name)));

            logger.info('[MLRetrain] Retreinamento concluído. Recarregando modelo...');

            try {
                clearSymbolCache(); // Limpar cache de modelos por símbolo
                const reloadSuccess = await loadModel();
                if (reloadSuccess) {
                    logger.info('[MLRetrain] ✅ Novo modelo carregado em memória.');
                } else {
                    logger.warn('[MLRetrain] ⚠️  Retreinamento OK mas falhou ao recarregar ONNX.');
                }
            } catch (reloadErr) {
                logger.error('[MLRetrain] Erro ao recarregar modelo', { error: reloadErr });
            }

            resolve(true);
        });
    });
}
