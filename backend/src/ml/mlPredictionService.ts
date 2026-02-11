// ML Prediction Service — Server-side ONNX Runtime (Node.js native)

import * as ort from 'onnxruntime-node';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import type { MLFeatureVector, MLPrediction } from '../types/mlTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let inferenceSession: ort.InferenceSession | null = null;
let modelLoaded = false;

const FEATURE_COLUMNS = [
    'rsi', 'adx', 'atr_rel', 'dist_ema20', 'dist_ema50', 'dist_ema200', 'dist_vwap',
    'volatility_24h', 'volume_rel', 'funding_rate', 'open_interest_var', 'long_short_ratio',
    'is_long', 'confidence', 'quality_score', 'confluence_count', 'stop_loss_pct',
    'take_profit_pct', 'risk_reward', 'hour_of_day', 'day_of_week',
    'btc_trend', 'dominance_btc', 'fear_greed'
];

export async function loadModel(): Promise<boolean> {
    if (!config.ml.enabled) {
        logger.info('ML model disabled by config');
        return false;
    }

    try {
        // Look for model file in multiple locations
        const searchPaths = [
            config.ml.modelPath,
            path.resolve(__dirname, '../../current_model.onnx'),
            path.resolve(__dirname, '../../../current_model.onnx'),
        ];

        let modelPath: string | null = null;
        for (const p of searchPaths) {
            if (fs.existsSync(p)) {
                modelPath = p;
                break;
            }
        }

        if (!modelPath) {
            logger.warn('No ONNX model file found. ML predictions unavailable.', { searchPaths });
            return false;
        }

        logger.info(`Loading ML model from ${modelPath}...`);
        inferenceSession = await ort.InferenceSession.create(modelPath);
        modelLoaded = true;
        logger.info('ML model loaded successfully', {
            inputNames: inferenceSession.inputNames,
            outputNames: inferenceSession.outputNames,
        });
        return true;
    } catch (error) {
        logger.error('Failed to load ML model', { error });
        return false;
    }
}

export async function predictSignal(features: MLFeatureVector): Promise<MLPrediction | null> {
    if (!inferenceSession) {
        if (!modelLoaded) {
            const success = await loadModel();
            if (!success) return null;
        } else {
            return null;
        }
    }

    try {
        const inputData = new Float32Array(FEATURE_COLUMNS.length);
        FEATURE_COLUMNS.forEach((col, idx) => {
            inputData[idx] = features[col] || 0;
        });

        const tensor = new ort.Tensor('float32', inputData, [1, FEATURE_COLUMNS.length]);
        const feeds: Record<string, ort.Tensor> = {};
        const inputName = inferenceSession!.inputNames[0];
        feeds[inputName] = tensor;

        const results = await inferenceSession!.run(feeds);

        const labelTensor = results[inferenceSession!.outputNames[0]];
        const probTensor = results[inferenceSession!.outputNames[1]];

        const predictedClass = Number(labelTensor.data[0]);

        let probability = 0;
        if (probTensor && probTensor.data.length >= 2) {
            probability = Number(probTensor.data[1]);
        }

        return {
            predictedClass: predictedClass as 0 | 1,
            probability,
            confidence: probability > 0.5 ? probability : 1 - probability,
        };
    } catch (error) {
        logger.error('ML inference failed', { error });
        return null;
    }
}

export function isModelLoaded(): boolean {
    return modelLoaded && inferenceSession !== null;
}
