// Binance Futures Asset Sync — Sincronização dinâmica de pares USDT perpétuos
// Busca automaticamente todos os pares disponíveis na Binance Futures API
// sem depender de listas hardcoded.

import { CryptoPair, AssetCategory } from '@/types/trading';

// ──────────── Tipos API Binance ────────────

interface BinanceExchangeSymbol {
    symbol: string;
    pair: string;
    contractType: string;         // 'PERPETUAL' | 'CURRENT_QUARTER' | etc.
    status: string;               // 'TRADING' | 'SETTLING' | etc.
    baseAsset: string;            // 'BTC', 'ETH', etc.
    quoteAsset: string;           // 'USDT'
    pricePrecision: number;
    quantityPrecision: number;
    filters: Array<{
        filterType: string;
        minQty?: string;
        notional?: string;
        minNotional?: string;
    }>;
}

interface BinanceExchangeInfo {
    symbols: BinanceExchangeSymbol[];
}

interface BinanceTicker24hr {
    symbol: string;
    lastPrice: string;
    priceChangePercent: string;
    volume: string;
    quoteVolume: string;
    highPrice: string;
    lowPrice: string;
}

// ──────────── Cache ────────────

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
let exchangeInfoCache: CacheEntry<BinanceExchangeSymbol[]> | null = null;
let tickerCache: CacheEntry<Map<string, BinanceTicker24hr>> | null = null;
let futuresSymbolsSet: Set<string> = new Set();

// ──────────── Constantes ────────────

const BINANCE_FUTURES_API = 'https://fapi.binance.com';

// Mapa de nomes completos para as moedas mais conhecidas (fallback)
const ASSET_NAMES: Record<string, string> = {
    BTC: 'Bitcoin', ETH: 'Ethereum', BNB: 'BNB', SOL: 'Solana',
    ADA: 'Cardano', AVAX: 'Avalanche', DOT: 'Polkadot', ATOM: 'Cosmos',
    NEAR: 'NEAR Protocol', APT: 'Aptos', SUI: 'Sui', TON: 'Toncoin',
    TRX: 'TRON', XRP: 'XRP', LTC: 'Litecoin', BCH: 'Bitcoin Cash',
    MATIC: 'Polygon', ARB: 'Arbitrum', OP: 'Optimism', IMX: 'Immutable',
    STRK: 'Starknet', MANTA: 'Manta Network', SCROLL: 'Scroll', ZK: 'ZKsync',
    BLAST: 'Blast',
    UNI: 'Uniswap', AAVE: 'Aave', CRV: 'Curve DAO', MKR: 'Maker',
    SNX: 'Synthetix', COMP: 'Compound', BAL: 'Balancer', SUSHI: 'SushiSwap',
    '1INCH': '1inch', LDO: 'Lido DAO', RPL: 'Rocket Pool', FXS: 'Frax Share',
    PENDLE: 'Pendle', JTO: 'Jito',
    OKB: 'OKB', CRO: 'Cronos', KCS: 'KuCoin Token', GT: 'Gate Token',
    MX: 'MX Token', FTT: 'FTX Token',
    DOGE: 'Dogecoin', SHIB: 'Shiba Inu', PEPE: 'PEPE', FLOKI: 'FLOKI',
    BONK: 'Bonk', WIF: 'dogwifhat', MEME: 'Memecoin', NEIRO: 'Neiro',
    MOG: 'Mog Coin',
    AXS: 'Axie Infinity', SAND: 'The Sandbox', MANA: 'Decentraland',
    ENJ: 'Enjin Coin', GALA: 'Gala', SUPER: 'SuperVerse', MAGIC: 'MAGIC',
    BEAM: 'Beam', RON: 'Ronin',
    FET: 'Fetch.ai', AGIX: 'SingularityNET', OCEAN: 'Ocean Protocol',
    RNDR: 'Render', TAO: 'Bittensor', WLD: 'Worldcoin', AKT: 'Akash Network',
    NMR: 'Numeraire', GRT: 'The Graph', API3: 'API3',
    LINK: 'Chainlink', BAND: 'Band Protocol', UMA: 'UMA', TRB: 'Tellor',
    DIA: 'DIA',
    XMR: 'Monero', ZEC: 'Zcash', DASH: 'Dash', SCRT: 'Secret', ROSE: 'Oasis Network',
    ONDO: 'Ondo Finance', CFG: 'Centrifuge', MPL: 'Maple', POLYX: 'Polymesh', RIO: 'Realio',
    SEI: 'Sei', TIA: 'Celestia', PYTH: 'Pyth Network', JUP: 'Jupiter',
    W: 'Wormhole', ENA: 'Ethena', ETHFI: 'Ether.fi', REZ: 'Renzo',
    BB: 'BounceBit', OMNI: 'Omni Network', SAGA: 'Saga', ALT: 'AltLayer',
    PIXEL: 'Pixels', PORTAL: 'Portal',
    DYDX: 'dYdX', FIL: 'Filecoin', ICP: 'Internet Computer', ALGO: 'Algorand',
    VET: 'VeChain', HBAR: 'Hedera', EOS: 'EOS', XLM: 'Stellar',
    THETA: 'Theta Network', EGLD: 'MultiversX', FTM: 'Fantom', KAVA: 'Kava',
    INJ: 'Injective', STX: 'Stacks', RUNE: 'THORChain', ASTR: 'Astar',
    CKB: 'Nervos', FLOW: 'Flow', CELO: 'Celo', ONE: 'Harmony',
    BLUR: 'Blur', MASK: 'Mask Network',
    GMT: 'STEPN', APE: 'ApeCoin', CHZ: 'Chiliz', LOOM: 'Loom Network',
    YFI: 'yearn.finance', CAKE: 'PancakeSwap',
};

