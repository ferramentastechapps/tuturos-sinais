-- Tabela para armazenar estratégias de backtest personalizadas
-- Permite aos usuários criar e gerenciar suas próprias estratégias

CREATE TABLE IF NOT EXISTS backtest_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Informações básicas
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'swing', -- swing, scalping, day-trade, position
    timeframe TEXT NOT NULL DEFAULT '1h', -- 1m, 5m, 15m, 30m, 1h, 4h, 1d
    
    -- Indicadores utilizados
    indicators TEXT[] DEFAULT '{}',
    
    -- Configurações opcionais (JSON)
    config JSONB DEFAULT '{}',
    
    -- Metadados
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT, -- user_id se houver autenticação
    
    CONSTRAINT valid_type CHECK (type IN ('swing', 'scalping', 'day-trade', 'position')),
    CONSTRAINT valid_timeframe CHECK (timeframe IN ('1m', '5m', '15m', '30m', '1h', '4h', '1d'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_backtest_strategies_type ON backtest_strategies(type);
CREATE INDEX IF NOT EXISTS idx_backtest_strategies_timeframe ON backtest_strategies(timeframe);
CREATE INDEX IF NOT EXISTS idx_backtest_strategies_created_at ON backtest_strategies(created_at DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_backtest_strategies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_backtest_strategies_updated_at
    BEFORE UPDATE ON backtest_strategies
    FOR EACH ROW
    EXECUTE FUNCTION update_backtest_strategies_updated_at();

-- Inserir estratégias padrão
INSERT INTO backtest_strategies (name, description, type, timeframe, indicators) VALUES
('Signal Engine Padrão (Score)', 'Estratégia padrão baseada em score multi-indicador com filtros de tendência e volatilidade', 'swing', '1h', ARRAY['EMA', 'RSI', 'MACD', 'ADX', 'ATR']),
('Robô de Scalping (5m)', 'Estratégia de scalping rápido com entradas e saídas em 5 minutos', 'scalping', '5m', ARRAY['EMA', 'RSI', 'Volume']),
('EMA Cross Volume', 'Cruzamento de EMAs com confirmação de volume', 'swing', '15m', ARRAY['EMA', 'Volume']),
('RSI Divergence', 'Divergências de RSI para reversões de tendência', 'swing', '1h', ARRAY['RSI', 'Price Action']),
('Bollinger Squeeze', 'Compressão de Bollinger Bands para breakouts', 'day-trade', '15m', ARRAY['Bollinger Bands', 'Volume']),
('VWAP Reversion', 'Reversão à média usando VWAP', 'scalping', '5m', ARRAY['VWAP', 'Volume']),
('MACD Cross', 'Cruzamento de MACD para tendências', 'swing', '4h', ARRAY['MACD', 'EMA']),
('ADX Trend Follow', 'Seguidor de tendência com ADX forte', 'swing', '4h', ARRAY['ADX', 'EMA', 'ATR']),
('Order Block + FVG SMC', 'Smart Money Concepts com Order Blocks e Fair Value Gaps', 'day-trade', '15m', ARRAY['Price Action', 'Volume', 'Liquidity']),
('Golden Cross Swing', 'Golden/Death Cross para swing trading', 'position', '1d', ARRAY['EMA50', 'EMA200', 'Volume'])
ON CONFLICT DO NOTHING;

COMMENT ON TABLE backtest_strategies IS 'Estratégias de backtest personalizadas criadas pelos usuários';
COMMENT ON COLUMN backtest_strategies.name IS 'Nome da estratégia';
COMMENT ON COLUMN backtest_strategies.description IS 'Descrição detalhada da lógica da estratégia';
COMMENT ON COLUMN backtest_strategies.type IS 'Tipo de trading: swing, scalping, day-trade, position';
COMMENT ON COLUMN backtest_strategies.timeframe IS 'Timeframe principal da estratégia';
COMMENT ON COLUMN backtest_strategies.indicators IS 'Lista de indicadores utilizados';
COMMENT ON COLUMN backtest_strategies.config IS 'Configurações adicionais em JSON';
