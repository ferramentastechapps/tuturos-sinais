
CREATE TABLE public.trade_signals (
  id TEXT PRIMARY KEY,
  pair TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('long', 'short')),
  entry DOUBLE PRECISION NOT NULL,
  take_profit DOUBLE PRECISION NOT NULL,
  take_profit_1 DOUBLE PRECISION,
  take_profit_2 DOUBLE PRECISION,
  take_profit_3 DOUBLE PRECISION,
  stop_loss DOUBLE PRECISION NOT NULL,
  risk_reward DOUBLE PRECISION NOT NULL DEFAULT 0,
  timeframe TEXT NOT NULL DEFAULT '1h',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hit_tp', 'hit_sl', 'cancelled')),
  confidence INTEGER NOT NULL DEFAULT 0,
  indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality JSONB,
  ml_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for queries
CREATE INDEX idx_trade_signals_status ON public.trade_signals (status);
CREATE INDEX idx_trade_signals_pair ON public.trade_signals (pair);
CREATE INDEX idx_trade_signals_created_at ON public.trade_signals (created_at DESC);

-- Enable RLS but allow public read (signals are public data)
ALTER TABLE public.trade_signals ENABLE ROW LEVEL SECURITY;

-- Everyone can read signals
CREATE POLICY "Anyone can read signals"
  ON public.trade_signals
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only service role can insert/update (backend)
CREATE POLICY "Service role can insert signals"
  ON public.trade_signals
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update signals"
  ON public.trade_signals
  FOR UPDATE
  TO service_role
  USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_trade_signals_updated_at
  BEFORE UPDATE ON public.trade_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_signals;
