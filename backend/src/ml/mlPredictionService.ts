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

// Cache de modelos específicos por símbolo
const symbolSessions = new Map<string, { session: ort.InferenceSession; loadedAt: number }>();
const SYMBOL_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 horas

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

async function loadSymbolModel(symbol: string): Promise<ort.InferenceSession | null> {
    try {
        const backendDir = path.resolve(__dirname, '../../');
        const symbolModelPath = path.join(backendDir, 'ml_models', symbol, 'model.onnx');
        
        if (!fs.existsSync(symbolModelPath)) {
            return null; // Modelo específico não existe
        }
        
        // Verificar cache
        const cached = symbolSessions.get(symbol);
        if (cached && (Date.now() - cached.loadedAt) < SYMBOL_CACHE_TTL) {
            return cached.session;
        }
        
        // Carregar novo modelo
        const session = await ort.InferenceSession.create(symbolModelPath);
        symbolSessions.set(symbol, { session, loadedAt: Date.now() });
        logger.info(`Loaded symbol-specific model for ${symbol}`);
        return session;
    } catch (error) {
        logger.warn(`Failed to load symbol model for ${symbol}`, { error });
        return null;
    }
}

export function clearSymbolCache(): void {
    symbolSessions.clear();
    logger.info('Symbol model cache cleared');
}

export async function predictSignal(
    features: MLFeatureVector,
    symbol?: string,
    tradeType?: string
): Promise<MLPrediction | null> {
    // Tentar carregar modelo específico do símbolo
    let sessionToUse = inferenceSession;
    let modelSource: 'symbol_specific' | 'global_fallback' = 'global_fallback';
    
    if (symbol) {
        const symbolSession = await loadSymbolModel(symbol);
        if (symbolSession) {
            sessionToUse = symbolSession;
            modelSource = 'symbol_specific';
        }
    }
    
    if (!sessionToUse) {
        if (!modelLoaded) {
            const success = await loadModel();
            if (!success) return null;
            sessionToUse = inferenceSession;
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
        const inputName = sessionToUse!.inputNames[0];
        feeds[inputName] = tensor;

        const results = await sessionToUse!.run(feeds);

        const labelTensor = results[sessionToUse!.outputNames[0]];
        const probTensor = results[sessionToUse!.outputNames[1]];

        const predictedClass = Number(labelTensor.data[0]);

        let probability = 0;
        if (probTensor && probTensor.data.length >= 2) {
            probability = Number(probTensor.data[1]);
        }

        const result = {
            predictedClass: predictedClass as 0 | 1,
            probability,
            confidence: probability,  // probabilidade direta de win — não inverter
            modelSource,
        };
        
        logger.debug(`[ML-CONFIDENCE] ${symbol || 'unknown'}: prob=${probability.toFixed(4)}, predictedClass=${predictedClass}, model=${modelSource}`);
        
        return result;
    } catch (error) {
        logger.error('ML inference failed', { error });
        return null;
    }
}

export function isModelLoaded(): boolean {
    return modelLoaded && inferenceSession !== null;
}

export function getAdaptiveThreshold(recentWinRate: number | null): number {
    if (recentWinRate === null) {
        logger.debug(`[ML] Threshold adaptativo: prob_min=0.65 (Sem histórico suficiente)`);
        return 0.65;
    }
    
    let threshold = 0.65;
    if (recentWinRate < 0.35) {
        threshold = 0.72; // Mais rigoroso em fase ruim
    } else if (recentWinRate > 0.50) {
        threshold = 0.60; // Mais permissivo em fase boa
    }
    
    logger.debug(`[ML] Threshold adaptativo: prob_min=${threshold} (WR recente=${(recentWinRate * 100).toFixed(1)}%)`);
    return threshold;
}
