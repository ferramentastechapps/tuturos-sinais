-- Create strategy_profiles table
CREATE TABLE public.strategy_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_preset BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  indicators JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.strategy_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own strategy profiles"
  ON public.strategy_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own strategy profiles"
  ON public.strategy_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own strategy profiles"
  ON public.strategy_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strategy profiles"
  ON public.strategy_profiles FOR DELETE
  USING (auth.uid() = user_id AND is_preset = false);

-- Performance indexes
CREATE INDEX idx_strategy_profiles_user_id ON public.strategy_profiles(user_id);
CREATE INDEX idx_strategy_profiles_is_default ON public.strategy_profiles(user_id, is_default);

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_strategy_profiles_updated_at
  BEFORE UPDATE ON public.strategy_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
