import { AdvancedSignal, AdvancedSignalInput } from '@/services/advancedSignalGenerator';
import { extractFeatures } from './featureExtractor';
import { getMLPrediction } from './mlPredictionService';

// Configuration for ML filtering
const ML_CONFIG = {
    enabled: true, // Should be controlled by user settings
    thresholds: {
        strong: 0.75, // 75% probability of win
        moderate: 0.60, // 60% probability of win
        min: 0.55 // Minimum to even show as a signal if strict mode
    }
};

/**
 * Enriches a signal with ML probability and strength classification.
 * Returns the original signal with added ML metadata.
 */
export const filterSignalWithML = async (
    signal: AdvancedSignal,
    input: AdvancedSignalInput
): Promise<AdvancedSignal> => {
    // 1. Check if ML is enabled (mock for now, should check store/settings)
    // const isEnabled = useMLStore.getState().isEnabled;
    const isEnabled = true;

    if (!isEnabled) {
        return signal;
    }

    try {
        // 2. Extract features
        const features = extractFeatures(signal, input);

        // 3. Get Prediction
        const prediction = await getMLPrediction(features);

        // 4. Classify Strength
        let mlStrength: 'strong' | 'moderate' | 'weak' = 'weak';
        if (prediction.probability >= ML_CONFIG.thresholds.strong) {
            mlStrength = 'strong';
        } else if (prediction.probability >= ML_CONFIG.thresholds.moderate) {
            mlStrength = 'moderate';
        }

        // 5. Enrich Signal
        // We need to extend the AdvancedSignal type to support ML fields.
        // For now, we will add them as optional properties to the object.
        const enrichedSignal = {
            ...signal,
            mlProbability: prediction.probability,
            mlStrength,
            // If probability is very low, we might want to flag it or even return null to filter it out completely
            // But usually better to return it marked as 'weak' so UI can decide.
        } as AdvancedSignal & { mlProbability: number, mlStrength: string };

        return enrichedSignal;

    } catch (error) {
        console.error('ML Signal Filter validation failed:', error);
        return signal; // Fallback to original signal on error
    }
};
