-- 1. Ver quantos registros tem
SELECT COUNT(*) as total
FROM ml_training_data;

-- 2. Ver se tem coluna trade_type
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'ml_training_data'
ORDER BY ordinal_position;

-- 3. Ver exemplos de dados
SELECT *
FROM ml_training_data
LIMIT 5;

-- 4. Se tiver trade_type, ver distribuição
-- (Execute só se a query 2 mostrar que existe trade_type)
SELECT 
    trade_type,
    COUNT(*) as total
FROM ml_training_data
GROUP BY trade_type;
