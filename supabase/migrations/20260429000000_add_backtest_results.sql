-- ═══════════════════════════════════════════════════════════
-- Migration: Backtest Results Table
-- Persists backtest runs for history and comparison
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS backtest_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Config summary (for quick queries)
    symbols         TEXT[] NOT NULL,
    timeframe       TEXT NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    initial_capital NUMERIC(18, 2) NOT NULL,

    -- Key metrics (for list/compare views without loading full JSON)
    total_trades        INT NOT NULL DEFAULT 0,
    win_rate            NUMERIC(6, 2),
    profit_factor       NUMERIC(8, 4),
    total_pnl           NUMERIC(18, 2),
    total_pnl_percent   NUMERIC(10, 4),
    max_drawdown_pct    NUMERIC(8, 4),
    sharpe_ratio        NUMERIC(8, 4),
    sortino_ratio       NUMERIC(8, 4),

    -- Config snapshot (full)
    config_json     JSONB NOT NULL,

    -- Full result (trades + equity curve + metrics)
    result_json     JSONB,

    -- Optional label set by user
    label           TEXT
);

-- Index for history queries
CREATE INDEX IF NOT EXISTS idx_backtest_results_created
    ON backtest_results (created_at DESC);

-- Index for symbol-based queries
CREATE INDEX IF NOT EXISTS idx_backtest_results_symbols
    ON backtest_results USING gin(symbols);

-- RLS: all authenticated users can read/write their own backtests
ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON backtest_results
    FOR ALL USING (true);
