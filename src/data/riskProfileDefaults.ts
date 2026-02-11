import { RiskProfileType, RiskProfile, RiskProfiles } from '@/types/riskProfiles';

export const RISK_PROFILES: RiskProfiles = {
    conservative: {
        id: 'conservative',
        name: 'Conservador',
        description: 'Foco em preservação de capital. Ideal para BTC, ETH e Large Caps consolidadas.',
        maxLeverage: 10,
        stopLoss: { min: 1.5, max: 2.5 },
        takeProfit: { tp1: 2.0, tp2: 4.0, tp3: 7.0 },
        maxRiskPerTrade: 2.0, // 2%
        maxPositionSize: 20.0, // 20%
        allowedCategories: ['layer1', 'infra']
    },
    moderate: {
        id: 'moderate',
        name: 'Moderado',
        description: 'Equilíbrio entre risco e retorno. Para Mid Caps e protocolos DeFi estabelecidos.',
        maxLeverage: 7,
        stopLoss: { min: 2.5, max: 4.0 },
        takeProfit: { tp1: 3.0, tp2: 6.0, tp3: 10.0 },
        maxRiskPerTrade: 1.5, // 1.5%
        maxPositionSize: 15.0, // 15%
        allowedCategories: ['layer1', 'layer2', 'defi', 'infra', 'exchange']
    },
    aggressive: {
        id: 'aggressive',
        name: 'Agressivo',
        description: 'Alta volatilidade e potencial de retorno. Small Caps, AI, Gaming e novas listagens.',
        maxLeverage: 5,
        stopLoss: { min: 4.0, max: 7.0 },
        takeProfit: { tp1: 5.0, tp2: 10.0, tp3: 20.0 },
        maxRiskPerTrade: 1.0, // 1%
        maxPositionSize: 10.0, // 10%
        allowedCategories: ['ai', 'gaming', 'meme', 'layer2', 'defi', 'rwa']
    },
    speculative: {
        id: 'speculative',
        name: 'Especulativo',
        description: 'Altíssimo risco. Memecoins voláteis e micro caps. Gestão rigorosa de risco.',
        maxLeverage: 3,
        stopLoss: { min: 7.0, max: 12.0 },
        takeProfit: { tp1: 8.0, tp2: 15.0, tp3: 30.0 },
        maxRiskPerTrade: 0.5, // 0.5%
        maxPositionSize: 5.0, // 5%
        allowedCategories: ['meme', 'other']
    }
};

// Mapeamento padrão de Símbolo -> Perfil de Risco
// Usado quando não há configuração individual específica salva
export const RISK_PROFILE_MAP: Record<string, RiskProfileType> = {
    // Conservative (Large Caps)
    BTC: 'conservative',
    ETH: 'conservative',
    BNB: 'conservative',
    SOL: 'conservative',
    XRP: 'conservative',
    ADA: 'conservative',
    AVAX: 'conservative',
    DOT: 'conservative',
    TRX: 'conservative',
    LTC: 'conservative',
    BCH: 'conservative',
    LINK: 'conservative', // Movido para cons/mod

    // Moderate (DeFi, L2, Mid Caps)
    UNI: 'moderate',
    MATIC: 'moderate',
    NEAR: 'moderate',
    ATOM: 'moderate',
    ARB: 'moderate',
    OP: 'moderate',
    LDO: 'moderate',
    APT: 'moderate',
    SUI: 'moderate',
    FIL: 'moderate',
    ICP: 'moderate',
    IMX: 'moderate',
    RUNE: 'moderate',
    MKR: 'moderate',
    AAVE: 'moderate',
    SNX: 'moderate',
    STRK: 'moderate',
    STX: 'moderate',
    INJ: 'moderate',
    QNT: 'moderate',

    // Aggressive (AI, Gaming, Trending)
    FET: 'aggressive',
    RNDR: 'aggressive',
    TAO: 'aggressive',
    WLD: 'aggressive',
    AGIX: 'aggressive',
    GRT: 'aggressive',
    GALA: 'aggressive',
    SAND: 'aggressive',
    MANA: 'aggressive',
    AXS: 'aggressive',
    BEAM: 'aggressive',
    SEI: 'aggressive',
    TIA: 'aggressive',
    PYTH: 'aggressive',
    JUP: 'aggressive',
    ENA: 'aggressive',
    PENDLE: 'aggressive',
    ORDI: 'aggressive',
    SATS: 'aggressive',

    // Speculative / Permissive Aggressive (Memes)
    // Alguns memes maiores podem ser agressivos, outros especulativos
    DOGE: 'aggressive',
    SHIB: 'speculative',
    PEPE: 'aggressive', // Com override de leverage
    WIF: 'aggressive',
    BONK: 'aggressive',
    FLOKI: 'speculative',
    MEME: 'speculative',
    BOME: 'speculative',
    NEIRO: 'speculative',
    MOG: 'speculative',
    POPCAT: 'speculative',
    MYRO: 'speculative',
    TURBO: 'speculative',
    PEOPLE: 'speculative',
};

export const getRiskProfileForSymbol = (symbol: string): RiskProfileType => {
    // Remove USDT/BUSD suffix to find base asset
    const baseAsset = symbol.replace(/(USDT|BUSD|USDC)$/, '');

    return RISK_PROFILE_MAP[baseAsset] || 'moderate'; // Default fallback
};
