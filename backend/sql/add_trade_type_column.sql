-- ═══════════════════════════════════════════════════════════
-- Adicionar coluna trade_type para filtros de ML Analytics
-- ═══════════════════════════════════════════════════════════

-- 1. Adicionar coluna trade_type se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trade_signals' 
        AND column_name = 'trade_type'
    ) THEN
        ALTER TABLE trade_signals 
        ADD COLUMN trade_type VARCHAR(20);
        
        RAISE NOTICE 'Coluna trade_type adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna trade_type já existe';
    END IF;
END $$;

-- 2. Atualizar registros existentes baseado em lógica
-- Assumindo que sinais com timeframe 5m são scalping, resto é swing
UPDATE trade_signals 
SET trade_type = CASE 
    WHEN timeframe = '5m' THEN 'scalping'
    WHEN timeframe IN ('15m', '1h', '4h', '1d') THEN 'swing'
    ELSE 'swing' -- padrão
END
WHERE trade_type IS NULL;

-- 3. Criar índice para melhorar performance de queries filtradas
CREATE INDEX IF NOT EXISTS idx_trade_signals_trade_type 
ON trade_signals(trade_type);

CREATE INDEX IF NOT EXISTS idx_trade_signals_exit_time_trade_type 
ON trade_signals(exit_time, trade_type);

-- 4. Verificar resultado
SELECT 
    trade_type,
    COUNT(*) as total,
    COUNT(CASE WHEN outcome = 'WIN' THEN 1 END) as wins,
    COUNT(CASE WHEN outcome = 'LOSS' THEN 1 END) as losses
FROM trade_signals
WHERE trade_type IS NOT NULL
GROUP BY trade_type
ORDER BY trade_type;

-- ═══════════════════════════════════════════════════════════
-- Resultado esperado:
-- trade_type | total | wins | losses
-- -----------+-------+------+--------
-- scalping   |   X   |  Y   |   Z
-- swing      |   X   |  Y   |   Z
-- ═══════════════════════════════════════════════════════════