// Mapa de categorias para moedas conhecidas
const ASSET_CATEGORIES: Record<string, AssetCategory> = {
    // Layer 1
    BTC: 'layer1', ETH: 'layer1', BNB: 'layer1', SOL: 'layer1', ADA: 'layer1',
    AVAX: 'layer1', DOT: 'layer1', ATOM: 'layer1', NEAR: 'layer1', APT: 'layer1',
    SUI: 'layer1', TON: 'layer1', TRX: 'layer1', XRP: 'layer1', LTC: 'layer1',
    BCH: 'layer1', FIL: 'layer1', ICP: 'layer1', ALGO: 'layer1', VET: 'layer1',
    HBAR: 'layer1', EOS: 'layer1', XLM: 'layer1', THETA: 'layer1', EGLD: 'layer1',
    FTM: 'layer1', KAVA: 'layer1', INJ: 'layer1', SEI: 'layer1', TIA: 'layer1',
    STX: 'layer1', ASTR: 'layer1', CKB: 'layer1', FLOW: 'layer1', CELO: 'layer1',
    ONE: 'layer1',
    // Layer 2
    MATIC: 'layer2', ARB: 'layer2', OP: 'layer2', IMX: 'layer2', STRK: 'layer2',
    MANTA: 'layer2', SCROLL: 'layer2', ZK: 'layer2', BLAST: 'layer2',
    // DeFi
    UNI: 'defi', AAVE: 'defi', CRV: 'defi', MKR: 'defi', SNX: 'defi',
    COMP: 'defi', BAL: 'defi', SUSHI: 'defi', '1INCH': 'defi', LDO: 'defi',
    RPL: 'defi', FXS: 'defi', PENDLE: 'defi', JTO: 'defi', DYDX: 'defi',
    RUNE: 'defi', YFI: 'defi', CAKE: 'defi', JUP: 'defi', ENA: 'defi',
    ETHFI: 'defi', PYTH: 'defi',
    // Exchange
    OKB: 'exchange', CRO: 'exchange', KCS: 'exchange', GT: 'exchange',
    MX: 'exchange', FTT: 'exchange',
    // Meme
    DOGE: 'meme', SHIB: 'meme', PEPE: 'meme', FLOKI: 'meme', BONK: 'meme',
    WIF: 'meme', MEME: 'meme', NEIRO: 'meme', MOG: 'meme',
    // Gaming
    AXS: 'gaming', SAND: 'gaming', MANA: 'gaming', ENJ: 'gaming', GALA: 'gaming',
    SUPER: 'gaming', MAGIC: 'gaming', BEAM: 'gaming', RON: 'gaming',
    GMT: 'gaming', APE: 'gaming', PIXEL: 'gaming',
    // AI
    FET: 'ai', AGIX: 'ai', OCEAN: 'ai', RNDR: 'ai', TAO: 'ai', WLD: 'ai',
    AKT: 'ai', NMR: 'ai', GRT: 'ai', API3: 'ai',
    // Infra / Oracles
    LINK: 'infra', BAND: 'infra', UMA: 'infra', TRB: 'infra', DIA: 'infra',
    // Privacy
    XMR: 'privacy', ZEC: 'privacy', DASH: 'privacy', SCRT: 'privacy', ROSE: 'privacy',
    // RWA
    ONDO: 'rwa', CFG: 'rwa', MPL: 'rwa', POLYX: 'rwa', RIO: 'rwa',
    // Trending
    W: 'trending', REZ: 'trending', BB: 'trending', OMNI: 'trending', SAGA: 'trending',
    ALT: 'trending', PORTAL: 'trending', BLUR: 'trending', MASK: 'trending',
    CHZ: 'trending', LOOM: 'trending',
};

