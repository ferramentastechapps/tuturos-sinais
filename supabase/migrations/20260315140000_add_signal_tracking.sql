-- Migration: Add signal tracking tables
-- Description: Creates tables for active signals, signal events, and summaries.

CREATE TABLE IF NOT EXISTS public.active_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('LONG', 'SHORT')),
  trade_type TEXT NOT NULL, -- Scalping, Day Trade, Swing Trade
  entry_range_low NUMERIC NOT NULL,
  entry_range_high NUMERIC NOT NULL,
  stop_loss NUMERIC NOT NULL,
  initial_stop_loss NUMERIC NOT NULL,
  take_profits JSONB NOT NULL, -- e.g., [{"price": 44500, "hit": true}, {"price": 46200, "hit": false}]
  expected_duration TEXT,
  context TEXT,
  score INTEGER,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED_TP', 'CLOSED_SL', 'CANCELLED')),
  last_price_checked NUMERIC,
  last_check_time TIMESTAMPTZ,
  telegram_message_id TEXT, -- to reply or edit messages
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.active_signals ENABLE ROW LEVEL SECURITY;

-- Policy (internal backend usage mostly, but let's allow read for auth users if needed)
CREATE POLICY "Allow read access for authenticated users to active_signals" 
  ON public.active_signals FOR SELECT TO authenticated USING (true);

-- Signal Events table
CREATE TABLE IF NOT EXISTS public.signal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES public.active_signals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('TP_HIT', 'SL_HIT', 'TRAILING_STOP_UPDATED', 'SIGNAL_CLOSED')),
  message TEXT,
  price_at_event NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.signal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access for authenticated users to signal_events" 
  ON public.signal_events FOR SELECT TO authenticated USING (true);

-- Daily Summaries table
CREATE TABLE IF NOT EXISTS public.daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_date DATE NOT NULL UNIQUE,
  total_signals INTEGER NOT NULL DEFAULT 0,
  winners INTEGER NOT NULL DEFAULT 0,
  losers INTEGER NOT NULL DEFAULT 0,
  pnl NUMERIC NOT NULL DEFAULT 0,
  full_report_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access for authenticated users to daily_summaries" 
  ON public.daily_summaries FOR SELECT TO authenticated USING (true);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_active_signals_mod_time()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_active_signals_updated_at
BEFORE UPDATE ON public.active_signals
FOR EACH ROW
EXECUTE FUNCTION update_active_signals_mod_time();
