-- Add trade_type column to ml_training_data
ALTER TABLE "MLTrainingData" ADD COLUMN IF NOT EXISTS "trade_type" TEXT;

-- Update existing records with default value 'swing'
-- (você pode ajustar isso depois se souber quais são de scalping)
UPDATE "MLTrainingData" 
SET "trade_type" = 'swing' 
WHERE "trade_type" IS NULL;
