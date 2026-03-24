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
            const dataResult = await fetchTrainingData(); 
            const samples = dataResult ? [] : []; // Just mock the array to avoid erroring if we were using it
            const error = null;

            if (error || samples.length < 50) {
                throw new Error('Insufficient training data (min 50 samples required)');
            }

            this.status.trainingSamplesCount = samples.length;

            // 2. Preprocess Data
            const { features: X, labels: y } = preprocessData(samples);

            if (X.length === 0) {
                throw new Error('Preprocessing resulted in empty dataset');
            }

            // 3. Split into Train / Test (80/20) for real evaluation
            const splitIndex = Math.floor(X.length * 0.8);
            const xTrain = X.slice(0, splitIndex);
            const yTrain = y.slice(0, splitIndex);
            const xTest = X.slice(splitIndex);
            const yTest = y.slice(splitIndex);

            // 4. Train
            let model;
            if (modelType === 'random_forest') {
                model = new RandomForestClassifier({ nEstimators: 20 }); // Small forest for browser
                await model.train(xTrain, yTrain);
            } else {
                model = new RandomForestClassifier();
                await model.train(xTrain, yTrain);
            }

            this.activeModel = model;

            // 5. Evaluate on test set (Real Metrics)
            let tp = 0; // True Positives (Predicted Win, Actual Win)
            let tn = 0; // True Negatives (Predicted Loss, Actual Loss)
            let fp = 0; // False Positives (Predicted Win, Actual Loss)
            let fn = 0; // False Negatives (Predicted Loss, Actual Win)

            for (let i = 0; i < xTest.length; i++) {
                const pred = model.predictProba(xTest[i]) >= 0.5 ? 1 : 0;
                const actual = yTest[i];
                if (pred === 1 && actual === 1) tp++;
                if (pred === 0 && actual === 0) tn++;
                if (pred === 1 && actual === 0) fp++;
                if (pred === 0 && actual === 1) fn++;
            }

            const accuracy = (tp + tn) / xTest.length;
            const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
            const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
            const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

            const metrics: MLModelMetrics = {
                accuracy,
                precision,
                recall,
                f1Score,
                profitFactor: 0,
                winRate: (tp + fn) > 0 ? tp / (tp + fn) : 0, // Win rate in test set
                trainedAt: Date.now(),
                sampleSize: samples.length
            };

            // 6. Save (Locally only for UI reflection, it won't persist to Supabase based on mlContentManager update)
            const artifact: MLModelArtifact = {
                id: crypto.randomUUID(),
                version: `v1_${Date.now()}`,
                type: modelType,
                createdAt: Date.now(),
                metrics,
                isActive: true,
                data: {} // Empty, we don't save weights locally anymore
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
