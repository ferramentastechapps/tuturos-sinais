// Asset Risk Configs — Configurações individuais por moeda
// Gera configs completas baseadas no perfil de risco do ativo e overrides individuais

import { AssetRiskConfig, RiskProfileType } from '@/types/riskProfiles';
import { AssetCategory } from '@/types/trading';
import { RISK_PROFILES, getRiskProfileForSymbol } from './riskProfileDefaults';

// ──────────── Overrides Individuais ────────────

// Ajustes específicos para moedas que fogem do padrão de sua categoria
const INDIVIDUAL_OVERRIDES: Record<string, Partial<AssetRiskConfig>> = {
    // Bitcoin: Pode ter alavancagem um pouco maior que o padrão conservador devido à liquidez
    BTCUSDT: {
        leverage: { min: 1, max: 20, suggested: 10, autoAdjust: true },
        stopLoss: { min: 1.0, max: 2.0, atrMultiplier: 1.5, useTrailingStop: true, trailingDistance: 1.0 }
    },
    // Ethereum: Similar ao BTC
    ETHUSDT: {
        leverage: { min: 1, max: 15, suggested: 8, autoAdjust: true }
    },
    // Solana: Alta volatilidade para uma Large Cap
    SOLUSDT: {
        stopLoss: { min: 2.0, max: 3.5, atrMultiplier: 2.0, useTrailingStop: true, trailingDistance: 1.5 }
    },
    // Pepe: Meme muito volátil, requer stops mais largos que o padrão agressivo
    PEPEUSDT: {
        leverage: { min: 1, max: 3, suggested: 2, autoAdjust: true },
        stopLoss: { min: 8.0, max: 15.0, atrMultiplier: 3.0, useTrailingStop: true, trailingDistance: 5.0 }
    },
    // Wif: Meme agressivo
    WIFUSDT: {
        stopLoss: { min: 6.0, max: 12.0, atrMultiplier: 2.5, useTrailingStop: true, trailingDistance: 4.0 }
    },
    // Shiba: Meme consolidado, pode ter leverage um pouco melhor que lixo
    SHIBUSDT: {
        leverage: { min: 1, max: 5, suggested: 3, autoAdjust: true }
    },
    // Doge: Pai dos memes, volatilidade moderada-alta
    DOGEUSDT: {
        riskProfile: 'aggressive', // Override de perfil se necessário
        leverage: { min: 1, max: 7, suggested: 4, autoAdjust: true }
    }
};

// ──────────── Gerador de Config a partir do Perfil ────────────

interface AssetMeta {
    symbol: string;
    name: string;
    category: AssetCategory;
    profileOverride?: RiskProfileType;
}

/**
 * Gera uma AssetRiskConfig completa a partir dos dados do ativo e seu perfil de risco.
 */
