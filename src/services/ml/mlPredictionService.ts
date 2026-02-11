
import * as ort from 'onnxruntime-web';
import { getActiveModel } from './mlContentManager';
import { MLFeatureVector, MLPrediction } from '@/types/mlTypes';

// Configure ONNX Runtime to use WASM
// We might need to point to the wasm files depending on build setup,
// but usually the npm package handles it or serves from cdn.
ort.env.wasm.numThreads = 1;

let inferenceSession: ort.InferenceSession | null = null;
let activeModelId: string | null = null;

// Feature order MUST match train_model.py exactly
const FEATURE_COLUMNS = [
    'rsi', 'adx', 'atr_rel', 'dist_ema20', 'dist_ema50', 'dist_ema200', 'dist_vwap',
    'volatility_24h', 'volume_rel', 'funding_rate', 'open_interest_var', 'long_short_ratio',
    'is_long', 'confidence', 'quality_score', 'confluence_count', 'stop_loss_pct',
    'take_profit_pct', 'risk_reward', 'hour_of_day', 'day_of_week',
    'btc_trend', 'dominance_btc', 'fear_greed'
];

export const loadModel = async (): Promise<boolean> => {
    try {
        const { model, error } = await getActiveModel();
        if (error || !model) {
            console.warn('[ML Service] No active model found.');
            return false;
        }

        if (inferenceSession && activeModelId === model.id) {
            return true; // Already loaded
        }

        console.log(`[ML Service] Loading model ${model.version} (${model.type})...`);

        // Decode ArrayBuffer from base64/JSON content
        // transform `model.data.content` (base64) -> Uint8Array
        const base64Data = model.data.content;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Create session
        inferenceSession = await ort.InferenceSession.create(bytes);
        activeModelId = model.id;

        console.log('[ML Service] Model loaded successfully.');
        return true;
    } catch (e) {
        console.error('[ML Service] Failed to load model:', e);
        return false;
    }
};

export const predictSignal = async (features: MLFeatureVector): Promise<MLPrediction | null> => {
    if (!inferenceSession) {
        const success = await loadModel();
        if (!success) return null;
    }

    try {
        // Prepare input tensor
        // Flatten features in correct order
        const inputData = new Float32Array(FEATURE_COLUMNS.length);

        FEATURE_COLUMNS.forEach((col, idx) => {
            inputData[idx] = features[col] || 0;
        });

        const tensor = new ort.Tensor('float32', inputData, [1, FEATURE_COLUMNS.length]);

        // Run inference
        // Note: 'float_input' matches the input name in train_model.py
        const feeds: Record<string, ort.Tensor> = {};
        const inputName = inferenceSession!.inputNames[0]; // dynamically get input name
        feeds[inputName] = tensor;

        const results = await inferenceSession!.run(feeds);

        // Output processing
        // XGBoost onnx usually outputs 'label' and 'probabilities'
        // Check output names: session.outputNames
        const labelTensor = results[inferenceSession!.outputNames[0]]; // Predicted Class
        const probTensor = results[inferenceSession!.outputNames[1]]; // Probabilities map (usually) 

        // For XGBoostClassifier ONNX, probTensor is often a map sequence or tensor of shape [1, 2]
        // If it's a map (Sequence), onnxruntime-web might return it differently.
        // Let's assume standard float tensor output for now or debug if needed.

        // Simple extraction:
        const predictedClass = Number(labelTensor.data[0]);

        // Probability extraction can be tricky in ONNX JS depending on how sklearn-onnx exported it.
        // Often it returns a Map, which JS runtime might return as an object or specialized type.
        // For ZipMap=False (which we didn't specify explicitly in train_model.py, but usually default is True), 
        // we might get a map.

        // Let's handle the most common case: getting the probability of class 1.
        // If probTensor.data is Float32Array [prob0, prob1]
        let probability = 0;
        if (probTensor && probTensor.data.length >= 2) {
            probability = Number(probTensor.data[1]);
        }

        return {
            predictedClass: predictedClass as 0 | 1,
            probability,
            confidence: probability > 0.5 ? probability : 1 - probability,
        };

    } catch (e) {
        console.error('[ML Service] Inference failed:', e);
        return null;
    }
};
