-- ============================================================
-- VERIFICAR SINAIS FECHADOS E TRADE_TYPE
-- ============================================================

-- 1. Ver distribuição de STATUS
SELECT 
    status,
    COUNT(*) as total,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentual
FROM trade_signals
GROUP BY status
ORDER BY total DESC;

-- 2. Ver distribuição de TRADE_TYPE
SELECT 
    COALESCE(trade_type, 'SEM_TIPO') as tipo,
    COUNT(*) as total
FROM trade_signals
GROUP BY trade_type
ORDER BY total DESC;

-- 3. Ver SINAIS FECHADOS por TRADE_TYPE
SELECT 
    COALESCE(trade_type, 'SEM_TIPO') as tipo,
    status,
    COUNT(*) as total
FROM trade_signals
WHERE status IN ('CLOSED_TP', 'CLOSED_SL')
GROUP BY trade_type, status
ORDER BY total DESC;

-- 4. Ver SINAIS ATIVOS por TRADE_TYPE
SELECT 
    COALESCE(trade_type, 'SEM_TIPO') as tipo,
    COUNT(*) as total
FROM trade_signals
WHERE status = 'active'
GROUP BY trade_type
ORDER BY total DESC;

-- 5. Ver últimos 10 sinais de cada tipo
SELECT 
    'SWING' as filtro,
    id,
    pair,
    trade_type,
    status,
    created_at
FROM trade_signals
WHERE trade_type ILIKE '%swing%'
ORDER BY created_at DESC
LIMIT 10;

SELECT 
    'SCALPING' as filtro,
    id,
    pair,
    trade_type,
    status,
    created_at
FROM trade_signals
WHERE trade_type ILIKE '%scalp%'
ORDER BY created_at DESC
LIMIT 10;

-- 6. RESUMO GERAL
SELECT 
    'Total de sinais' as metrica,
    COUNT(*) as valor
FROM trade_signals
UNION ALL
SELECT 
    'Sinais fechados',
    COUNT(*)
FROM trade_signals
WHERE status IN ('CLOSED_TP', 'CLOSED_SL')
UNION ALL
SELECT 
    'Sinais ativos',
    COUNT(*)
FROM trade_signals
WHERE status = 'active'
UNION ALL
SELECT 
    'Sinais SWING',
    COUNT(*)
FROM trade_signals
WHERE trade_type ILIKE '%swing%'
UNION ALL
SELECT 
    'Sinais SCALPING',
    COUNT(*)
FROM trade_signals
WHERE trade_type ILIKE '%scalp%'
UNION ALL
SELECT 
    'Sinais sem tipo',
    COUNT(*)
FROM trade_signals
WHERE trade_type IS NULL;
