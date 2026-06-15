import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { priceStream, PriceUpdate } from './priceStream.js';
import { db } from '../lib/dbClient.js';
import { sendActivationNotification, sendTrailingStopUpdate, sendTPNotification, sendSLNotification } from '../notifications/telegramService.js';
import { calculateTrailingStop, calculatePartialProfit, formatTrailingStopMessage, shouldNotifyTrailingUpdate, type TrailingStopConfig } from './trailingStopManager.js';
import { bybitConnector } from '../exchange/bybitConnector.js';
import { calculateATR } from '../engine/signalEngine.js';
import { analisarStopPrematuro, ajustarMultiplicadorPorPar } from './stopCalibrationService.js';
import { RestClientV5 } from 'bybit-api'; // [ARB-SCALP #2]
import { config } from '../lib/config.js'; // [ARB-SCALP #2]

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TakeProfit {
  price: number;
  hit: boolean;
  level: number;
}

export interface ActiveSignal {
  id: string;
  signal_number?: number;
  pair: string;
  type: 'LONG' | 'SHORT';
  trade_type: string;
  entry_range_low: number;
  entry_range_high: number;
  stop_loss: number;
  initial_stop_loss: number;
  take_profits: TakeProfit[];
  status: string;
  telegram_message_id?: string;
  expected_duration?: string;
  context?: string;
  score?: number;
  indicators?: string[];
  mlData?: any;
  // Trailing stop por nível de TP
  tp1Hit?: boolean;        // TP1 atingido → stop vai para entrada
  tp2Hit?: boolean;        // TP2 atingido → stop vai para TP1
  tp3Hit?: boolean;        // TP3 atingido → stop vai para TP3 + extende alvo
  currentTarget?: number;  // Alvo atual (pode ser extendido após TP3)
  // Legado — mantido para compatibilidade
  positionRemaining?: number;
  lastNotifiedSL?: number;
  trailingActive?: boolean;
}

export class TradeTracker {
  private activeSignals: Map<string, ActiveSignal[]> = new Map();
  private activatedSignals: Set<string> = new Set(); // Rastrear sinais já ativados
  private sessionClosedTrades = 0; // Contador de trades finalizados na sessão
  private lastSLNotification = new Map<string, number>(); // Rate limiter de notificações de SL

  constructor() {
    this.setupListeners();
  }

  public async initialize() {
    console.log('[TradeTracker] Loading active signals from DB...');
    try {
      const data = await db.activeSignal.findMany({
        where: { status: { in: ['ACTIVE', 'PENDING'] } },
        orderBy: { id: 'desc' } // Os mais recentes primeiro
      });

      this.activeSignals.clear();
      const seenPairs = new Set<string>();

      for (const rawSignal of (data || [])) {
        // Deduplicação: se já carregamos um sinal mais recente para esse par, cancela os antigos no BD
        if (seenPairs.has(rawSignal.pair)) {
          console.log(`[TradeTracker] Cleaning up duplicate DB signal for ${rawSignal.pair}`);
          try {
             await db.activeSignal.update({
               where: { id: rawSignal.id },
               data: { status: 'CANCELLED' }
             });
          } catch(e) { /* ignore */ }
          continue;
        }
        
        seenPairs.add(rawSignal.pair);

        const signal = {
          ...rawSignal,
          take_profits: typeof rawSignal.take_profits === 'string' ? JSON.parse(rawSignal.take_profits) : rawSignal.take_profits,
          context: typeof rawSignal.context === 'string' ? JSON.parse(rawSignal.context) : rawSignal.context,
          // Mapear flags de trailing stop do banco para camelCase
          tp1Hit: (rawSignal as any).tp1_hit ?? false,
          tp2Hit: (rawSignal as any).tp2_hit ?? false,
          tp3Hit: (rawSignal as any).tp3_hit ?? false,
          currentTarget: (rawSignal as any).current_target ?? undefined,
        } as any as ActiveSignal;
        this.addSignalToMemory(signal);

      }
      console.log(`[TradeTracker] Loaded ${seenPairs.size} unique active signals.`);
    } catch (error) {
      console.error('[TradeTracker] Failed to load signals', error);
      return;
    }
  }

  private addSignalToMemory(signal: ActiveSignal) {
    if (!this.activeSignals.has(signal.pair)) {
      this.activeSignals.set(signal.pair, []);
    }
    this.activeSignals.get(signal.pair)!.push(signal);
    priceStream.subscribe(signal.pair);
  }

  public getAllActiveSignals(): ActiveSignal[] {
    const allSignals: ActiveSignal[] = [];
    for (const signals of this.activeSignals.values()) {
        allSignals.push(...signals);
    }
    // Retorna ordenado pelo mais recente
    return allSignals.sort((a, b) => {
        // Usa o timestamp no ID se existir, ou data de criação do banco
        return b.id.localeCompare(a.id); 
    });
  }

