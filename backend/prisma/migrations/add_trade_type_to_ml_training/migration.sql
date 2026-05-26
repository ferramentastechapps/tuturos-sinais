-- Add trade_type column to ml_training_data
ALTER TABLE "MLTrainingData" ADD COLUMN "trade_type" TEXT;

-- Update existing records with default value 'swing'
UPDATE "MLTrainingData" 
SET "trade_type" = 'swing' 
WHERE "trade_type" IS NULL;
