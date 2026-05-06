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

-- Verificar se a coluna exit_time existe antes de criar índice composto
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trade_signals' 
        AND column_name = 'exit_time'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_trade_signals_exit_time_trade_type 
        ON trade_signals(exit_time, trade_type);
        RAISE NOTICE 'Índice composto criado com sucesso';
    ELSE
        RAISE NOTICE 'Coluna exit_time não existe, índice composto não criado';
    END IF;
END $$;

-- 4. Verificar resultado (apenas contagem básica)
SELECT 
    trade_type,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'CLOSED_TP' THEN 1 END) as closed_tp,
    COUNT(CASE WHEN status = 'CLOSED_SL' THEN 1 END) as closed_sl,
    COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending
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
