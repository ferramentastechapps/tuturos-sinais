-- Verificar trade_type dos sinais FECHADOS
SELECT 
    trade_type,
    COUNT(*) as total
FROM trade_signals
WHERE status IN ('CLOSED_TP', 'CLOSED_SL')
GROUP BY trade_type
ORDER BY total DESC;

-- Ver exemplos de sinais fechados
SELECT 
    id,
    pair,
    trade_type,
    status,
    updated_at
FROM trade_signals
WHERE status IN ('CLOSED_TP', 'CLOSED_SL')
ORDER BY updated_at DESC
LIMIT 10;
