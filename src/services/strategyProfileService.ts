// ═══════════════════════════════════════════════════════════
// Strategy Profile Service — CRUD, Presets, Export/Import
// ═══════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import {
  StrategyProfile,
  IndicatorsMap,
  IndicatorKey,
  getDefaultIndicatorsMap,
  computeProfileStats,
} from '@/types/strategyTypes';

const STORAGE_KEY = 'strategy_profiles';
const ACTIVE_PROFILE_KEY = 'strategy_active_profile_id';

// ──────────── Indicator sets for presets ────────────

const OFF = (weight: number = 0): { active: false; weight: number } => ({ active: false, weight });
const ON = (weight: number): { active: true; weight: number } => ({ active: true, weight });

const buildIndicators = (overrides: Partial<Record<IndicatorKey, { active: boolean; weight: number }>>): IndicatorsMap => {
  const base = getDefaultIndicatorsMap();
  // Turn all off first
  for (const key of Object.keys(base) as IndicatorKey[]) {
    base[key] = { active: false, weight: 0 };
  }
  // Apply overrides
  for (const [key, val] of Object.entries(overrides)) {
    base[key as IndicatorKey] = val;
  }
  return base;
};

// ──────────── Preset Profiles ────────────

const PRESET_PRICE_ACTION: StrategyProfile = computeProfileStats({
  id: 'preset_price_action',
  name: 'Price Action Puro',
  description: 'Baseia-se exclusivamente em estrutura de mercado, Smart Money e padrões de candle. Sem osciladores.',
  isPreset: true,
  isDefault: false,
  indicators: buildIndicators({
    marketStructure: ON(100),
    breakOfStructure: ON(90),
    changeOfCharacter: ON(95),
    orderBlocks: ON(90),
    fairValueGaps: ON(85),
    liquidityZones: ON(80),
    equalHighsLows: ON(70),
    imbalance: ON(65),
    engulfing: ON(60),
    pinBar: ON(55),
    morningEveningStar: ON(50),
    volumeAboveAvg: ON(60),
  }),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const PRESET_CLASSIC: StrategyProfile = computeProfileStats({
  id: 'preset_classic',
  name: 'Indicadores Clássicos',
  description: 'Combinação de osciladores e médias móveis clássicos. Ideal para mercados em tendência.',
  isPreset: true,
  isDefault: false,
  indicators: buildIndicators({
    rsi: ON(80),
    rsiDivergence: ON(90),
    macd: ON(85),
    macdCross: ON(80),
    bollingerBands: ON(75),
    bollingerSqueeze: ON(70),
    stochasticRsi: ON(65),
    adx: ON(65),
    atr: ON(55),
    ema50: ON(80),
    ema200: ON(85),
    goldenDeathCross: ON(85),
    priceVsEma200: ON(80),
    volumeAboveAvg: ON(70),
  }),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const PRESET_SMART_MONEY: StrategyProfile = computeProfileStats({
  id: 'preset_smart_money',
  name: 'Smart Money + Futuros',
  description: 'Smart Money Concepts combinados com dados exclusivos de futuros (OI, Funding, CVD).',
  isPreset: true,
  isDefault: true,
  indicators: buildIndicators({
    orderBlocks: ON(100),
    fairValueGaps: ON(95),
    liquidityZones: ON(85),
    equalHighsLows: ON(70),
    marketStructure: ON(90),
    breakOfStructure: ON(85),
    fundingRateExtreme: ON(90),
    fundingRateNeutral: ON(60),
    openInterestGrowing: ON(85),
    oiDivergence: ON(80),
    longShortRatioExtreme: ON(70),
    cvd: ON(80),
    cvdDivergence: ON(80),
    extremeLiquidations: ON(75),
  }),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const PRESET_SCALPING: StrategyProfile = computeProfileStats({
  id: 'preset_scalping',
  name: 'Scalping (TF curtos)',
  description: 'Otimizado para scalping em timeframes curtos (1m-15m). Foco em volume e momentum.',
  isPreset: true,
  isDefault: false,
  indicators: buildIndicators({
    cvd: ON(100),
    cvdDivergence: ON(90),
    vwap: ON(90),
    volumeAboveAvg: ON(85),
    bollingerSqueeze: ON(80),
    stochasticRsi: ON(75),
    orderBlocks: ON(70),
    fundingRateExtreme: ON(65),
    rsiDivergence: ON(65),
    supportZone: ON(70),
    resistanceZone: ON(70),
  }),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const PRESET_SWING: StrategyProfile = computeProfileStats({
  id: 'preset_swing',
  name: 'Swing Trading (TF longos)',
  description: 'Focado em swing trading e tendências de médio/longo prazo.',
  isPreset: true,
  isDefault: false,
  indicators: buildIndicators({
    marketStructure: ON(100),
    breakOfStructure: ON(90),
    changeOfCharacter: ON(88),
    ema200: ON(90),
    goldenDeathCross: ON(85),
    priceVsEma200: ON(85),
    rsi: ON(80),
    rsiDivergence: ON(80),
    fibonacciLevels: ON(75),
    adx: ON(70),
    volumeProfilePoc: ON(65),
    supportZone: ON(80),
    resistanceZone: ON(80),
    fearGreedIndex: ON(60),
  }),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const PRESET_FULL: StrategyProfile = computeProfileStats({
  id: 'preset_full',
  name: 'Completo (todos ativos)',
  description: 'Todos os indicadores ativos com pesos balanceados.',
  isPreset: true,
  isDefault: false,
  indicators: getDefaultIndicatorsMap(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const PRESET_PROFILES: StrategyProfile[] = [
  PRESET_SMART_MONEY,
  PRESET_PRICE_ACTION,
  PRESET_CLASSIC,
  PRESET_SCALPING,
  PRESET_SWING,
  PRESET_FULL,
];

// ──────────── LocalStorage Fallback ────────────

const readLocalProfiles = (): StrategyProfile[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeLocalProfiles = (profiles: StrategyProfile[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {/* ignore */}
};

// ──────────── Merge presets + user profiles ────────────

const mergeWithPresets = (userProfiles: StrategyProfile[]): StrategyProfile[] => {
  const hasDefault = userProfiles.some(p => p.isDefault) || PRESET_PROFILES.some(p => p.isDefault);
  const presets = PRESET_PROFILES.map(p => ({
    ...p,
    isDefault: hasDefault ? p.isDefault : p.id === 'preset_smart_money',
  }));
  return [...presets, ...userProfiles];
};

// ──────────── Supabase CRUD ────────────

const fromSupabaseRow = (row: Record<string, unknown>): StrategyProfile =>
  computeProfileStats({
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    isPreset: false,
    isDefault: (row.is_default as boolean) || false,
    indicators: (row.indicators as IndicatorsMap) || getDefaultIndicatorsMap(),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  });

export const loadUserProfiles = async (userId: string | null): Promise<StrategyProfile[]> => {
  if (!userId) {
    return mergeWithPresets(readLocalProfiles());
  }

  try {
    const { data, error } = await supabase
      .from('strategy_profiles' as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const userProfiles = ((data || []) as any[]).map(fromSupabaseRow);
    return mergeWithPresets(userProfiles);
  } catch (err) {
    console.warn('[StrategyProfileService] Supabase error, using localStorage:', err);
    return mergeWithPresets(readLocalProfiles());
  }
};

export const saveProfile = async (
  profile: StrategyProfile,
  userId: string | null
): Promise<StrategyProfile> => {
  const stats = computeProfileStats(profile);

  if (!userId) {
    const existing = readLocalProfiles();
    const idx = existing.findIndex(p => p.id === stats.id);
    if (idx >= 0) existing[idx] = stats;
    else existing.unshift(stats);
    writeLocalProfiles(existing);
    return stats;
  }

  try {
    const row = {
      id: stats.id.startsWith('preset_') ? undefined : stats.id,
      user_id: userId,
      name: stats.name,
      description: stats.description,
      is_preset: false,
      is_default: stats.isDefault,
      indicators: stats.indicators,
    };

    const { data, error } = await supabase
      .from('strategy_profiles' as any)
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return fromSupabaseRow(data as unknown as Record<string, unknown>);
  } catch (err) {
    console.warn('[StrategyProfileService] Save error:', err);
    return stats;
  }
};

export const deleteProfile = async (
  id: string,
  userId: string | null
): Promise<void> => {
  if (!userId) {
    const existing = readLocalProfiles().filter(p => p.id !== id);
    writeLocalProfiles(existing);
    return;
  }

  try {
    await supabase
      .from('strategy_profiles' as any)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[StrategyProfileService] Delete error:', err);
  }
};

export const setDefaultProfile = async (
  id: string,
  allProfiles: StrategyProfile[],
  userId: string | null
): Promise<StrategyProfile[]> => {
  const updated = allProfiles.map(p => ({
    ...p,
    isDefault: p.id === id,
  }));

  if (!userId) {
    const userProfiles = updated.filter(p => !p.isPreset);
    writeLocalProfiles(userProfiles);
    return updated;
  }

  try {
    // Clear all defaults for user first
    await supabase
      .from('strategy_profiles' as any)
      .update({ is_default: false })
      .eq('user_id', userId);

    // Set the new default if it's a user profile
    const target = updated.find(p => p.id === id && !p.isPreset);
    if (target) {
      await supabase
        .from('strategy_profiles' as any)
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', userId);
    }
  } catch (err) {
    console.warn('[StrategyProfileService] SetDefault error:', err);
  }

  return updated;
};

// ──────────── Active Profile Persistence ────────────

export const getStoredActiveProfileId = (): string =>
  localStorage.getItem(ACTIVE_PROFILE_KEY) || 'preset_smart_money';

export const storeActiveProfileId = (id: string): void => {
  localStorage.setItem(ACTIVE_PROFILE_KEY, id);
};

// ──────────── Export / Import ────────────

export const exportProfileAsJSON = (profile: StrategyProfile): string => {
  const exportable = {
    ...profile,
    isPreset: false,
    isDefault: false,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(exportable, null, 2);
};

export const importProfileFromJSON = (json: string): StrategyProfile => {
  const parsed = JSON.parse(json) as Partial<StrategyProfile>;

  if (!parsed.name || !parsed.indicators) {
    throw new Error('JSON inválido: faltam campos obrigatórios (name, indicators)');
  }

  return computeProfileStats({
    id: `custom_${Date.now()}`,
    name: parsed.name,
    description: parsed.description || '',
    isPreset: false,
    isDefault: false,
    indicators: parsed.indicators,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
};

// ──────────── Create blank profile ────────────

export const createBlankProfile = (name: string): StrategyProfile =>
  computeProfileStats({
    id: `custom_${Date.now()}`,
    name,
    description: '',
    isPreset: false,
    isDefault: false,
    indicators: getDefaultIndicatorsMap(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

export const duplicateProfile = (source: StrategyProfile, name?: string): StrategyProfile =>
  computeProfileStats({
    ...source,
    id: `custom_${Date.now()}`,
    name: name || `${source.name} (cópia)`,
    isPreset: false,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
