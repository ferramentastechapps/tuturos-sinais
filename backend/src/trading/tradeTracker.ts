import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { priceStream, PriceUpdate } from './priceStream.js';
import { db } from '../lib/dbClient.js';
import { sendActivationNotification, sendTrailingStopUpdate, sendTPNotification, sendSLNotification } from '../notifications/telegramService.js';
import { calculateTrailingStop, calculatePartialProfit, formatTrailingStopMessage, shouldNotifyTrailingUpdate, type TrailingStopConfig } from './trailingStopManager.js';
import { bybitConnector } from '../exchange/bybitConnector.js';
import { calculateATR } from '../engine/signalEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TakeProfit {
  price: number;
  hit: boolean;
  level: number;
}

export interface ActiveSignal {
  id: string;
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
  // FASE 2: Campos para trailing stop
  positionRemaining?: number; // % da posição ainda aberta (100 = total)
  lastNotifiedSL?: number; // Último SL notificado (evita spam)
  trailingActive?: boolean; // Se trailing stop está ativo
}

export class TradeTracker {
  private activeSignals: Map<string, ActiveSignal[]> = new Map();
  private activatedSignals: Set<string> = new Set(); // Rastrear sinais já ativados
  private sessionClosedTrades = 0; // Contador de trades finalizados na sessão

  constructor() {
    this.setupListeners();
  }

