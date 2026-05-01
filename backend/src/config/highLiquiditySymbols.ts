// ═══════════════════════════════════════════════════════════
// High Liquidity Symbols Filter
// CORREÇÃO 5: Símbolos com volume médio diário > $100M na Bybit
// Reduz fees e melhora qualidade de execução
// ═══════════════════════════════════════════════════════════

/**
 * Lista de símbolos com alta liquidez baseada em análise de backtest
 * jan-mai 2026 (414 trades). Melhores performers + volume consistente.
 */
export const HIGH_LIQUIDITY_SYMBOLS = [
    // Tier 1: Majors (>$1B volume diário)
    'BTCUSDT',
    'ETHUSDT',
    'SOLUSDT',
    'BNBUSDT',
    'XRPUSDT',
    
    // Tier 2: Large Caps ($500M-$1B)
    'ADAUSDT',
    'DOGEUSDT',
    'LINKUSDT',
    'AVAXUSDT',
    'MATICUSDT',
    'DOTUSDT',
    'ATOMUSDT',
    'LTCUSDT',
    'TRXUSDT',
    
    // Tier 3: Mid Caps ($100M-$500M) - Bons performers no backtest
    'APTUSDT',
    'JUPUSDT',
    'THETAUSDT',
    'FILUSDT',
    'ARBUSDT',
    'OPUSDT',
    'UNIUSDT',
    'AAVEUSDT',
    'INJUSDT',
    'SUIUSDT',
    'NEARUSDT',
    'RENDERUSDT',
    'IMXUSDT',
    'STXUSDT',
    'FTMUSDT',
];

/**
 * Símbolos removidos (baixa liquidez ou meme coins com alta volatilidade fake):
 * PEPE, FLOKI, BONK, WIF, MEME, SHIB, DOGE (exceto DOGE que tem liquidez real)
 */

/**
 * Verifica se um símbolo está na lista de alta liquidez
 */
export function isHighLiquidity(symbol: string): boolean {
    return HIGH_LIQUIDITY_SYMBOLS.includes(symbol);
}

/**
 * Filtra uma lista de símbolos mantendo apenas os de alta liquidez
 */
export function filterHighLiquidity(symbols: string[]): string[] {
    return symbols.filter(isHighLiquidity);
}

/**
 * Retorna a lista completa de símbolos de alta liquidez
 */
export function getHighLiquiditySymbols(): string[] {
    return [...HIGH_LIQUIDITY_SYMBOLS];
}
