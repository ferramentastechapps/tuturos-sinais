// ═══════════════════════════════════════════════════════════
// Strategy Registry — Mapa central de estratégias disponíveis
// Adicione novas estratégias aqui sem alterar o engine
// ═══════════════════════════════════════════════════════════

import { IStrategy } from './types.js';
import { EmaCrossVolumeStrategy } from './emaCrossVolume.js';
import { RsiDivergenceStrategy } from './rsiDivergence.js';
import { BollingerSqueezeStrategy } from './bollingerSqueeze.js';
import { VwapReversionStrategy } from './vwapReversion.js';
import { ScalpingBotStrategy } from './scalpingBot.js';
import { MacdCrossStrategy } from './macdCross.js';
import { AdxTrendFollowStrategy } from './adxTrendFollow.js';
import { OrderBlockIctStrategy } from './orderBlockIct.js';
import { GoldenDeathCrossStrategy } from './goldenDeathCross.js';

const REGISTRY: Map<string, IStrategy> = new Map<string, IStrategy>([
    ['EMA_CROSS_VOLUME',   new EmaCrossVolumeStrategy()   as IStrategy],
    ['RSI_DIVERGENCE',     new RsiDivergenceStrategy()    as IStrategy],
    ['BOLLINGER_SQUEEZE',  new BollingerSqueezeStrategy() as IStrategy],
    ['VWAP_REVERSION',     new VwapReversionStrategy()    as IStrategy],
    ['SCALPING_BOT',       new ScalpingBotStrategy()      as IStrategy],
    ['MACD_CROSS',         new MacdCrossStrategy()        as IStrategy],
    ['ADX_TREND_FOLLOW',   new AdxTrendFollowStrategy()   as IStrategy],
    ['ORDER_BLOCK_ICT',    new OrderBlockIctStrategy()    as IStrategy],
    ['GOLDEN_DEATH_CROSS', new GoldenDeathCrossStrategy() as IStrategy],
]);

/** Retorna a estratégia pelo nome (case-insensitive) ou null se não encontrada. */
export function getStrategy(name: string): IStrategy | null {
    return REGISTRY.get(name.toUpperCase()) ?? null;
}

/** Lista todas as estratégias registradas. */
export function listStrategies(): Array<{ name: string; description: string; timeframes: string[] }> {
    return Array.from(REGISTRY.values()).map(s => ({
        name: s.name,
        description: s.description,
        timeframes: s.recommendedTimeframes,
    }));
}
