import { MLModelArtifact, MLModelMetrics, MLFeatureVector, MLPrediction, MLServiceStatus } from '@/types/mlTypes';
import { getActiveModel, saveModel, fetchTrainingData } from './mlContentManager';
import { extractFeatures } from './featureExtractor';
import { preprocessData } from './preprocessor';
import { RandomForestClassifier } from './models/randomForest';

class MLService {
    private activeModel: any | null = null;
    private status: MLServiceStatus = {
        isReady: false,
        isTraining: false,
        trainingSamplesCount: 0,
    };

    /**
     * Initializes the ML service by loading the active model from storage.
     */
    async initialize() {
        try {
            const { model, error } = await getActiveModel();
            if (model) {
                // TODO: Deserialize model based on type
                // this.activeModel = RandomForestClassifier.deserialize(model.data);
                this.status.activeModelVersion = model.version;
                this.status.isReady = true;
                console.log('ML Serviçe initialized with model version:', model.version);
            } else {
                console.log('No active ML model found. Service running in fallback mode.');
            }
        } catch (e) {
            console.error('Failed to initialize ML Service:', e);
        }
    }

    /**
     * Predicts the probability of a winning trade for the given features.
     */
    async predict(features: MLFeatureVector): Promise<MLPrediction> {
        if (!this.status.isReady || !this.activeModel) {
            // Fallback: Return null or a heuristic-based "prediction"
            // For now, we return a neutral prediction so the filter can fallback to signal score
            return {
                probability: 0.5,
                predictedClass: 0,
                confidence: 0,
                contribution: {}
            };
        }

        try {
            // const probability = this.activeModel.predictProba(features);
            // const predictedClass = probability >= 0.5 ? 1 : 0;

            // Mock for now
            return {
                probability: 0.5,
                predictedClass: 0,
                confidence: 0,
                contribution: {}
            };
        } catch (e) {
            console.error('Prediction failed', e);
            return { probability: 0.5, predictedClass: 0, confidence: 0 };
        }
    }

    /**
     * Trains a new model using data from Supabase.
     */
    async trainModel(modelType: 'random_forest' | 'gradient_boosting' = 'random_forest'): Promise<MLModelMetrics | null> {
        if (this.status.isTraining) {
            throw new Error('Training already in progress');
        }

        this.status.isTraining = true;

        try {
            // 1. Fetch Data
            const { samples, error } = await fetchTrainingData(5000); // Limit to 5k recent trades
            if (error || samples.length < 50) {
                throw new Error('Insufficient training data (min 50 samples required)');
            }

            this.status.trainingSamplesCount = samples.length;

            // 2. Preprocess Data
            const { features: X, labels: y } = preprocessData(samples);

            if (X.length === 0) {
                throw new Error('Preprocessing resulted in empty dataset');
            }

            // 3. Train
            let model;
            if (modelType === 'random_forest') {
                model = new RandomForestClassifier({ nEstimators: 20 }); // Small forest for browser
                await model.train(X, y);
            } else {
                // Fallback or other models
                model = new RandomForestClassifier();
                await model.train(X, y);
            }

            this.activeModel = model;

            // 4. Evaluate (on training set for now, ideally user test set)
            // Calculate basic accuracy on training set
            let correct = 0;
            for (let i = 0; i < X.length; i++) {
                const pred = model.predictProba(X[i]) >= 0.5 ? 1 : 0;
                if (pred === y[i]) correct++;
            }
            const accuracy = correct / X.length;

            const metrics: MLModelMetrics = {
                accuracy,
                precision: 0.0, // TODO
                recall: 0.0, // TODO
                f1Score: 0.0, // TODO
                profitFactor: 0,
                winRate: accuracy,
                trainedAt: Date.now(),
                sampleSize: samples.length
            };

            // 5. Save
            const artifact: MLModelArtifact = {
                id: crypto.randomUUID(),
                version: `v1_${Date.now()}`,
                type: modelType,
                createdAt: Date.now(),
                metrics,
                isActive: true,
                data: model.toJSON()
            };

            await saveModel(artifact);

            this.status.lastTrainingDate = Date.now();
            this.status.activeModelVersion = artifact.version;
            this.status.isReady = true;

            return metrics;

        } catch (e) {
            console.error('Training failed:', e);
            throw e;
        } finally {
            this.status.isTraining = false;
        }
    }

    getStatus() {
        return this.status;
    }
}

export const mlService = new MLService();
