-- Create tables for Machine Learning System

-- 1. Table to store trained ML models
CREATE TABLE IF NOT EXISTS public.ml_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version TEXT NOT NULL, -- e.g., 'v1_20240210'
  type TEXT NOT NULL, -- 'random_forest', 'gradient_boosting', 'ensemble'
  data JSONB NOT NULL, -- The serialized model data
  metrics JSONB NOT NULL, -- Performance metrics (accuracy, f1, sharpe, etc.)
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Table to store training data (historical trades)
CREATE TABLE IF NOT EXISTS public.ml_training_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  features JSONB NOT NULL, -- The 30+ dimensional feature vector
  outcome_label INTEGER NOT NULL, -- 1 (win) or 0 (loss)
  outcome_pnl NUMERIC NOT NULL, -- Actual PnL percentage
  entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_ml_models_user_id ON public.ml_models(user_id);
CREATE INDEX idx_ml_models_is_active ON public.ml_models(is_active) WHERE is_active = true;
CREATE INDEX idx_ml_training_data_user_id ON public.ml_training_data(user_id);
CREATE INDEX idx_ml_training_data_symbol ON public.ml_training_data(symbol);
CREATE INDEX idx_ml_training_data_entry_time ON public.ml_training_data(entry_time DESC);

-- Enable Row Level Security
ALTER TABLE public.ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_training_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ml_models
CREATE POLICY "Users can view their own models"
  ON public.ml_models FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own models"
  ON public.ml_models FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own models"
  ON public.ml_models FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own models"
  ON public.ml_models FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for ml_training_data
CREATE POLICY "Users can view their own training data"
  ON public.ml_training_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own training data"
  ON public.ml_training_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own training data"
  ON public.ml_training_data FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at for ml_models
CREATE TRIGGER update_ml_models_updated_at
  BEFORE UPDATE ON public.ml_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
