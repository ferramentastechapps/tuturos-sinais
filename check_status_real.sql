-- Ver TODOS os status que existem
SELECT 
    status,
    COUNT(*) as total
FROM trade_signals
GROUP BY status
ORDER BY total DESC;
