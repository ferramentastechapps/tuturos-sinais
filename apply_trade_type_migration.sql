-- ============================================
-- Migration: Add trade_type to ml_training_data
-- ============================================

-- 1. Adicionar coluna trade_type
ALTER TABLE ml_training_data 
ADD COLUMN IF NOT EXISTS trade_type TEXT;

-- 2. Atualizar registros existentes
-- Por padrão, vamos marcar todos como 'swing'
-- (você pode ajustar depois se souber quais são de scalping)
UPDATE ml_training_data 
SET trade_type = 'swing' 
WHERE trade_type IS NULL;

-- 3. Verificar resultado
SELECT 
    trade_type,
    COUNT(*) as total
FROM ml_training_data
GROUP BY trade_type;

-- 4. Ver exemplos
SELECT 
    id,
    symbol,
    trade_type,
    outcome_label,
    outcome_pnl
FROM ml_training_data
ORDER BY created_at DESC
LIMIT 10;
