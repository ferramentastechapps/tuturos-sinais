-- Nova tabela para performance por símbolo e indicador
CREATE TABLE IF NOT EXISTS indicator_performance_by_symbol (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id), -- associado ao usuário
  symbol TEXT NOT NULL,
  indicator_key TEXT NOT NULL,
  
  -- Contadores
  total_trades INT DEFAULT 0,
  total_confirmed INT DEFAULT 0,
  wins_when_confirmed INT DEFAULT 0,
  losses_when_confirmed INT DEFAULT 0,
  wins_when_not_confirmed INT DEFAULT 0,
  losses_when_not_confirmed INT DEFAULT 0,
  
  -- Métricas
  avg_profit_when_confirmed FLOAT DEFAULT 0,
  avg_loss_when_confirmed FLOAT DEFAULT 0,
  total_profit FLOAT DEFAULT 0,
  total_loss FLOAT DEFAULT 0,
  
  -- Metadata
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Um usuário tem no máximo uma entrada por símbolo e indicador
  UNIQUE(user_id, symbol, indicator_key)
);

-- Índices para performance em buscas
CREATE INDEX IF NOT EXISTS idx_perf_symbol ON indicator_performance_by_symbol(symbol);
CREATE INDEX IF NOT EXISTS idx_perf_indicator ON indicator_performance_by_symbol(indicator_key);
CREATE INDEX IF NOT EXISTS idx_perf_user_symbol ON indicator_performance_by_symbol(user_id, symbol);

-- Row Level Security (RLS)
ALTER TABLE indicator_performance_by_symbol ENABLE ROW LEVEL SECURITY;

-- Usuários só podem ler seus próprios registros
CREATE POLICY "Users can view their own indicator performance" 
  ON indicator_performance_by_symbol FOR SELECT 
  USING (auth.uid() = user_id);

-- Usuários só podem inserir/atualizar seus próprios registros
CREATE POLICY "Users can insert their own indicator performance" 
  ON indicator_performance_by_symbol FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own indicator performance" 
  ON indicator_performance_by_symbol FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own indicator performance" 
  ON indicator_performance_by_symbol FOR DELETE 
  USING (auth.uid() = user_id);

-- Trigger para atualizar last_updated
CREATE OR REPLACE FUNCTION update_indicator_performance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_indicator_performance_updated_at ON indicator_performance_by_symbol;

CREATE TRIGGER trg_indicator_performance_updated_at
  BEFORE UPDATE ON indicator_performance_by_symbol
  FOR EACH ROW
  EXECUTE FUNCTION update_indicator_performance_updated_at();