  public async initialize() {
    console.log('[TradeTracker] Loading active signals from DB...');
    try {
      const data = await db.activeSignal.findMany({
        where: { status: { in: ['ACTIVE', 'PENDING'] } }
      });

      this.activeSignals.clear();
      for (const rawSignal of (data || [])) {
        const signal = {
          ...rawSignal,
          take_profits: typeof rawSignal.take_profits === 'string' ? JSON.parse(rawSignal.take_profits) : rawSignal.take_profits,
          context: typeof rawSignal.context === 'string' ? JSON.parse(rawSignal.context) : rawSignal.context
        } as any as ActiveSignal;
        this.addSignalToMemory(signal);
      }
      console.log(`[TradeTracker] Loaded ${data?.length || 0} active signals.`);
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

    // FASE 2: Inicializar campos de trailing stop
    if (!fullSignal.positionRemaining) {
      fullSignal.positionRemaining = 100; // 100% da posição inicialmente
    }
    if (fullSignal.trailingActive === undefined) {
      fullSignal.trailingActive = false;
    }

    // 0. CANCELAR SINAIS ANTIGOS DA MESMA MOEDA
    await this.cancelOldSignalsForPair(signal.pair!);

    // 1. Save to activeSignal (monitoring/RAM table)
    try {
        const inputData = { 
            id: fullSignal.id,
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
              take_profits: JSON.parse(data.take_profits)
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

    for (const signal of signals) {
      if (signal.status === 'PENDING') {
         // Activate only when price enters the defined entry zone
         const isEntered = update.price >= signal.entry_range_low && update.price <= signal.entry_range_high;

         if (isEntered) {
             // Verificar se já foi ativado (evitar duplicatas)
             if (this.activatedSignals.has(signal.id)) {
                 continue; // Já foi ativado, pular
             }
             
             console.log(`[TradeTracker] Signal ${signal.pair} ACTIVATED at ${update.price}`);
             signal.status = 'ACTIVE';
             
             // Marcar como ativado ANTES de enviar notificação
             this.activatedSignals.add(signal.id);
             
             try {
                await db.activeSignal.update({ where: { id: signal.id }, data: { status: 'ACTIVE' } });
                await db.tradeSignal.update({ where: { id: signal.id }, data: { entry_time: new Date() } }); // SALVAR ENTRY_TIME
                this.logEvent(signal.id, 'ACTIVATED', `Order activated at ${update.price}`, update.price).catch(()=>{});
             } catch (e) { /* ignore pg error */ }
             
             sendActivationNotification(signal, update.price).catch(e => console.error('TG error', e));
             
             // Wait for the next price tick before checking SL/TP to avoid same-tick double-processing
             continue;
         } else {
             continue; // Wait for activation
         }
      }

      if (signal.status !== 'ACTIVE') continue;

      // Check Stop Loss
      const tradeDir = signal.type.toUpperCase();
      const isSLHit = tradeDir === 'LONG' 
        ? update.price <= signal.stop_loss 
        : update.price >= signal.stop_loss;

      if (isSLHit) {
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
      if (tp1 && tp1.hit && !hitAnyTP && signal.status === 'ACTIVE') {
         await this.processTrailingStop(signal, update.price);
      }
    }
  }

  private async processTrailingStop(signal: ActiveSignal, currentPrice: number) {
    // FASE 2: Integração com trailingStopManager
    
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
        
        console.log(`[TradeTracker] ${signal.pair} SL atualizado: ${oldSL.toFixed(2)} → ${result.newStopLoss.toFixed(2)}`);
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
        sendTrailingStopUpdate(signal, currentPrice, oldSL, result.newStopLoss, message).catch(e =>
          console.error('[TradeTracker] TG error', e)
        );
      }
    }
  }

  private async handleTakeProfit(signal: ActiveSignal, tp: TakeProfit, currentPrice: number) {
    console.log(`[TradeTracker] TP${tp.level} hit for ${signal.pair} at ${currentPrice}`);
    tp.hit = true;

    // Determine Breakeven / New SL
    let oldSl = signal.stop_loss;
    const entryAvg = (signal.entry_range_low + signal.entry_range_high) / 2;
    
    if (tp.level === 1) {
      // Move to breakeven após TP1
      signal.stop_loss = signal.type.toUpperCase() === 'LONG' 
        ? Math.max(signal.stop_loss, entryAvg)
        : Math.min(signal.stop_loss, entryAvg);
    }

    // Qualquer TP batido já é WIN para o ML
    // Mesmo que não bata todos os TPs, já garantiu lucro
    const isFirstTP = !signal.take_profits.slice(0, signal.take_profits.indexOf(tp)).some(t => t.hit);
    
    if (isFirstTP) {
      this.sessionClosedTrades++;
      console.log(`[TradeTracker] Trade #${this.sessionClosedTrades} fechou com WIN (${signal.pair})`);
      
      // Primeira vez que bate qualquer TP = WIN
      this.submitFeedbackToML(signal, 1, currentPrice).catch(e => console.error('[TradeTracker] Error saving ML Feedback', e));
      
      const pnl = signal.type === 'LONG' 
        ? ((currentPrice - entryAvg) / entryAvg) * 100 
        : ((entryAvg - currentPrice) / entryAvg) * 100;

      // Upsert no histórico (upsert garante que funciona mesmo se o registro não existia)
      db.tradeSignal.upsert({
        where: { id: signal.id },
        update: { 
          status: 'CLOSED_TP',
          take_profits: JSON.stringify(signal.take_profits || []),
          stop_loss: signal.stop_loss,
          pnl: pnl,
          outcome: 'WIN',
          exit_time: new Date()
        },
        create: {
          id: signal.id,
          pair: signal.pair,
          type: signal.type.toLowerCase(),
          trade_type: signal.trade_type || 'Scalping',
          entry_range_low: signal.entry_range_low,
          entry_range_high: signal.entry_range_high,
          stop_loss: signal.stop_loss,
          initial_stop_loss: signal.initial_stop_loss,
          take_profits: JSON.stringify(signal.take_profits || []),
          status: 'CLOSED_TP',
          confidence: signal.score ?? null,
          indicators: signal.indicators ? JSON.stringify(signal.indicators) : null,
          ml_data: signal.mlData ? JSON.stringify(signal.mlData) : null,
          pnl: pnl,
          outcome: 'WIN',
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

    // Save to DB Safely
    try {
        await db.activeSignal.update({
          where: { id: signal.id },
          data: {
            take_profits: JSON.stringify(signal.take_profits),
            stop_loss: signal.stop_loss,
            status: signal.status
          }
        });
        this.logEvent(signal.id, 'TP_HIT', `TP${tp.level} hit at ${currentPrice}`, currentPrice).catch(()=>{});
    } catch (e) { /* ignore */ }

    // Notify
    sendTPNotification(signal, tp, currentPrice).catch(e => console.error('TG error', e));
  }

  private async handleStopLoss(signal: ActiveSignal, currentPrice: number) {
    console.log(`[TradeTracker] SL hit for ${signal.pair} at ${currentPrice}`);
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

    // Upsert no histórico (upsert garante que funciona mesmo se o registro não existia)
    const dbStatus = isWin ? 'CLOSED_TP' : 'CLOSED_SL';
    db.tradeSignal.upsert({
      where: { id: signal.id },
      update: { 
        status: dbStatus,
        stop_loss: signal.stop_loss,
        take_profits: JSON.stringify(signal.take_profits || []),
        pnl: pnl,
        outcome: isWin ? 'WIN' : 'LOSS',
        exit_time: new Date()
      },
      create: {
        id: signal.id,
        pair: signal.pair,
        type: signal.type.toLowerCase(),
        trade_type: signal.trade_type || 'Scalping',
        entry_range_low: signal.entry_range_low,
        entry_range_high: signal.entry_range_high,
        stop_loss: signal.stop_loss,
        initial_stop_loss: signal.initial_stop_loss,
        take_profits: JSON.stringify(signal.take_profits || []),
        status: dbStatus,
        confidence: signal.score ?? null,
        indicators: signal.indicators ? JSON.stringify(signal.indicators) : null,
        ml_data: signal.mlData ? JSON.stringify(signal.mlData) : null,
        pnl: pnl,
        outcome: isWin ? 'WIN' : 'LOSS',
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

    sendSLNotification(signal, currentPrice).catch(e => console.error('TG error', e));
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
        features: features
      };

      // 2. Insert into training table
      const dbRowSave = {
        ...rowToSave,
        features: JSON.stringify(features)
      };
      
      let insertErr: any = null;
      try {
        await db.mLTrainingData.create({ data: dbRowSave as any });
      } catch (err: any) {
        insertErr = err;
      }

      // 3. Keep local JSONL updated for VPS local training
      try {
        const dataPath = path.join(__dirname, '../../../ml_engine/data/historical_ml_data.jsonl');
        fs.appendFileSync(dataPath, JSON.stringify(rowToSave) + '\n', 'utf-8');
      } catch (err) {
        console.error(`[TradeTracker] Failed to append ML data locally:`, err);
      }

      if (insertErr) {
        console.error(`[TradeTracker] Failed to insert ML Feedback:`, insertErr);
      } else {
        console.log(`[TradeTracker] ML Feedback Saved Successfully (Supabase + Local JSONL)!`);
        // Retreinamento agora é feito diariamente às 23:55 UTC via mlRetrainJob
      }
    } catch (err) {
      console.error(`[TradeTracker] Unhandled error submitting ML feedback:`, err);
    }
  }

  // Retreinamento agora é gerenciado pelo mlRetrainJob (diário às 23:55 UTC)

}

export const tradeTracker = new TradeTracker();
