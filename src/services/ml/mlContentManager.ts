import { MLModelArtifact, MLTrainingSample, MLTrainingData } from '@/types/mlTypes';

// ---- Models ----

export const saveModel = async (_model: MLModelArtifact): Promise<{ error: Error | null }> => {
    console.log("Saving model locally not implemented");
    return { error: null };
};

export const getActiveModel = async (): Promise<{ model: MLModelArtifact | null, error: Error | null }> => {
    return { model: null, error: null };
};

// ---- Training Data ----

export const saveTrainingData = async (_samples: MLTrainingSample[]): Promise<{ count: number, error: Error | null }> => {
    console.log("Saving training data locally not implemented");
    return { count: 0, error: null };
};

export const fetchTrainingData = async (): Promise<MLTrainingData | null> => {
    // Treinamento acontece no backend em Python, frontend não precisa mais baixar
    return null;
};

// ... other implementations can return empty since frontend won't train/push to Supabase anymore
// We keep the interfaces for backward compatibility of UI until completely removed, but avoid throwing.