// Favoritas padrão
const DEFAULT_FAVORITES = new Set([
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
]);

// ──────────── Fetch Helpers ────────────

const fetchBinance = async <T>(endpoint: string, params: Record<string, string> = {}): Promise<T> => {
    const searchParams = new URLSearchParams(params);
    const url = `${BINANCE_FUTURES_API}${endpoint}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
    }
    return response.json();
};

// ──────────── Exchange Info ────────────

/**
 * Busca todos os pares USDT perpétuos disponíveis na Binance Futures.
 * Resultado é cacheado por 5 minutos.
 */
const fetchExchangeSymbols = async (): Promise<BinanceExchangeSymbol[]> => {
    const now = Date.now();

    if (exchangeInfoCache && (now - exchangeInfoCache.timestamp) < CACHE_TTL) {
        return exchangeInfoCache.data;
    }

    const info = await fetchBinance<BinanceExchangeInfo>('/fapi/v1/exchangeInfo');

    // Filtrar apenas pares USDT perpétuos com status TRADING
    const usdtPerpetuals = info.symbols.filter(
        (s) =>
            s.contractType === 'PERPETUAL' &&
            s.quoteAsset === 'USDT' &&
            s.status === 'TRADING'
    );

    exchangeInfoCache = { data: usdtPerpetuals, timestamp: now };

    // Atualiza set de símbolos disponíveis
    futuresSymbolsSet = new Set(usdtPerpetuals.map((s) => s.symbol));

    return usdtPerpetuals;
};

// ──────────── Ticker 24hr ────────────

/**
 * Busca ticker 24hr de todos os pares de futuros de uma vez.
 */
const fetchAllTickers = async (): Promise<Map<string, BinanceTicker24hr>> => {
    const now = Date.now();

    // Cache de 30 segundos para tickers (são mais voláteis)
    if (tickerCache && (now - tickerCache.timestamp) < 30_000) {
        return tickerCache.data;
    }

    const tickers = await fetchBinance<BinanceTicker24hr[]>('/fapi/v1/ticker/24hr');

    const tickerMap = new Map<string, BinanceTicker24hr>();
    tickers.forEach((t) => tickerMap.set(t.symbol, t));

    tickerCache = { data: tickerMap, timestamp: now };
    return tickerMap;
};

// ──────────── Helpers ────────────

const getBaseAsset = (symbol: string): string => {
    return symbol.replace(/USDT$/, '');
};

const getAssetName = (baseAsset: string): string => {
    return ASSET_NAMES[baseAsset] || baseAsset;
};

const getAssetCategory = (baseAsset: string): AssetCategory => {
    return ASSET_CATEGORIES[baseAsset] || 'other';
};

const getMinNotional = (filters: BinanceExchangeSymbol['filters']): number => {
    const notionalFilter = filters.find(
        (f) => f.filterType === 'MIN_NOTIONAL'
    );
    return parseFloat(notionalFilter?.notional || notionalFilter?.minNotional || '5');
};

// ──────────── API Pública ────────────

/**
 * Busca todos os pares USDT perpétuos da Binance Futures com preços atualizados.
 * Retorna um array de CryptoPair completo, ordenado por volume 24h.
 */
export const fetchAllFuturesPairs = async (): Promise<CryptoPair[]> => {
    const [symbols, tickers] = await Promise.all([
        fetchExchangeSymbols(),
        fetchAllTickers(),
    ]);

    const pairs: CryptoPair[] = symbols
        .map((sym): CryptoPair | null => {
            const ticker = tickers.get(sym.symbol);
            if (!ticker) return null;

            const price = parseFloat(ticker.lastPrice);
            if (price <= 0) return null;

            const baseAsset = getBaseAsset(sym.symbol);

            return {
                symbol: sym.symbol,
                name: getAssetName(baseAsset),
                price,
                change24h: parseFloat(ticker.priceChangePercent),
                volume24h: parseFloat(ticker.quoteVolume),
                high24h: parseFloat(ticker.highPrice),
                low24h: parseFloat(ticker.lowPrice),
                isFavorite: DEFAULT_FAVORITES.has(sym.symbol),
                category: getAssetCategory(baseAsset),
                pricePrecision: sym.pricePrecision,
                quantityPrecision: sym.quantityPrecision,
                minNotional: getMinNotional(sym.filters),
                hasFutures: true,
            };
        })
        .filter((p): p is CryptoPair => p !== null)
        // Ordenar por volume 24h (maior primeiro)
        .sort((a, b) => b.volume24h - a.volume24h);

    return pairs;
};

// ──────────── Filtragem ────────────

export interface FilterOptions {
    category?: AssetCategory;
    minVolume24h?: number;
    futuresOnly?: boolean;
    search?: string;
}

/**
 * Filtra um array de CryptoPair com base nos critérios fornecidos.
 */
export const filterPairs = (
    pairs: CryptoPair[],
    options: FilterOptions
): CryptoPair[] => {
    let filtered = [...pairs];

    if (options.category) {
        filtered = filtered.filter((p) => p.category === options.category);
    }

    if (options.minVolume24h && options.minVolume24h > 0) {
        filtered = filtered.filter((p) => p.volume24h >= options.minVolume24h!);
    }

    if (options.futuresOnly) {
        filtered = filtered.filter((p) => p.hasFutures);
    }

    if (options.search) {
        const query = options.search.toLowerCase();
        filtered = filtered.filter(
            (p) =>
                p.symbol.toLowerCase().includes(query) ||
                p.name.toLowerCase().includes(query)
        );
    }

    return filtered;
};

/**
 * Retorna todas as categorias disponíveis com contagem de ativos.
 */
export const getCategoryStats = (
    pairs: CryptoPair[]
): Array<{ category: AssetCategory; label: string; count: number }> => {
    const CATEGORY_LABELS: Record<AssetCategory, string> = {
        layer1: 'Layer 1',
        layer2: 'Layer 2',
        defi: 'DeFi',
        exchange: 'Exchange',
        meme: 'Memecoins',
        gaming: 'Gaming',
        ai: 'AI & Tech',
        infra: 'Infra',
        privacy: 'Privacy',
        rwa: 'RWA',
        trending: 'Trending',
        other: 'Outros',
    };

    const counts = new Map<AssetCategory, number>();
    pairs.forEach((p) => {
        const cat = p.category || 'other';
        counts.set(cat, (counts.get(cat) || 0) + 1);
    });

    return Array.from(counts.entries())
        .map(([category, count]) => ({
            category,
            label: CATEGORY_LABELS[category],
            count,
        }))
        .sort((a, b) => b.count - a.count);
};

/**
 * Verifica se um símbolo tem contrato de futuros perpétuo disponível.
 * Usa cache interno para verificação rápida.
 */
export const isFuturesSymbolAvailable = (symbol: string): boolean => {
    return futuresSymbolsSet.has(symbol);
};

/**
 * Força atualização do cache (ex: chamado pelo usuário no UI).
 */
export const invalidateAssetCache = (): void => {
    exchangeInfoCache = null;
    tickerCache = null;
};
