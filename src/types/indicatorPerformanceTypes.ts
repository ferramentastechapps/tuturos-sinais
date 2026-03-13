// ═══════════════════════════════════════════════════════════
// Indicator Performance Types
// ═══════════════════════════════════════════════════════════

import { IndicatorKey } from './strategyTypes';

/**
 * Representa uma linha na tabela `indicator_performance_by_symbol` no Supabase.
 * Registra o desempenho agregado de um indicador específico para uma moeda específica.
 */
export interface IndicatorPerformanceRecord {
  id?: string;
  user_id?: string;
  symbol: string;
  indicator_key: IndicatorKey;
  
  // Contadores
  total_trades: number;
  total_confirmed: number;
  wins_when_confirmed: number;
  losses_when_confirmed: number;
  wins_when_not_confirmed: number;
  losses_when_not_confirmed: number;
  
  // Métricas
  avg_profit_when_confirmed: number;
  avg_loss_when_confirmed: number;
  total_profit: number;
  total_loss: number;
  
  // Metadata
  last_updated?: string;
  created_at?: string;
}

/**
 * Score composto de eficácia de um indicador para uma moeda.
 */
export interface IndicatorEfficacyScore {
  indicatorKey: IndicatorKey;
  symbol: string;
  
  // Métricas extraídas/calculadas
  winRate: number;        // (wins / (wins + losses)) * 100
  profitFactor: number;   // totalProfit / totalLoss
  totalTrades: number;    // amostra
  
  // Componentes do score
  winRateScore: number;   // max 40
  pfScore: number;        // max 30
  volumeScore: number;    // max 20
  consistencyScore: number; // max 10
  
  // Resultado final
  finalScore: number;     // 0 a 100
  label: 'excellent' | 'good' | 'average' | 'poor' | 'insufficient_data';
  stars: string;          // ⭐⭐⭐, ⭐⭐, ⭐, ⚠️
  recommendation: string; 
}

/**
 * Resumo de desempenho para uma moeda específica.
 */
export interface SymbolPerformanceSummary {
  symbol: string;
  totalTrades: number;
  globalWinRate: number;
  globalProfitFactor: number;
  
  // Rankings
  topIndicators: IndicatorEfficacyScore[];
  weakIndicators: IndicatorEfficacyScore[];
  insufficientDataIndicators: IndicatorEfficacyScore[];
  
  lastUpdate: number; // timestamp
}

/**
 * Estrutura para os indicadores salvos numa operação para análise posterior
 */
export interface ActiveIndicatorState {
  key: IndicatorKey;
  weight: number;
  confirmed: boolean;
}

/**
 * Representação da operação fechada que será enviada ao service para aprender
 */
export interface TradePerformanceEntry {
  symbol: string;
  result: 'win' | 'loss';
  profitPercent: number;
  direction: 'long' | 'short';
  activeIndicators: ActiveIndicatorState[];
  profileUsed?: string;
}