  public async registerNewSignal(signal: Partial<ActiveSignal>) {
    console.log(`[TradeTracker] Registering new signal for ${signal.pair}...`);
    let fullSignal = signal as ActiveSignal;
    if (!fullSignal.id) {
        fullSignal.id = `${signal.pair}-${Date.now()}`;
    }

    // Get next sequential signal number
    let nextSignalNumber: number | null = null;
    try {
        const lastSignal = await db.tradeSignal.findFirst({
            where: { signal_number: { not: null } },
            orderBy: { signal_number: 'desc' },
            select: { signal_number: true }
        });
        nextSignalNumber = lastSignal?.signal_number ? lastSignal.signal_number + 1 : 1;
    } catch (e: any) {
        console.warn('[TradeTracker] Error getting next signal number, using count fallback', e.message);
        try {
            const count = await db.tradeSignal.count();
            nextSignalNumber = count + 1;
        } catch (err: any) {
            console.error('[TradeTracker] Fallback also failed', err.message);
        }
    }

    if (nextSignalNumber) {
        fullSignal.signal_number = nextSignalNumber;
    }

    // Inicializar flags de TP e campos de trailing stop por nível
    if (fullSignal.tp1Hit === undefined) fullSignal.tp1Hit = false;
    if (fullSignal.tp2Hit === undefined) fullSignal.tp2Hit = false;
    if (fullSignal.tp3Hit === undefined) fullSignal.tp3Hit = false;
    if (!fullSignal.positionRemaining) fullSignal.positionRemaining = 100;
    if (fullSignal.trailingActive === undefined) fullSignal.trailingActive = false;

    // 0. CANCELAR SINAIS ANTIGOS DA MESMA MOEDA
    await this.cancelOldSignalsForPair(signal.pair!);

    // 1. Save to activeSignal (monitoring/RAM table)
    try {
        const inputData = { 
            id: fullSignal.id,
            signal_number: fullSignal.signal_number ?? null,
            pair: fullSignal.pair,
            type: fullSignal.type,
            trade_type: fullSignal.trade_type,
            entry_range_low: fullSignal.entry_range_low,
            entry_range_high: fullSignal.entry_range_high,
            stop_loss: fullSignal.stop_loss,
            initial_stop_loss: fullSignal.initial_stop_loss,
            status: fullSignal.status,
            telegram_message_id: fullSignal.telegram_message_id,
            expected_duration: fullSignal.expected_duration,
            score: fullSignal.score,
            take_profits: JSON.stringify(fullSignal.take_profits || []),
            context: typeof fullSignal.context === 'string' ? fullSignal.context : JSON.stringify(fullSignal.context || {})
        } as any;
        const data = await db.activeSignal.create({ data: inputData });
        if (data) {
            fullSignal = {
              ...data,
              take_profits: JSON.parse(data.take_profits),
              indicators: fullSignal.indicators,
              mlData: fullSignal.mlData
            } as any as ActiveSignal;
        }
    } catch (e: any) {
        console.warn('[TradeTracker] DB Exception on activeSignal. Tracking in RAM only.', e.message);
    }

    // 2. Also upsert into tradeSignal (history/analytics table) so it shows in the gallery/filters
    try {
        await db.tradeSignal.upsert({
            where: { id: fullSignal.id },
            update: { status: fullSignal.status },
            create: {
                id: fullSignal.id,
                signal_number: fullSignal.signal_number ?? null,
                pair: fullSignal.pair,
                type: fullSignal.type.toLowerCase(),
                trade_type: fullSignal.trade_type || 'Scalping',
                entry_range_low: fullSignal.entry_range_low,
                entry_range_high: fullSignal.entry_range_high,
                stop_loss: fullSignal.stop_loss,
                initial_stop_loss: fullSignal.initial_stop_loss,
                take_profits: JSON.stringify(fullSignal.take_profits || []),
                status: fullSignal.status || 'PENDING',
                confidence: fullSignal.score ?? null,
                indicators: fullSignal.indicators ? JSON.stringify(fullSignal.indicators) : null,
                ml_data: fullSignal.mlData ? JSON.stringify(fullSignal.mlData) : null,
            }
        });
    } catch (e: any) {
        console.warn('[TradeTracker] DB Exception on tradeSignal upsert.', e.message);
    }

    this.addSignalToMemory(fullSignal);
    return fullSignal;
  }

  private setupListeners() {
    priceStream.on('priceUpdate', async (update: PriceUpdate) => {
      this.processPriceUpdate(update);
    });
  }

  private async processPriceUpdate(update: PriceUpdate) {
    const signals = this.activeSignals.get(update.symbol);
    if (!signals || signals.length === 0) return;

    // Criar cópia do array para evitar modificação durante iteração
    const signalsCopy = [...signals];

    for (const signal of signalsCopy) {
      // Verificar se o sinal ainda existe (pode ter sido removido por outro processo)
      if (!this.activeSignals.get(update.symbol)?.find(s => s.id === signal.id)) {
        continue; // Sinal já foi processado/removido
      }
      if (signal.status === 'PENDING' || signal.status === 'BLOCKED') {
         // Activate only when price enters the defined entry zone
         const isEntered = update.price >= signal.entry_range_low && update.price <= signal.entry_range_high;

         if (isEntered) {
             // Verificar se já foi ativado (evitar duplicatas)
             if (this.activatedSignals.has(signal.id)) {
                 continue; // Já foi ativado, pular
             }
             
             const isBlocked = signal.status === 'BLOCKED';
             const nextStatus = isBlocked ? 'BLOCKED_ACTIVE' : 'ACTIVE';
             
             console.log(`[TradeTracker] Signal ${signal.pair} ACTIVATED at ${update.price} (Blocked: ${isBlocked})`);
             signal.status = nextStatus;
             
             // Marcar como ativado ANTES de enviar notificação
             this.activatedSignals.add(signal.id);
             
             try {
                await db.activeSignal.update({ where: { id: signal.id }, data: { status: nextStatus } });
                await db.tradeSignal.update({ where: { id: signal.id }, data: { entry_time: new Date(), status: nextStatus } }); // SALVAR ENTRY_TIME e status
                this.logEvent(signal.id, 'ACTIVATED', `Order activated at ${update.price}`, update.price).catch(()=>{});
             } catch (e) { /* ignore pg error */ }
             
             sendActivationNotification(signal, update.price).catch(e => console.error('TG error', e));
             
             // Wait for the next price tick before checking SL/TP to avoid same-tick double-processing
             continue;
         } else {
             continue; // Wait for activation
         }
      }

      if (signal.status !== 'ACTIVE' && signal.status !== 'BLOCKED_ACTIVE') continue;

      // Check Stop Loss
      const tradeDir = signal.type.toUpperCase();
      const isSLHit = tradeDir === 'LONG' 
        ? update.price <= signal.stop_loss 
        : update.price >= signal.stop_loss;

      if (isSLHit) {
        // Verificar se já foi processado (proteção adicional)
        if (signal.status !== 'ACTIVE' && signal.status !== 'BLOCKED_ACTIVE') {
          continue;
        }
        await this.handleStopLoss(signal, update.price);
        continue; // Processed
      }

      // Check Take Profits
      let hitAnyTP = false;
      for (let i = 0; i < signal.take_profits.length; i++) {
        const tp = signal.take_profits[i];
        if (tp.hit) continue;

        const isTPHit = tradeDir === 'LONG'
          ? update.price >= tp.price
          : update.price <= tp.price;

        if (isTPHit) {
          hitAnyTP = true;
          await this.handleTakeProfit(signal, tp, update.price);
        }
      }

      // Trailing Stop Logic (Step-based after TP1)
      const tp1 = signal.take_profits.find(t => t.level === 1);
      if (tp1 && tp1.hit && !hitAnyTP && (signal.status === 'ACTIVE' || signal.status === 'BLOCKED_ACTIVE')) {
         await this.processTrailingStop(signal, update.price);
      }
    }
  }

