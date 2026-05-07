-- Ver estrutura e dados da ml_training_data
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'ml_training_data'
ORDER BY ordinal_position;

-- Ver se tem trade_type
SELECT 
    COUNT(*) as total_registros
FROM ml_training_data;

-- Ver exemplos
SELECT *
FROM ml_training_data
LIMIT 5;
