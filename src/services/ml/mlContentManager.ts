import { MLModelArtifact, MLTrainingSample } from '@/types/mlTypes';

// ---- Models ----

export const saveModel = async (model: MLModelArtifact): Promise<{ error: any }> => {
    console.log("Saving model locally not implemented");
    return { error: null };
};

export const getActiveModel = async (): Promise<{ model: MLModelArtifact | null, error: any }> => {
    return { model: null, error: null };
};

// ---- Training Data ----

export const saveTrainingData = async (samples: MLTrainingSample[]): Promise<{ count: number, error: any }> => {
    console.log("Saving training data locally not implemented");
    return { count: 0, error: null };
};

export const fetchTrainingData = async (limit = 1000): Promise<{ samples: MLTrainingSample[], error: any }> => {
    return { samples: [], error: null };
};
