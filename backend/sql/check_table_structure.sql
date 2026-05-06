-- Verificar estrutura da tabela trade_signals
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'trade_signals'
ORDER BY ordinal_position;
