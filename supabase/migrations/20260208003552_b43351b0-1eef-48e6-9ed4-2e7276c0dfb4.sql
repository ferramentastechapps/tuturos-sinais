-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  notification_preferences JSONB DEFAULT '{"browserNotifications": false, "emailNotifications": false}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT profiles_user_id_unique UNIQUE (user_id)
);

-- Create indicator_alerts table for persisting alert history
CREATE TABLE public.indicator_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  indicator_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  threshold NUMERIC,
  message TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('bullish', 'bearish')),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indicator_alert_config table for user preferences
CREATE TABLE public.indicator_alert_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  browser_notifications BOOLEAN NOT NULL DEFAULT false,
  rsi_oversold NUMERIC NOT NULL DEFAULT 30,
  rsi_overbought NUMERIC NOT NULL DEFAULT 70,
  stoch_oversold NUMERIC NOT NULL DEFAULT 20,
  stoch_overbought NUMERIC NOT NULL DEFAULT 80,
  enable_macd_cross BOOLEAN NOT NULL DEFAULT true,
  enable_ema_cross BOOLEAN NOT NULL DEFAULT true,
  enable_bollinger_touch BOOLEAN NOT NULL DEFAULT true,
  enable_ichimoku_signals BOOLEAN NOT NULL DEFAULT true,
  enable_adx_cross BOOLEAN NOT NULL DEFAULT true,
  adx_strong_trend NUMERIC NOT NULL DEFAULT 25,
  enable_atr_alerts BOOLEAN NOT NULL DEFAULT true,
  atr_high_volatility NUMERIC NOT NULL DEFAULT 3,
  atr_low_volatility NUMERIC NOT NULL DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicator_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicator_alert_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for indicator_alerts
CREATE POLICY "Users can view their own alerts"
  ON public.indicator_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alerts"
  ON public.indicator_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts"
  ON public.indicator_alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts"
  ON public.indicator_alerts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for indicator_alert_config
CREATE POLICY "Users can view their own config"
  ON public.indicator_alert_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own config"
  ON public.indicator_alert_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own config"
  ON public.indicator_alert_config FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_indicator_alerts_user_id ON public.indicator_alerts(user_id);
CREATE INDEX idx_indicator_alerts_created_at ON public.indicator_alerts(created_at DESC);
CREATE INDEX idx_indicator_alerts_symbol ON public.indicator_alerts(symbol);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_indicator_alert_config_updated_at
  BEFORE UPDATE ON public.indicator_alert_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  INSERT INTO public.indicator_alert_config (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-creating profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();