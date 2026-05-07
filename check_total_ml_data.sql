-- Ver total de registros em ml_training_data
SELECT COUNT(*) as total FROM ml_training_data;

-- Ver distribuição por outcome
SELECT 
    outcome_label,
    COUNT(*) as total
FROM ml_training_data
GROUP BY outcome_label;

-- Ver todos os registros
SELECT * FROM ml_training_data
ORDER BY created_at DESC;
