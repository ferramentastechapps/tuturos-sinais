import { apiClient, isBackendAvailable } from '../apiClient';
import { MLFeatureVector, MLPrediction } from '@/types/mlTypes';

export const loadModel = async (): Promise<boolean> => {
    if (!isBackendAvailable) return false;
    
    try {
        const response = await apiClient.get('/ml/stats');
        return response.data?.loaded || false;
    } catch (e) {
        console.warn('[ML Service] Failed to check model status:', e);
        return false;
    }
};

export const predictSignal = async (features: MLFeatureVector): Promise<MLPrediction | null> => {
    if (!isBackendAvailable) {
        return null;
    }

    try {
        const response = await apiClient.post<MLPrediction>('/ml/predict', features);
        
        if (response.data && typeof response.data.probability === 'number') {
            return response.data;
        }
        
        return null;
    } catch (e: any) {
        if (e?.response?.status === 503) {
            console.debug('[ML Service] ML features disabled on backend');
        } else {
            console.error('[ML Service] Inference failed:', e?.response?.data || e.message);
        }
        return null;
    }
};