export const generateAssetRiskConfig = (
    meta: AssetMeta,
    profileOverride?: RiskProfileType
): AssetRiskConfig => {
    const profileType = profileOverride || meta.profileOverride || getRiskProfileForSymbol(meta.symbol);
    const profile = RISK_PROFILES[profileType];

    // Parâmetros de leverage por perfil
    const leverageMap: Record<RiskProfileType, { min: number; max: number; suggested: number }> = {
        conservative: { min: 1, max: 10, suggested: 5 },
        moderate: { min: 1, max: 7, suggested: 4 },
        aggressive: { min: 1, max: 5, suggested: 3 },
        speculative: { min: 1, max: 3, suggested: 2 },
    };

    // ATR multiplier e trailing por perfil
    const atrMap: Record<RiskProfileType, { atrMultiplier: number; trailingDistance: number }> = {
        conservative: { atrMultiplier: 1.5, trailingDistance: 1.0 },
        moderate: { atrMultiplier: 1.8, trailingDistance: 1.5 },
        aggressive: { atrMultiplier: 2.0, trailingDistance: 2.5 },
        speculative: { atrMultiplier: 2.5, trailingDistance: 4.0 },
    };

    // Close percentages por perfil (como fechar nos TPs)
    const closeMap: Record<RiskProfileType, { tp1: number; tp2: number; tp3: number }> = {
        conservative: { tp1: 35, tp2: 35, tp3: 30 },
        moderate: { tp1: 30, tp2: 35, tp3: 35 },
        aggressive: { tp1: 30, tp2: 30, tp3: 40 },
        speculative: { tp1: 40, tp2: 30, tp3: 30 },
    };

    // Volume mínimo por perfil (USD)
    const volumeMap: Record<RiskProfileType, number> = {
        conservative: 500_000_000,
        moderate: 100_000_000,
        aggressive: 20_000_000,
        speculative: 5_000_000,
    };

    const lev = leverageMap[profileType];
    const atr = atrMap[profileType];
    const close = closeMap[profileType];

    const baseConfig: AssetRiskConfig = {
        symbol: meta.symbol.toUpperCase(),
        name: meta.name,
        category: meta.category,
        riskProfile: profileType,
        enabled: true,

        leverage: {
            min: lev.min,
            max: lev.max,
            suggested: lev.suggested,
            autoAdjust: true,
        },

        stopLoss: {
            min: profile.stopLoss.min,
            max: profile.stopLoss.max,
            atrMultiplier: atr.atrMultiplier,
            useTrailingStop: true,
            trailingDistance: atr.trailingDistance,
        },

        takeProfit: {
            tp1: { percent: profile.takeProfit.tp1, closePercent: close.tp1 },
            tp2: { percent: profile.takeProfit.tp2, closePercent: close.tp2 },
            tp3: { percent: profile.takeProfit.tp3, closePercent: close.tp3 },
            useFibonacci: true,
        },

        position: {
            maxRiskPercent: profile.maxRiskPerTrade,
            maxPositionPercent: profile.maxPositionSize,
            minRiskReward: 2.0, // Default min RR
        },

        filters: {
            minVolume24h: volumeMap[profileType],
            minLiquidity: profileType === 'conservative' ? 'high' : profileType === 'moderate' ? 'medium' : 'low',
            avoidHighFunding: true,
            maxFundingRate: 0.1,
            tradingHours: 'all',
        },
    };

    // Aplicar Overrides Individuais
    const override = INDIVIDUAL_OVERRIDES[meta.symbol.toUpperCase()];
    if (override) {
        if (override.leverage) baseConfig.leverage = { ...baseConfig.leverage, ...override.leverage };
        if (override.stopLoss) baseConfig.stopLoss = { ...baseConfig.stopLoss, ...override.stopLoss };
        if (override.takeProfit) baseConfig.takeProfit = { ...baseConfig.takeProfit, ...override.takeProfit };
        if (override.position) baseConfig.position = { ...baseConfig.position, ...override.position };
        if (override.filters) baseConfig.filters = { ...baseConfig.filters, ...override.filters };
        if (override.riskProfile) baseConfig.riskProfile = override.riskProfile;
    }

    return baseConfig;
};

// ──────────── Configs pré-geradas para moedas conhecidas ────────────

