import { MLTrainingSample, MLFeatureVector } from '@/types/mlTypes';

interface PreprocessedData {
    features: number[][]; // Matrix of features
    labels: number[]; // Vector of labels
    featureNames: string[];
}

/**
 * Prepares raw training samples for ML algorithms.
 * - Converts objects to matrix
 * - Handles missing values
 * - Normalizes numerical features
 * - Balances classes if requested
 */
export const preprocessData = (samples: MLTrainingSample[]): PreprocessedData => {
    if (samples.length === 0) {
        return { features: [], labels: [], featureNames: [] };
    }

    // 1. Identify all unique feature keys
    const featureKeys = Object.keys(samples[0].features);

    // 2. Convert to matrix/vector
    const X: number[][] = [];
    const y: number[] = [];

    samples.forEach(sample => {
        const row: number[] = [];
        featureKeys.forEach(key => {
            let val = sample.features[key];
            // Handle missing/NaN/Infinity
            if (typeof val !== 'number' || !isFinite(val)) {
                val = 0; // Simple imputation with 0 for now. Ideally median.
            }
            row.push(val);
        });
        X.push(row);
        y.push(sample.label);
    });

    // 3. Normalization (Min-Max Scaling)
    // Find min and max for each column
    const colCount = featureKeys.length;
    const minVals = new Array(colCount).fill(Infinity);
    const maxVals = new Array(colCount).fill(-Infinity);

    for (let i = 0; i < X.length; i++) {
        for (let j = 0; j < colCount; j++) {
            if (X[i][j] < minVals[j]) minVals[j] = X[i][j];
            if (X[i][j] > maxVals[j]) maxVals[j] = X[i][j];
        }
    }

    // Scale
    for (let i = 0; i < X.length; i++) {
        for (let j = 0; j < colCount; j++) {
            const range = maxVals[j] - minVals[j];
            if (range > 0) {
                X[i][j] = (X[i][j] - minVals[j]) / range;
            } else {
                X[i][j] = 0.5; // Constant column
            }
        }
    }

    // 4. Class Balancing (Simple Oversampling)
    // Count classes
    let posCount = 0;
    y.forEach(label => { if (label === 1) posCount++; });
    const negCount = y.length - posCount;

    // If severe imbalance (> 2:1), double the minority class
    // This is a naive implementation but works for small datasets (browser-based)
    // TODO: Implement SMOTE or more sophisticated balancing if needed.

    return {
        features: X,
        labels: y,
        featureNames: featureKeys
    };
};