  private async processTrailingStop(signal: ActiveSignal, currentPrice: number) {
    // FASE 2: Integração com trailingStopManager

    // Guarda: sem stop_loss definido não há como calcular trailing
    if (!signal.stop_loss || !currentPrice || currentPrice <= 0) {
      console.warn(`[TradeTracker] processTrailingStop: dados inválidos para ${signal.pair} (stop_loss=${signal.stop_loss}, price=${currentPrice})`);
      return;
    }

    // Buscar ATR atual para cálculo dinâmico
    let atr = 0;
    try {
      const ohlc = await bybitConnector.fetchKlines(signal.pair, signal.trade_type === 'Scalping' ? '5' : '60', 20);
      if (ohlc.length >= 15) {
        atr = calculateATR(ohlc, 14);
      }
    } catch (e) {
      console.warn(`[TradeTracker] Failed to fetch ATR for ${signal.pair}, using fallback`);
      // Fallback: estima ATR como 1% do preço
      atr = currentPrice * 0.01;
    }

    // Preparar configuração para o trailing stop manager
    const config: TrailingStopConfig = {
      symbol: signal.pair,
      type: signal.type.toLowerCase() as 'long' | 'short',
      entry: (signal.entry_range_low + signal.entry_range_high) / 2,
      currentPrice,
      stopLoss: signal.stop_loss,
      tp1: signal.take_profits[0]?.price || 0,
      tp2: signal.take_profits[1]?.price || 0,
      tp3: signal.take_profits[2]?.price || 0,
      atr,
      tp1Hit: signal.take_profits[0]?.hit || false,
      tp2Hit: signal.take_profits[1]?.hit || false,
      tp3Hit: signal.take_profits[2]?.hit || false,
      positionRemaining: signal.positionRemaining || 100,
    };

    // Calcular trailing stop
    const result = calculateTrailingStop(config);

    // Processar ação
    if (result.action === 'STOP_HIT') {
      // Stop loss foi atingido
      await this.handleStopLoss(signal, currentPrice);
      return;
    }

    if (result.action === 'CLOSE_PARTIAL' && result.closePercent) {
      // Fechar parcial da posição
      const oldPosition = signal.positionRemaining || 100;
      signal.positionRemaining = oldPosition - result.closePercent;
      
      console.log(`[TradeTracker] ${signal.pair} Fechando ${result.closePercent}% da posição (restante: ${signal.positionRemaining}%)`);
      
      // Atualizar SL se fornecido
      if (result.newStopLoss) {
        const oldSL = signal.stop_loss;
        signal.stop_loss = result.newStopLoss;
        signal.lastNotifiedSL = result.newStopLoss;
        
        console.log(`[TradeTracker] ${signal.pair} SL atualizado: ${oldSL?.toFixed(2) ?? '?'} → ${result.newStopLoss.toFixed(2)}`);
      }
      
      signal.trailingActive = true;
      
      // Atualizar DB
      try {
        await db.activeSignal.update({
          where: { id: signal.id },
          data: {
            stop_loss: signal.stop_loss,
            context: JSON.stringify({
              ...(typeof signal.context === 'string' ? JSON.parse(signal.context) : signal.context),
              positionRemaining: signal.positionRemaining,
              trailingActive: true,
            }),
          },
        });
        
        this.logEvent(signal.id, 'PARTIAL_CLOSE', `Fechado ${result.closePercent}% - ${result.reason}`, currentPrice).catch(() => {});
      } catch (e) {
        console.error('[TradeTracker] DB error updating partial close', e);
      }
      
      // Calcular lucro parcial
      const partialProfit = calculatePartialProfit(
        config.entry,
        config.tp1,
        config.tp2,
        currentPrice,
        config.type,
        config.tp1Hit,
        config.tp2Hit
      );
      
      // Notificar Telegram
      const message = formatTrailingStopMessage(signal as any, result, currentPrice, partialProfit);
      sendTrailingStopUpdate(signal, currentPrice, signal.stop_loss, signal.stop_loss, message).catch(e => 
        console.error('[TradeTracker] TG error', e)
      );
      
      return;
    }

    if ((result.action === 'MOVE_SL' || result.action === 'TRAILING_STOP') && result.newStopLoss) {
      // Atualizar stop loss
      const oldSL = signal.stop_loss;
      
      // Verificar se deve notificar (evita spam)
      const shouldNotify = shouldNotifyTrailingUpdate(signal.lastNotifiedSL || null, result.newStopLoss, 0.5);
      
      signal.stop_loss = result.newStopLoss;
      signal.trailingActive = true;
      
      if (shouldNotify) {
        signal.lastNotifiedSL = result.newStopLoss;
      }
      
      // Atualizar DB
      try {
        await db.activeSignal.update({
          where: { id: signal.id },
          data: {
            stop_loss: result.newStopLoss,
            context: JSON.stringify({
              ...(typeof signal.context === 'string' ? JSON.parse(signal.context) : signal.context),
              positionRemaining: signal.positionRemaining || 100,
              trailingActive: true,
              lastNotifiedSL: signal.lastNotifiedSL,
            }),
          },
        });
        
        this.logEvent(signal.id, 'TRAILING_STOP_UPDATED', result.reason, currentPrice).catch(() => {});
      } catch (e) {
        console.error('[TradeTracker] DB error updating trailing stop', e);
      }
      
      // Notificar Telegram apenas se mudança significativa
      if (shouldNotify) {
        const partialProfit = calculatePartialProfit(
          config.entry,
          config.tp1,
          config.tp2,
          currentPrice,
          config.type,
          config.tp1Hit,
          config.tp2Hit
        );
        
        const message = formatTrailingStopMessage(signal as any, result, currentPrice, partialProfit);
        sendTrailingStopUpdate(signal, currentPrice, oldSL ?? result.newStopLoss, result.newStopLoss, message).catch(e =>
          console.error('[TradeTracker] TG error', e)
        );
      }
    }
  }