const KNOWN_ASSETS: AssetMeta[] = [
    // ── Layer 1 (Conservative/Moderate) ──
    { symbol: 'BTCUSDT', name: 'Bitcoin', category: 'layer1' },
    { symbol: 'ETHUSDT', name: 'Ethereum', category: 'layer1' },
    { symbol: 'BNBUSDT', name: 'BNB', category: 'layer1' },
    { symbol: 'SOLUSDT', name: 'Solana', category: 'layer1' },
    { symbol: 'ADAUSDT', name: 'Cardano', category: 'layer1' },
    { symbol: 'AVAXUSDT', name: 'Avalanche', category: 'layer1' },
    { symbol: 'DOTUSDT', name: 'Polkadot', category: 'layer1' },
    { symbol: 'XRPUSDT', name: 'XRP', category: 'layer1' },
    { symbol: 'TRXUSDT', name: 'Tron', category: 'layer1' },
    { symbol: 'ATOMUSDT', name: 'Cosmos', category: 'layer1' },
    { symbol: 'NEARUSDT', name: 'NEAR', category: 'layer1' },
    { symbol: 'APTUSDT', name: 'Aptos', category: 'layer1' },
    { symbol: 'SUIUSDT', name: 'Sui', category: 'layer1' },
    { symbol: 'SEIUSDT', name: 'Sei', category: 'layer1' },
    { symbol: 'TIAUSDT', name: 'Celestia', category: 'layer1' },
    { symbol: 'INJUSDT', name: 'Injective', category: 'layer1' },
    { symbol: 'KASUSDT', name: 'Kaspa', category: 'layer1' },
    { symbol: 'FTMUSDT', name: 'Fantom', category: 'layer1' },
    { symbol: 'HBARUSDT', name: 'Hedera', category: 'layer1' },
    { symbol: 'ALGOUSDT', name: 'Algorand', category: 'layer1' },
    { symbol: 'EGLDUSDT', name: 'MultiversX', category: 'layer1' },
    { symbol: 'FLOWUSDT', name: 'Flow', category: 'layer1' },
    { symbol: 'ICPUSDT', name: 'Internet Computer', category: 'layer1' },
    { symbol: 'LTCUSDT', name: 'Litecoin', category: 'layer1' },
    { symbol: 'BCHUSDT', name: 'Bitcoin Cash', category: 'layer1' },
    { symbol: 'ETCUSDT', name: 'Ethereum Classic', category: 'layer1' },
    { symbol: 'XLMUSDT', name: 'Stellar', category: 'layer1' },

    // ── Layer 2 (Moderate/Aggressive) ──
    { symbol: 'MATICUSDT', name: 'Polygon', category: 'layer2' },
    { symbol: 'ARBUSDT', name: 'Arbitrum', category: 'layer2' },
    { symbol: 'OPUSDT', name: 'Optimism', category: 'layer2' },
    { symbol: 'IMXUSDT', name: 'Immutable', category: 'layer2' },
    { symbol: 'MNTUSDT', name: 'Mantle', category: 'layer2' },
    { symbol: 'STXUSDT', name: 'Stacks', category: 'layer2' },
    { symbol: 'STRKUSDT', name: 'Starknet', category: 'layer2' },
    { symbol: 'BLASTUSDT', name: 'Blast', category: 'layer2' },
    { symbol: 'ZKUSDT', name: 'ZKsync', category: 'layer2' },
    { symbol: 'MANTAUSDT', name: 'Manta Network', category: 'layer2' },
    { symbol: 'METISUSDT', name: 'Metis', category: 'layer2' },

    // ── DeFi (Moderate/Aggressive) ──
    { symbol: 'UNIUSDT', name: 'Uniswap', category: 'defi' },
    { symbol: 'AAVEUSDT', name: 'Aave', category: 'defi' },
    { symbol: 'LINKUSDT', name: 'Chainlink', category: 'infra' }, // Infra/DeFi
    { symbol: 'LDOUSDT', name: 'Lido', category: 'defi' },
    { symbol: 'MKRUSDT', name: 'Maker', category: 'defi' },
    { symbol: 'RUNEUSDT', name: 'THORChain', category: 'defi' },
    { symbol: 'SNXUSDT', name: 'Synthetix', category: 'defi' },
    { symbol: 'CRVUSDT', name: 'Curve', category: 'defi' },
    { symbol: 'DYDXUSDT', name: 'dYdX', category: 'defi' },
    { symbol: 'JUPUSDT', name: 'Jupiter', category: 'defi' },
    { symbol: 'PYTHUSDT', name: 'Pyth', category: 'defi' },
    { symbol: 'ENAUSDT', name: 'Ethena', category: 'defi' },
    { symbol: 'PENDLEUSDT', name: 'Pendle', category: 'defi' },
    { symbol: 'GMXUSDT', name: 'GMX', category: 'defi' },
    { symbol: 'COMPUSDT', name: 'Compound', category: 'defi' },
    { symbol: '1INCHUSDT', name: '1inch', category: 'defi' },
    { symbol: 'CAKEUSDT', name: 'PancakeSwap', category: 'defi' },
    { symbol: 'WUSDT', name: 'Wormhole', category: 'defi' },
    { symbol: 'JTOUSDT', name: 'Jito', category: 'defi' },
    { symbol: 'RAYUSDT', name: 'Raydium', category: 'defi' },

    // ── AI (Aggressive) ──
    { symbol: 'FETUSDT', name: 'Fetch.ai', category: 'ai' },
    { symbol: 'RNDRUSDT', name: 'Render', category: 'ai' },
    { symbol: 'TAOUSDT', name: 'Bittensor', category: 'ai' },
    { symbol: 'WLDUSDT', name: 'Worldcoin', category: 'ai' },
    { symbol: 'AGIXUSDT', name: 'SingularityNET', category: 'ai' }, // Note: Merging to ASI, keep valid for now
    { symbol: 'OCEANUSDT', name: 'Ocean Protocol', category: 'ai' },
    { symbol: 'AKTUSDT', name: 'Akash', category: 'ai' },
    { symbol: 'NEARUSDT', name: 'NEAR (AI)', category: 'ai' }, // Multi-cat
    { symbol: 'ARKMUSDT', name: 'Arkham', category: 'ai' },
    { symbol: 'PHBUSDT', name: 'Phoenix', category: 'ai' },
    { symbol: 'AIUSDT', name: 'Sleepless AI', category: 'ai' },
    { symbol: 'NFPUSDT', name: 'NFPrompt', category: 'ai' },

    // ── Memecoins (Speculative/Aggressive) ──
    { symbol: 'DOGEUSDT', name: 'Dogecoin', category: 'meme' },
    { symbol: 'SHIBUSDT', name: 'Shiba Inu', category: 'meme' },
    { symbol: 'PEPEUSDT', name: 'Pepe', category: 'meme' },
    { symbol: 'WIFUSDT', name: 'dogwifhat', category: 'meme' },
    { symbol: 'BONKUSDT', name: 'Bonk', category: 'meme' },
    { symbol: 'FLOKIUSDT', name: 'Floki', category: 'meme' },
    { symbol: 'BOMEUSDT', name: 'Book of Meme', category: 'meme' },
    { symbol: 'MEMEUSDT', name: 'Memecoin', category: 'meme' },
    { symbol: 'MOGUSDT', name: 'Mog Coin', category: 'meme' },
    { symbol: 'NEIROUSDT', name: 'Neiro', category: 'meme' },
    { symbol: 'POPCATUSDT', name: 'Popcat', category: 'meme' },
    { symbol: 'MYROUSDT', name: 'Myro', category: 'meme' },
    { symbol: 'BRETTUSDT', name: 'Brett', category: 'meme' },
    { symbol: 'PEOPLEUSDT', name: 'ConstitutionDAO', category: 'meme' },
    { symbol: 'TURBOUSDT', name: 'Turbo', category: 'meme' },
    { symbol: '1000SATSUSDT', name: 'SATS', category: 'meme' },
    { symbol: 'ORDIUSDT', name: 'Ordinals', category: 'meme' }, // BRC-20 essentially meme/tech

    // ── Gaming / Metaverse (Aggressive) ──
    { symbol: 'GALAUSDT', name: 'Gala', category: 'gaming' },
    { symbol: 'SANDUSDT', name: 'The Sandbox', category: 'gaming' },
    { symbol: 'MANAUSDT', name: 'Decentraland', category: 'gaming' },
    { symbol: 'AXSUSDT', name: 'Axie Infinity', category: 'gaming' },
    { symbol: 'APEUSDT', name: 'ApeCoin', category: 'gaming' },
    { symbol: 'BEAMUSDT', name: 'Beam', category: 'gaming' },
    { symbol: 'PIXELUSDT', name: 'Pixels', category: 'gaming' },
    { symbol: 'PORTALUSDT', name: 'Portal', category: 'gaming' },
    { symbol: 'XAIUSDT', name: 'Xai', category: 'gaming' },
    { symbol: 'RONUSDT', name: 'Ronin', category: 'gaming' },
    { symbol: 'ILVUSDT', name: 'Illuvium', category: 'gaming' },
    { symbol: 'YGGUSDT', name: 'Yield Guild Games', category: 'gaming' },
    { symbol: 'ENJUSDT', name: 'Enjin', category: 'gaming' },

    // ── RWA / Infra / Others ──
    { symbol: 'ONDOUSDT', name: 'Ondo', category: 'rwa' },
    { symbol: 'OMUSDT', name: 'Mantra', category: 'rwa' },
    { symbol: 'PENDLEUSDT', name: 'Pendle (RWA)', category: 'rwa' },
    { symbol: 'CFGUSDT', name: 'Centrifuge', category: 'rwa' },
    { symbol: 'TRBUSDT', name: 'Tellor', category: 'infra' }, // High vol override needed?
    { symbol: 'UMAUSDT', name: 'UMA', category: 'infra' },
    { symbol: 'API3USDT', name: 'API3', category: 'infra' },
    { symbol: 'TIAUSDT', name: 'Celestia (DA)', category: 'infra' },
    { symbol: 'GRTUSDT', name: 'The Graph', category: 'infra' },
    { symbol: 'WLDUSDT', name: 'Worldcoin', category: 'privacy' },
];

/**
 * Retorna todas as configs individuais pré-geradas.
 */
export const getDefaultAssetRiskConfigs = (): AssetRiskConfig[] => {
    return KNOWN_ASSETS.map(asset => generateAssetRiskConfig(asset));
};

/**
 * Retorna um mapa de configs indexado por symbol para acesso rápido.
 */
export const getDefaultAssetRiskConfigMap = (): Map<string, AssetRiskConfig> => {
    const map = new Map<string, AssetRiskConfig>();
    getDefaultAssetRiskConfigs().forEach(config => {
        map.set(config.symbol, config);
    });
    return map;
};
