/**
 * stopCalibrationService.ts
 *
 * Serviço de calibração dinâmica de stop loss.
 * Responsável por:
 * 1. Aplicar multiplicadores de volatilidade e ADX ao stop já calculado.
 * 2. Calcular distância até o suporte/resistência mais próximo.
 * 3. Analisar stops prematuros após cada CLOSED_SL.
 * 4. Ajustar o multiplicador por par com base no histórico.
 */

import { db } from '../lib/dbClient.js';
import { bybitConnector } from '../exchange/bybitConnector.js';
import { logger } from '../lib/logger.js';
import type { OHLCPoint } from '../types/trading.js';

// ────────────────────────────────────────────────────────────────────────────
// 1. Mapeamento de tipo de operação
// ────────────────────────────────────────────────────────────────────────────

export function mapearTipoStop(trade_type: string): 'Swing Trade' | 'Scalping' {
  if (trade_type === 'Scalping') return 'Scalping';
  // 'Swing Trade', 'Day Trade', 'Day Trade (Contra-tendência)' → mesmo limite
  return 'Swing Trade';
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Leitura do multiplicador calibrado por par
// ────────────────────────────────────────────────────────────────────────────

/**
 * Retorna o multiplicador de stop do par salvo no banco (padrão 1.0).
 */
export async function getStopMultiplierPorPar(pair: string): Promise<number> {
  try {
    const registro = await db.botConfigStop.findUnique({ where: { pair } });
    return registro?.stop_multiplier ?? 1.0;
  } catch {
    return 1.0; // Fallback seguro — nunca bloqueia a geração de sinal
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Aplicar multiplicadores de volatilidade e ADX
// ────────────────────────────────────────────────────────────────────────────

export interface StopMultipliersParams {
  stop_loss_pct: number;        // valor já calculado pelo sistema atual (ATR + OB/Sweep)
  volatility_24h: number;       // (high24h - low24h) / mid * 100
  adx: number;                  // ADX calculado na geração do sinal
  trade_type: string;           // tipo original do sinal
  stop_multiplier_par: number;  // lido de bot_config_stops (padrão 1.0)
}

export interface StopMultipliersResult {
  stop_loss_pct: number;
  take_profit_pct: number;
}

/**
 * Aplica multiplicadores de volatilidade 24h, ADX e do par
 * sobre o stop_loss_pct já calculado pelo sistema existente.
 *
 * Preserva a lógica atual de ATR × mult + stop estrutural;
 * apenas refina o resultado final.
 */
export function aplicarMultiplicadoresStop(params: StopMultipliersParams): StopMultipliersResult {
  const { stop_loss_pct, volatility_24h, adx, trade_type, stop_multiplier_par } = params;

  // Multiplicador por volatilidade 24h
  let mult_vol = 1.0;
  if (volatility_24h > 5.0)      mult_vol = 1.4;
  else if (volatility_24h > 4.0) mult_vol = 1.2;
  else if (volatility_24h > 3.0) mult_vol = 1.1;

  // Multiplicador por força de tendência (ADX alto → mais espaço para o trade)
  let mult_adx = 1.0;
  if (adx > 40)      mult_adx = 1.2;
  else if (adx > 30) mult_adx = 1.1;

  // Aplica todos os multiplicadores
  let novo_stop = stop_loss_pct * mult_vol * mult_adx * stop_multiplier_par;

  // Limites por tipo de operação (evita stops absurdamente largos ou apertados)
  const tipo = mapearTipoStop(trade_type);
  if (tipo === 'Swing Trade') {
    novo_stop = Math.max(1.5, Math.min(novo_stop, 4.0));
  } else {
    novo_stop = Math.max(0.8, Math.min(novo_stop, 2.0));
  }

  return {
    stop_loss_pct: parseFloat(novo_stop.toFixed(4)),
    // TP mantém RR 2:1 mínimo garantido
    take_profit_pct: parseFloat((novo_stop * 2.0).toFixed(4)),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Calcular distância até suporte/resistência mais próximo
// ────────────────────────────────────────────────────────────────────────────

/**
 * Detecta swing highs (resistências) ou swing lows (suportes) nos últimos 50
 * candles de 1h e retorna a distância percentual até o nível mais próximo
 * do lado do stop (abaixo do preço para long, acima para short).
 *
 * Retorna 0 quando nenhum nível relevante for encontrado.
 */
export async function calcularDistanciaResistencia(params: {
  pair: string;
  preco_entrada: number;
  is_long: boolean;
}): Promise<number> {
  const { pair, preco_entrada, is_long } = params;

  try {
    const candles = await bybitConnector.fetchKlines(pair, '60', 50);
    if (candles.length < 5) return 0;

    // Detecta swing highs (resistências para long) ou swing lows (suportes para short)
    // Critério: high/low maior/menor que os 2 vizinhos de cada lado
    const niveis: number[] = [];
    for (let i = 2; i < candles.length - 2; i++) {
      if (is_long) {
        const isSwingHigh =
          candles[i].high > candles[i - 1].high &&
          candles[i].high > candles[i - 2].high &&
          candles[i].high > candles[i + 1].high &&
          candles[i].high > candles[i + 2].high;
        if (isSwingHigh) niveis.push(candles[i].high);
      } else {
        const isSwingLow =
          candles[i].low < candles[i - 1].low &&
          candles[i].low < candles[i - 2].low &&
          candles[i].low < candles[i + 1].low &&
          candles[i].low < candles[i + 2].low;
        if (isSwingLow) niveis.push(candles[i].low);
      }
    }

    if (niveis.length === 0) return 0;

    // Para long: pega o nível mais próximo ABAIXO do preço (lado do stop)
    // Para short: pega o nível mais próximo ACIMA do preço (lado do stop)
    const niveis_relevantes = is_long
      ? niveis.filter(n => n < preco_entrada).sort((a, b) => b - a)  // maior abaixo = mais próximo
      : niveis.filter(n => n > preco_entrada).sort((a, b) => a - b); // menor acima = mais próximo

    if (niveis_relevantes.length === 0) return 0;

    const nivel_mais_proximo = niveis_relevantes[0];
    const distancia_pct = Math.abs(preco_entrada - nivel_mais_proximo) / preco_entrada * 100;

    return parseFloat(distancia_pct.toFixed(4));
  } catch (err) {
    logger.warn(`[StopCalibration] Erro ao calcular distância de resistência para ${pair}:`, { error: err });
    return 0;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Análise de stop prematuro (roda após CLOSED_SL em background)
// ────────────────────────────────────────────────────────────────────────────

export interface AnalisarStopParams {
  trade_id: string;
  pair: string;
  entry_price: number;
  stop_price: number;
  exit_time: Date;
  take_profit_1: number;
  take_profit_2: number;
  take_profit_3?: number;
  is_long: boolean;
  janela_analise_horas: number; // geralmente 24
}

/**
 * Busca candles 1h após o stop e verifica se o preço atingiu algum TP.
 * Se sim, registra como "stop prematuro" na tabela stop_calibration.
 *
 * Deve ser chamado em background (sem await) após CLOSED_SL com prejuízo.
 */
export async function analisarStopPrematuro(params: AnalisarStopParams): Promise<void> {
  const {
    trade_id, pair, entry_price, stop_price, exit_time,
    take_profit_1, take_profit_2, take_profit_3,
    is_long, janela_analise_horas,
  } = params;

  try {
    // Opção A: busca com start_timestamp exato do fechamento por SL (Unix segundos)
    const start_ts_segundos = Math.floor(exit_time.getTime() / 1000);
    const candles = await bybitConnector.fetchKlines(
      pair,
      '60',                     // 1 candle por hora
      janela_analise_horas,     // quantidade = janela em horas
      start_ts_segundos,
    );

    if (!candles || candles.length === 0) {
      logger.debug(`[StopCalibration] ${pair} — Nenhum candle encontrado após o stop`);
      return;
    }

    let tp_atingido: 'TP1' | 'TP2' | 'TP3' | null = null;
    let tempo_ate_tp_horas: number | null = null;

    for (const candle of candles) {
      const preco_alvo = is_long ? candle.high : candle.low;
      const horas = (candle.timestamp - exit_time.getTime()) / 3600000;

      // Verifica TPs em ordem decrescente de distância (TP3 > TP2 > TP1)
      if (take_profit_3 && !tp_atingido) {
        const hit = is_long ? preco_alvo >= take_profit_3 : preco_alvo <= take_profit_3;
        if (hit) { tp_atingido = 'TP3'; tempo_ate_tp_horas = horas; break; }
      }
      if (!tp_atingido) {
        const hit = is_long ? preco_alvo >= take_profit_2 : preco_alvo <= take_profit_2;
        if (hit) { tp_atingido = 'TP2'; tempo_ate_tp_horas = horas; break; }
      }
      if (!tp_atingido) {
        const hit = is_long ? preco_alvo >= take_profit_1 : preco_alvo <= take_profit_1;
        if (hit) { tp_atingido = 'TP1'; tempo_ate_tp_horas = horas; break; }
      }
    }

    const foi_prematuro = tp_atingido !== null;

    // Calcula ajuste sugerido: pior ponto nos primeiros 6h após o stop + buffer de 0.3%
    let ajuste_sugerido_stop_pct = 0;
    if (foi_prematuro) {
      const candles_6h = candles.filter(c =>
        (c.timestamp - exit_time.getTime()) / 3600000 <= 6
      );

      if (candles_6h.length > 0) {
        const pior_ponto = is_long
          ? Math.min(...candles_6h.map(c => c.low))
          : Math.max(...candles_6h.map(c => c.high));

        const distancia_extra = Math.abs(pior_ponto - stop_price) / entry_price * 100;
        ajuste_sugerido_stop_pct = parseFloat((distancia_extra + 0.3).toFixed(4));
      }
    }

    // Persiste no banco
    await db.stopCalibration.create({
      data: {
        trade_id,
        pair,
        foi_prematuro,
        tp_atingido,
        tempo_ate_tp_horas: tempo_ate_tp_horas !== null ? parseFloat(tempo_ate_tp_horas.toFixed(2)) : null,
        ajuste_sugerido_stop_pct,
      },
    });

    logger.info(
      `[StopCalibration] ${pair} — Stop ${foi_prematuro ? `PREMATURO (${tp_atingido} atingido em ${tempo_ate_tp_horas?.toFixed(1)}h)` : 'LEGÍTIMO'}`
    );
  } catch (err) {
    logger.error(`[StopCalibration] Erro ao analisar stop prematuro para ${pair}:`, { error: err });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Feedback loop — ajusta multiplicador por par gradualmente
// ────────────────────────────────────────────────────────────────────────────

/**
 * Lê os últimos 20 registros de stop_calibration do par e ajusta
 * o multiplicador de stop de forma gradual (+5% / -5%).
 *
 * Roda após analisarStopPrematuro() via .then().
 */
export async function ajustarMultiplicadorPorPar(pair: string): Promise<void> {
  try {
    const historico = await db.stopCalibration.findMany({
      where: { pair },
      orderBy: { analisado_em: 'desc' },
      take: 20,
      select: { foi_prematuro: true },
    });

    if (historico.length < 5) return; // Amostra mínima antes de ajustar

    const taxa_prematuros = historico.filter(r => r.foi_prematuro).length / historico.length;

    const config = await db.botConfigStop.findUnique({ where: { pair } });
    let mult = config?.stop_multiplier ?? 1.0;

    if (taxa_prematuros > 0.30) {
      // Mais de 30% foram prematuros → ampliar o stop
      mult = parseFloat(Math.min(mult + 0.05, 1.5).toFixed(2));
      logger.info(`[StopCalibration] ${pair} — ${(taxa_prematuros * 100).toFixed(0)}% prematuros → mult aumentado para ${mult}×`);
    } else if (taxa_prematuros < 0.10 && mult > 1.0) {
      // Menos de 10% prematuros e mult acima do padrão → diminuir levemente
      mult = parseFloat(Math.max(mult - 0.05, 0.8).toFixed(2));
      logger.info(`[StopCalibration] ${pair} — Poucos prematuros → mult reduzido para ${mult}×`);
    }

    await db.botConfigStop.upsert({
      where: { pair },
      update: { stop_multiplier: mult },
      create: { pair, stop_multiplier: mult },
    });
  } catch (err) {
    logger.error(`[StopCalibration] Erro ao ajustar multiplicador para ${pair}:`, { error: err });
  }
}