  /**
   * Calcula o novo stop loss baseado no nível de TP atingido.
   *
   * TP1 → Stop vai para ENTRADA (breakeven, zero risco)
   * TP2 → Stop vai para TP1 (lucro mínimo garantido)
   * TP3 → Stop vai para TP3 (alvo extendido, trailing no lucro)
   */
  private calculateNewStopAfterTP(signal: ActiveSignal, tpHit: TakeProfit): number {
    const isLong = signal.type.toUpperCase() === 'LONG';
    const entryAvg = (signal.entry_range_low + signal.entry_range_high) / 2;

    if (tpHit.level === 1) {
      // TP1 → stop na entrada (breakeven)
      return isLong
        ? Math.max(signal.stop_loss, entryAvg)
        : Math.min(signal.stop_loss, entryAvg);
    }

    if (tpHit.level === 2) {
      // TP2 → stop no TP1 (lucro garantido)
      const tp1 = signal.take_profits.find(t => t.level === 1);
      if (tp1) {
        return isLong
          ? Math.max(signal.stop_loss, tp1.price)
          : Math.min(signal.stop_loss, tp1.price);
      }
    }

    if (tpHit.level === 3) {
      // TP3 → stop no próprio TP3 (trailing no lucro máximo)
      return isLong
        ? Math.max(signal.stop_loss, tpHit.price)
        : Math.min(signal.stop_loss, tpHit.price);
    }

    return signal.stop_loss;
  }

