// ML Retrain Job — Automatiza o treinamento do modelo de IA

import cron from 'node-cron';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from '../lib/logger.js';
import { loadModel } from '../ml/mlPredictionService.js';
import { config } from '../lib/config.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startMLRetrainJob() {
    if (!config.ml.enabled) {
        logger.info('ML Retraining disabled (ML is disabled in config).');
        return;
    }

    // Roda todo Domingo as 03:00 da manhã
    cron.schedule('0 3 * * 0', async () => {
        logger.info('Iniciando o Job de Retreinamento de Machine Learning...');
        await executeRetrain();
    });

    logger.info('ML Retrain Job agendado (Domingos 03:00 AM).');
}

/**
 * Executa o script Python train_model.py.
 * Ao finalizar, recarrega o novo ONNX no servidor ativo (Zero Downtime reload).
 */
export function executeRetrain(): Promise<boolean> {
    return new Promise((resolve) => {
        // Encontrar o caminho do script ml_engine
        const rootDir = path.resolve(__dirname, '../../../../');
        const mlEngineDir = path.join(rootDir, 'ml_engine');
        const trainScriptPath = path.join(mlEngineDir, 'train_model.py');

        if (!fs.existsSync(trainScriptPath)) {
            logger.warn(`Script de treino não encontrado em ${trainScriptPath}`);
            return resolve(false);
        }

        // Tenta usar Python ou Python3 dependendo do OS
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

        logger.info(`Executando ${pythonCmd} ${trainScriptPath}...`);
        
        exec(`${pythonCmd} train_model.py`, { cwd: mlEngineDir }, async (error, stdout, stderr) => {
            if (error) {
                logger.error('Falha no retreinamento do modelo', { error: error.message, stderr });
                return resolve(false);
            }

            logger.info('Retreinamento concluído com sucesso.', { stdout });

            // Após o sucesso do Python, a nova current_model.onnx foi gerada na pasta ml_engine
            // Ou nós forçamos o PredictionService a tentar se recarregar com o path configurado.
            try {
                const reloadSuccess = await loadModel();
                if (reloadSuccess) {
                    logger.info('Modelo recarregado em memória (Online Learning Aplicado).');
                } else {
                    logger.warn('Retreinamento terminou, mas falhou ao recarregar o novo modelo ONNX.');
                }
            } catch (reloadErr) {
                logger.error('Erro forçando recarregamento do modelo ONNX.', { error: reloadErr });
            }

            resolve(true);
        });
    });
}