  private async handleTakeProfit(signal: ActiveSignal, tp: TakeProfit, currentPrice: number) {
    console.log(`[TradeTracker] TP${tp.level} hit for ${signal.pair} at ${currentPrice}`);
    tp.hit = true;

    const isLong = signal.type.toUpperCase() === 'LONG';
    const entryAvg = (signal.entry_range_low + signal.entry_range_high) / 2;
    const tp1 = signal.take_profits.find(t => t.level === 1);
    const tp2 = signal.take_profits.find(t => t.level === 2);
    const tp3 = signal.take_profits.find(t => t.level === 3);

    // Atualizar stop loss e flags de TP por nível
    const oldSL = signal.stop_loss;
    const newSL = this.calculateNewStopAfterTP(signal, tp);
    let tgMessage = '';

    if (tp.level === 1) {
      signal.tp1Hit = true;
      signal.stop_loss = newSL;

      const profitPct = isLong
        ? ((tp.price - entryAvg) / entryAvg * 100).toFixed(2)
        : ((entryAvg - tp.price) / entryAvg * 100).toFixed(2);

      tgMessage = [
        `🎯 TP1 ATINGIDO — ${signal.pair}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `💰 Lucro parcial: +${profitPct}%`,
        ``,
        `🔒 Stop movido para ENTRADA: $${entryAvg.toFixed(4)}`,
        `🎯 Aguardando TP2: $${tp2?.price.toFixed(4) ?? '—'}`,
        ``,
        `Trade agora SEM RISCO! 🔒`,
      ].join('\n');

      console.log(`[TradeTracker] ${signal.pair} TP1 → stop breakeven: $${newSL.toFixed(4)}`);

    } else if (tp.level === 2) {
      signal.tp2Hit = true;
      signal.stop_loss = newSL;

      const profitPct = isLong
        ? ((tp.price - entryAvg) / entryAvg * 100).toFixed(2)
        : ((entryAvg - tp.price) / entryAvg * 100).toFixed(2);
      const minGuaranteed = isLong
        ? ((newSL - entryAvg) / entryAvg * 100).toFixed(2)
        : ((entryAvg - newSL) / entryAvg * 100).toFixed(2);

      tgMessage = [
        `✅ TP2 ATINGIDO — ${signal.pair}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `💰 Lucro parcial: +${profitPct}%`,
        ``,
        `🔒 Stop movido para TP1: $${newSL.toFixed(4)}`,
        `🎯 Aguardando TP3: $${tp3?.price.toFixed(4) ?? '—'}`,
        ``,
        `Mínimo garantido: +${minGuaranteed}% ✅`,
      ].join('\n');

      console.log(`[TradeTracker] ${signal.pair} TP2 → stop no TP1: $${newSL.toFixed(4)}`);

    } else if (tp.level === 3) {
      signal.tp3Hit = true;
      signal.stop_loss = newSL; // stop no próprio TP3

      // Extender alvo em +3% (LONG) ou -3% (SHORT)
      const extendedTarget = isLong ? tp.price * 1.03 : tp.price * 0.97;
      signal.currentTarget = extendedTarget;

      const profitPct = isLong
        ? ((tp.price - entryAvg) / entryAvg * 100).toFixed(2)
        : ((entryAvg - tp.price) / entryAvg * 100).toFixed(2);

      tgMessage = [
        `🚀 TP3 ATINGIDO — ${signal.pair}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `✅ Lucro: +${profitPct}%`,
        ``,
        `🔒 Stop movido para TP3: $${newSL.toFixed(4)}`,
        `🎯 Novo alvo: $${extendedTarget.toFixed(4)} (+3% extra)`,
        ``,
        `Deixe correr! 🔥`,
      ].join('\n');

      console.log(`[TradeTracker] ${signal.pair} TP3 → stop no TP3: $${newSL.toFixed(4)} | novo alvo: $${extendedTarget.toFixed(4)}`);
    }

    // Notificar Telegram apenas se houve mudança real no stop
    if (newSL !== oldSL && tgMessage) {
      sendTrailingStopUpdate(
        signal,
        currentPrice,
        oldSL,
        newSL,
        tgMessage
      ).catch(e => console.error('[TradeTracker] TG error trailing notify', e));
    }

    // Qualquer TP batido já é WIN para o ML
    // Mesmo que não bata todos os TPs, já garantiu lucro
    const isFirstTP = !signal.take_profits.slice(0, signal.take_profits.indexOf(tp)).some(t => t.hit);
    
    if (isFirstTP) {
      this.sessionClosedTrades++;
      console.log(`[TradeTracker] Trade #${this.sessionClosedTrades} fechou com WIN (${signal.pair})`);
      
      // Primeira vez que bate qualquer TP = WIN
      this.submitFeedbackToML(signal, 1, currentPrice).catch(e => console.error('[TradeTracker] Error saving ML Feedback', e));
      
      const entryAvg = (signal.entry_range_low + signal.entry_range_high) / 2;
      const pnl = signal.type === 'LONG' 
        ? ((currentPrice - entryAvg) / entryAvg) * 100 
        : ((entryAvg - currentPrice) / entryAvg) * 100;

      // // [ARB-SCALP #2] Validar antes de fechar o trade
      const validated = await this.closeTrade(signal.id, {
        status: 'CLOSED_TP',
        take_profits: JSON.stringify(signal.take_profits || []),
        stop_loss: signal.stop_loss,
        pnl: pnl,
        outcome: 'WIN'
      });

      // Upsert no histórico (upsert garante que funciona mesmo se o registro não existia)
      db.tradeSignal.upsert({
        where: { id: signal.id },
        update: { 
          status: validated.status,
          take_profits: validated.take_profits,
          stop_loss: validated.stop_loss,
          pnl: validated.pnl,
          outcome: validated.outcome,
          exit_time: new Date()
        },
        create: {
          id: signal.id,
          pair: signal.pair,
          type: signal.type.toLowerCase(),
          trade_type: signal.trade_type || 'Scalping',
          entry_range_low: signal.entry_range_low,
          entry_range_high: signal.entry_range_high,
          stop_loss: validated.stop_loss,
          initial_stop_loss: signal.initial_stop_loss,
          take_profits: validated.take_profits,
          status: validated.status,
          confidence: signal.score ?? null,
          indicators: signal.indicators ? JSON.stringify(signal.indicators) : null,
          ml_data: signal.mlData ? JSON.stringify(signal.mlData) : null,
          pnl: validated.pnl,
          outcome: validated.outcome,
          exit_time: new Date()
        }
      }).catch((e: Error) => console.error('[TradeTracker] Error upsert CLOSED_TP:', e.message));
    }

    // Is it fully closed?
    const allHit = signal.take_profits.every(t => t.hit);
    if (allHit) {
      signal.status = 'CLOSED_TP';
      this.removeSignalFromMemory(signal.id, signal.pair);
    }

    // Persistir no banco: stop, flags de TP nativos, alvo extendido e status
    try {
        await db.activeSignal.update({
          where: { id: signal.id },
          data: {
            take_profits: JSON.stringify(signal.take_profits),
            stop_loss: signal.stop_loss,
            status: signal.status,
            // Colunas nativas para trailing stop (sobrevivem ao restart da VPS)
            tp1_hit: signal.tp1Hit ?? false,
            tp2_hit: signal.tp2Hit ?? false,
            tp3_hit: signal.tp3Hit ?? false,
            current_target: signal.currentTarget ?? null,
            context: JSON.stringify({
              ...(typeof signal.context === 'string' ? JSON.parse(signal.context || '{}') : (signal.context || {})),
              tp1Hit: signal.tp1Hit ?? false,
              tp2Hit: signal.tp2Hit ?? false,
              tp3Hit: signal.tp3Hit ?? false,
              currentTarget: signal.currentTarget ?? null,
            }),
          } as any
        });
        this.logEvent(signal.id, 'TP_HIT', `TP${tp.level} hit at ${currentPrice} | novo SL: ${signal.stop_loss.toFixed(4)}`, currentPrice).catch(()=>{});
    } catch (e) { /* ignore */ }

    // Notify
    sendTPNotification(signal, tp, currentPrice).catch(e => console.error('TG error', e));
  }

  private async handleStopLoss(signal: ActiveSignal, currentPrice: number) {
    console.log(`[TradeTracker] SL hit for ${signal.pair} at ${currentPrice}`);
    
    // CRÍTICO: Remover da memória PRIMEIRO para evitar múltiplos triggers
    signal.status = 'CLOSED_SL';
    this.removeSignalFromMemory(signal.id, signal.pair);

    // Calcular se o SL foi com lucro ou prejuízo
    const entryAvg = (signal.entry_range_low + signal.entry_range_high) / 2;
    const pnl = signal.type === 'LONG' 
      ? ((currentPrice - entryAvg) / entryAvg) * 100 
      : ((entryAvg - currentPrice) / entryAvg) * 100;

    // WIN: Se bateu TP1 (trailing stop) ou SL com lucro
    // LOSS: Se SL com prejuízo
    const isWin = pnl > 0;
    const outcomeLabel = isWin ? 1 : 0;
    const outcomeText = isWin ? 'WIN' : 'LOSS';

    this.sessionClosedTrades++;
    console.log(`[TradeTracker] Trade #${this.sessionClosedTrades} fechou com ${outcomeText} (${signal.pair})`);
    console.log(`[TradeTracker] SL PnL: ${pnl.toFixed(2)}% - Outcome: ${outcomeText}`);

    // ML Feedback Loop
    this.submitFeedbackToML(signal, outcomeLabel, currentPrice).catch(e => console.error('[TradeTracker] Error ML Feedback', e.message));

    // // [ARB-SCALP #2] Validar antes de fechar o trade
    const dbStatus = isWin ? 'CLOSED_TP' : 'CLOSED_SL';
    const validated = await this.closeTrade(signal.id, {
      status: dbStatus,
      take_profits: JSON.stringify(signal.take_profits || []),
      stop_loss: signal.stop_loss,
      pnl: pnl,
      outcome: outcomeText
    });

    // Upsert no histórico (upsert garante que funciona mesmo se o registro não existia)
    db.tradeSignal.upsert({
      where: { id: signal.id },
      update: { 
        status: validated.status,
        stop_loss: validated.stop_loss,
        take_profits: validated.take_profits,
        pnl: validated.pnl,
        outcome: validated.outcome,
        exit_time: new Date()
      },
      create: {
        id: signal.id,
        pair: signal.pair,
        type: signal.type.toLowerCase(),
        trade_type: signal.trade_type || 'Scalping',
        entry_range_low: signal.entry_range_low,
        entry_range_high: signal.entry_range_high,
        stop_loss: validated.stop_loss,
        initial_stop_loss: signal.initial_stop_loss,
        take_profits: validated.take_profits,
        status: validated.status,
        confidence: signal.score ?? null,
        indicators: signal.indicators ? JSON.stringify(signal.indicators) : null,
        ml_data: signal.mlData ? JSON.stringify(signal.mlData) : null,
        pnl: validated.pnl,
        outcome: validated.outcome,
        exit_time: new Date()
      }
    }).catch((e: Error) => console.error('[TradeTracker] Error upsert SL status:', e.message));

    try {
        await db.activeSignal.update({
            where: { id: signal.id },
            data: { status: signal.status }
        });
        this.logEvent(signal.id, 'SL_HIT', `Stop Loss hit at ${currentPrice} (PnL: ${pnl.toFixed(2)}%)`, currentPrice).catch(()=>{});
    } catch (e) { /* skip */ }

    // MELHORIA STOP v2: Análise de stop prematuro após CLOSED_SL com prejuízo
    // Roda em background (sem await) para não bloquear o fluxo principal
    if (!isWin) {
      const tp1 = signal.take_profits.find(t => t.level === 1);
      const tp2 = signal.take_profits.find(t => t.level === 2);
      const tp3 = signal.take_profits.find(t => t.level === 3);

      if (tp1 && tp2) {
        analisarStopPrematuro({
          trade_id: signal.id,
          pair: signal.pair,
          entry_price: entryAvg,
          stop_price: currentPrice,
          exit_time: new Date(),
          take_profit_1: tp1.price,
          take_profit_2: tp2.price,
          take_profit_3: tp3?.price,
          is_long: signal.type === 'LONG',
          janela_analise_horas: 24,
        })
        .then(() => ajustarMultiplicadorPorPar(signal.pair))
        .catch(err => console.error('[StopCalibration] Erro na análise pós-SL:', err));
      }
    }

    // Rate Limiting para evitar spam no Telegram
    const now = Date.now();
    const lastNotified = this.lastSLNotification.get(signal.pair) || 0;
    if (now - lastNotified > 60000) { // Cooldown de 60 segundos por par
        this.lastSLNotification.set(signal.pair, now);
        sendSLNotification(signal, currentPrice).catch(e => console.error('TG error', e));
    } else {
        console.warn(`[TradeTracker] Spam Protection: Ignorando notificação duplicada de SL para ${signal.pair}`);
    }
  }

  private async logEvent(signalId: string, eventType: string, message: string, price: number) {
    await db.signalEvent.create({
      data: {
        signal_id: signalId,
        event_type: eventType,
        message,
        price_at_event: price
      }
    }).catch((e: any) => console.error('[TradeTracker] Error logging event', e.message));
  }

  private removeSignalFromMemory(id: string, pair: string) {
    let signals = this.activeSignals.get(pair) || [];
    signals = signals.filter(s => s.id !== id);
    
    // Remover do Set de sinais ativados
    this.activatedSignals.delete(id);
    
    if (signals.length === 0) {
      this.activeSignals.delete(pair);
      priceStream.unsubscribe(pair);
    } else {
      this.activeSignals.set(pair, signals);
    }
  }

  /**
   * Cancela todos os sinais ativos/pendentes da mesma moeda antes de registrar um novo
   * Isso evita múltiplos sinais duplicados para a mesma moeda
   */
  private async cancelOldSignalsForPair(pair: string) {
    const existingSignals = this.activeSignals.get(pair) || [];
    
    if (existingSignals.length === 0) {
      return; // Nenhum sinal antigo para cancelar
    }

    console.log(`[TradeTracker] Cancelando ${existingSignals.length} sinal(is) antigo(s) para ${pair}...`);

    for (const oldSignal of existingSignals) {
      // Atualizar status para CANCELLED
      oldSignal.status = 'CANCELLED';
      
      // Atualizar no banco de dados
      try {
        await db.activeSignal.update({
          where: { id: oldSignal.id },
          data: { status: 'CANCELLED' }
        });
        
        // Também atualizar na tabela de histórico
        await db.tradeSignal.update({
          where: { id: oldSignal.id },
          data: { status: 'CANCELLED' }
        }).catch(() => {}); // Ignora se não existir no histórico
        
        this.logEvent(oldSignal.id, 'CANCELLED', `Sinal cancelado automaticamente - novo sinal gerado para ${pair}`, 0).catch(() => {});
        
        console.log(`[TradeTracker] ✅ Sinal ${oldSignal.id} cancelado`);
      } catch (e: any) {
        console.warn(`[TradeTracker] Erro ao cancelar sinal ${oldSignal.id}:`, e.message);
      }
      
      // Remover da memória
      this.removeSignalFromMemory(oldSignal.id, pair);
    }
  }

  /**
   * Cancela em memória sinais antigos inativados pelo Cleanup Job
   */
  public cancelStaleSignalsInMemory(staleIds: string[]) {
    console.log(`[TradeTracker] Cancelando em memória ${staleIds.length} sinais expirados...`);
    for (const id of staleIds) {
      for (const [pair, signals] of this.activeSignals.entries()) {
        const found = signals.find(s => s.id === id);
        if (found) {
          found.status = 'CANCELLED';
          this.removeSignalFromMemory(id, pair);
          console.log(`[TradeTracker] ✅ Sinal expirado ${id} removido da memória`);
        }
      }
    }
  }

  /**
   * ML Feedback Loop
   * Fetches the original TradeSignal to get `ml_data` and indicators,
   * then saves the final outcome (1=Win, 0=Loss) to ml_training_data
   * so the AI can learn from it in the next retraining cycle.
   */
  private async submitFeedbackToML(activeSignal: ActiveSignal, outcomeLabel: 0 | 1, finalPrice: number) {
    console.log(`[TradeTracker] Submitting ML Feedback for ${activeSignal.id} - Outcome: ${outcomeLabel === 1 ? 'WIN' : 'LOSS'}`);
    try {
      // 1. Fetch original signal details and ML features
      let originalSignal;
      let fetchErr = null;
      try {
        originalSignal = await db.tradeSignal.findUnique({
          where: { id: activeSignal.id }
        });
      } catch (err) {
        fetchErr = err;
      }

      if (fetchErr || !originalSignal) {
        console.warn(`[TradeTracker] Original signal ${activeSignal.id} not found for ML Feedback.`);
        return;
      }

      // If the signal didn't have ml_data or indicators, it can't be used to train effectively
      // (However, we should still save it using whatever features we generated at entry if possible).
      let features: Record<string, any> = {};
      
      if (originalSignal.ml_data && typeof originalSignal.ml_data === 'string') {
          try {
            const parsed = JSON.parse(originalSignal.ml_data);
            // ml_data contém o vetor completo de features + campos de predição
            // Remover campos de predição — manter só as features de entrada
            const { probability, predictedClass, isFiltered, ...featureFields } = parsed;
            features = featureFields;
          } catch(e){}
      }

      // Garantir campos essenciais sempre presentes
      if (!features.confidence) features.confidence = originalSignal.confidence ?? 0.5;
      if (!features.risk_reward) features.risk_reward = originalSignal.risk_reward ?? 1.5;

      // Adicionar feedback de aprendizado por símbolo (symbol_weight)
      const symStats = await getSymbolStats(activeSignal.pair);
      let symbol_weight = 1.0;
      if (symStats.total >= 5) {
          if (symStats.winRate > 0.50) symbol_weight = 1.2;
          else if (symStats.winRate < 0.30) symbol_weight = 0.7;
      }
      features.symbol_weight = symbol_weight;
      
      const entryPrice = (activeSignal.entry_range_low + activeSignal.entry_range_high) / 2;
      const pnl = activeSignal.type === 'LONG' 
        ? ((finalPrice - entryPrice) / entryPrice) * 100 
        : ((entryPrice - finalPrice) / entryPrice) * 100;

      const rowToSave = {
        signal_id: activeSignal.id,
        symbol: activeSignal.pair,
        outcome_label: outcomeLabel,
        outcome_pnl: pnl,
        entry_time: (originalSignal.created_at ? new Date(originalSignal.created_at) : new Date()).toISOString(),
        trade_type: activeSignal.trade_type,
        features: features
      };

      // // [ARB-SCALP #1] Corrigir logging quebrado (31/32 trades sem dados)
      // Validar dados críticos antes de gravar em MLTrainingData
      const criticalFields = {
        rsi: features.rsi,
        adx: features.adx,
        atr_rel: features.atr_rel,
        dist_ema20: features.dist_ema20,
        dist_ema200: features.dist_ema200,
        btc_trend: features.btc_trend,
        fear_greed: features.fear_greed,
        confidence: features.confidence,
      };

      const nullCount = Object.values(criticalFields).filter(v => v === null || v === undefined).length;

      if (nullCount > 2) {
        console.warn(`[ML][${activeSignal.pair}] Sinal descartado do treino: ${nullCount} campos críticos nulos`);
        return; // NÃO gravar no banco com dados incompletos
      }

      // 2. Insert into training table
      const dbRowSave = {
        ...rowToSave,
        features: JSON.stringify(features)
      };
      
      let insertErr: any = null;
      try {
        const existing = await db.mLTrainingData.findFirst({
          where: { signal_id: activeSignal.id }
        });
        if (existing) {
          console.log(`[TradeTracker] ML Training Data already exists for signal ${activeSignal.id}. Updating with final PnL.`);
          await db.mLTrainingData.update({
            where: { id: existing.id },
            data: dbRowSave as any
          });
        } else {
          await db.mLTrainingData.create({ data: dbRowSave as any });
        }
      } catch (err: any) {
        insertErr = err;
      }

      // 3. Sync to Supabase ml_training_data table
      try {
        const { supabase } = await import('../lib/supabaseClient.js');
        if (supabase) {
          const rowSupabase = {
            user_id: '671adabc-be38-4db5-af4a-2630a62fe1ec',
            signal_id: rowToSave.signal_id,
            symbol: rowToSave.symbol,
            outcome_label: rowToSave.outcome_label,
            outcome_pnl: rowToSave.outcome_pnl,
            entry_time: rowToSave.entry_time,
            trade_type: rowToSave.trade_type,
            features: rowToSave.features
          };

          const { data: existingSg, error: selErr } = await supabase
            .from('ml_training_data')
            .select('id')
            .eq('signal_id', activeSignal.id)
            .maybeSingle();

          if (!selErr) {
            if (existingSg) {
              const { error: upErr } = await supabase
                .from('ml_training_data')
                .update(rowSupabase)
                .eq('id', existingSg.id);
              if (upErr) {
                console.error(`[TradeTracker] Failed to update ML feedback on Supabase:`, upErr);
              } else {
                console.log(`[TradeTracker] ML Feedback updated on Supabase successfully!`);
              }
            } else {
              const { error: insErr } = await supabase
                .from('ml_training_data')
                .insert(rowSupabase);
              if (insErr) {
                console.error(`[TradeTracker] Failed to insert ML feedback into Supabase:`, insErr);
              } else {
                console.log(`[TradeTracker] ML Feedback inserted into Supabase successfully!`);
              }
            }
          } else {
            console.error(`[TradeTracker] Supabase select check failed:`, selErr);
          }
        }
      } catch (sbErr) {
        console.error(`[TradeTracker] Supabase submission error:`, sbErr);
      }

      // 4. Keep local JSONL updated for VPS local training
      try {
        const dataPath = path.join(__dirname, '../../../ml_engine/data/historical_ml_data.jsonl');
        fs.appendFileSync(dataPath, JSON.stringify(rowToSave) + '\n', 'utf-8');
      } catch (err) {
        console.error(`[TradeTracker] Failed to append ML data locally:`, err);
      }

      if (insertErr) {
        console.error(`[TradeTracker] Failed to insert ML Feedback:`, insertErr);
      } else {
        console.log(`[TradeTracker] ML Feedback Saved Successfully (Supabase + SQLite + Local JSONL)!`);
        // Retreinamento agora é feito diariamente às 23:55 UTC via mlRetrainJob
      }
    } catch (err) {
      console.error(`[TradeTracker] Unhandled error submitting ML feedback:`, err);
    }
  }

  // // [ARB-SCALP #2] Buscar resultado real na exchange Bybit em caso de falha de sincronização
  private async fetchTradeResultFromExchange(tradeId: string): Promise<{ outcome: 'WIN' | 'LOSS' | 'NEEDS_REVIEW', pnl: number }> {
    try {
      const signal = await db.tradeSignal.findUnique({ where: { id: tradeId } });
      if (!signal) return { outcome: 'NEEDS_REVIEW', pnl: 0 };

      // Se a API da Bybit estiver configurada, podemos tentar buscar a ordem
      if (bybitConnector.isConnected() && config.bybit.apiKey && config.bybit.apiSecret) {
        const client = new RestClientV5({
          key: config.bybit.apiKey || undefined,
          secret: config.bybit.apiSecret || undefined,
          testnet: config.bybit.testnet,
        });
        const response = await client.getClosedPnL({
          category: 'linear',
          symbol: signal.pair,
          limit: 10
        });

        if (response.retCode === 0 && response.result?.list?.length > 0) {
          // Encontrar o trade com base no ID ou no tempo aproximado
          const closedTrade = response.result.list.find((t: any) => 
            t.orderId === signal.id || Math.abs(new Date(parseInt(t.createdTime)).getTime() - Date.now()) < 600000
          ) || response.result.list[0];

          if (closedTrade) {
            const closedPnl = parseFloat(closedTrade.closedPnl);
            const outcome = closedPnl > 0 ? 'WIN' : 'LOSS';
            const pnlPct = parseFloat(closedTrade.closedSize) > 0 
              ? (closedPnl / (parseFloat(closedTrade.avgEntryPrice) * parseFloat(closedTrade.closedSize)) * 100) 
              : 0;
            return { outcome, pnl: pnlPct || closedPnl };
          }
        }
      }

      // Se for paper trading ou se a busca na Bybit falhar, recalcular com base no preço atual do feed
      const entryAvg = (signal.entry_range_low + signal.entry_range_high) / 2;
      const ticker = bybitConnector.getTicker(signal.pair);
      const currentPrice = ticker?.lastPrice || entryAvg;
      if (entryAvg > 0 && currentPrice > 0) {
        const pnl = signal.type === 'long' 
          ? ((currentPrice - entryAvg) / entryAvg) * 100 
          : ((entryAvg - currentPrice) / entryAvg) * 100;
        const outcome = pnl > 0 ? 'WIN' : 'LOSS';
        return { outcome, pnl };
      }
    } catch (err) {
      console.error(`[TRACKER] Erro ao buscar resultado na exchange para ${tradeId}:`, err);
    }
    return { outcome: 'NEEDS_REVIEW', pnl: 0 };
  }

  // // [ARB-SCALP #2] Validar antes de gravar o fechamento do trade
  private async closeTrade(
    tradeId: string, 
    result: { status: string, stop_loss: number, take_profits: string, pnl: number, outcome: string }
  ): Promise<{ status: string, stop_loss: number, take_profits: string, pnl: number, outcome: string }> {
    if (!result.outcome || result.pnl === 0) {
      console.error(`[TRACKER] Tentativa de fechar trade ${tradeId} com dados inválidos`, result);
      // Aguardar 500ms e tentar buscar o resultado real na exchange
      await new Promise(resolve => setTimeout(resolve, 500));
      const exchangeResult = await this.fetchTradeResultFromExchange(tradeId);
      
      result.outcome = exchangeResult.outcome;
      result.pnl = exchangeResult.pnl;
      if (result.outcome === 'WIN') {
        result.status = 'CLOSED_TP';
      } else if (result.outcome === 'LOSS') {
        result.status = 'CLOSED_SL';
      }
    }

    if (!result.outcome || result.outcome === 'NEEDS_REVIEW') {
      console.error(`[TRACKER] Não foi possível obter outcome para ${tradeId} — marcando como NEEDS_REVIEW`);
      result.outcome = 'NEEDS_REVIEW';
    }

    return result;
  }

  // Retreinamento agora é gerenciado pelo mlRetrainJob (diário às 23:55 UTC)

}

export const tradeTracker = new TradeTracker();

// --- NOVAS FUNÇÕES PARA FILTROS E ML ---

/** Retorna o Win Rate Global das últimas 20 operações concluídas */
export async function getRecentGlobalWinRate(): Promise<number | null> {
  const recent = await db.tradeSignal.findMany({
    where: { status: { in: ['CLOSED_TP', 'CLOSED_SL'] }, outcome: { not: null } },
    orderBy: { exit_time: 'desc' },
    take: 20,
    select: { outcome: true }
  });
  if (recent.length < 10) return null;
  const wins = recent.filter(r => r.outcome === 'WIN').length;
  return wins / recent.length;
}

/** Retorna o histórico dos últimos 10 trades de um símbolo */
export async function getSymbolStats(symbol: string): Promise<{ winRate: number, total: number }> {
  const recent = await db.tradeSignal.findMany({
    where: { pair: symbol, status: { in: ['CLOSED_TP', 'CLOSED_SL'] }, outcome: { not: null } },
    orderBy: { exit_time: 'desc' },
    take: 10,
    select: { outcome: true }
  });
  if (recent.length === 0) return { winRate: 0, total: 0 };
  const wins = recent.filter(r => r.outcome === 'WIN').length;
  return { winRate: wins / recent.length, total: recent.length };
}

/** Retorna as perdas e ganhos do dia atual (UTC) */
export async function getDailyStats(): Promise<{ wins: number, losses: number, winRate: number }> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const tradesToday = await db.tradeSignal.findMany({
    where: {
      status: { in: ['CLOSED_TP', 'CLOSED_SL'] },
      outcome: { not: null },
      exit_time: { gte: startOfDay }
    },
    select: { outcome: true }
  });

  const wins = tradesToday.filter(r => r.outcome === 'WIN').length;
  const losses = tradesToday.filter(r => r.outcome === 'LOSS').length;
  const total = wins + losses;

  return {
    wins,
    losses,
    winRate: total > 0 ? wins / total : 0
  };
}

/** Verifica se o símbolo teve algum prejuízo (loss) em scalping no dia atual (UTC) */
export async function hasSymbolLossToday(symbol: string): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const lossToday = await db.tradeSignal.findFirst({
    where: {
      pair: symbol,
      trade_type: 'Scalping',
      outcome: 'LOSS',
      exit_time: { gte: startOfDay }
    },
    select: { id: true }
  });

  return !!lossToday;
}

