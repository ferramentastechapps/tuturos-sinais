import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { priceStream, PriceUpdate } from './priceStream.js';
import { db } from '../lib/dbClient.js';
import { sendActivationNotification, sendTrailingStopUpdate, sendTPNotification, sendSLNotification } from '../notifications/telegramService.js';

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
}

export class TradeTracker {
  private activeSignals: Map<string, ActiveSignal[]> = new Map();

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

  public async registerNewSignal(signal: Partial<ActiveSignal>) {
    console.log(`[TradeTracker] Registering new signal for ${signal.pair}...`);
    let fullSignal = signal as ActiveSignal;
    if (!fullSignal.id) {
        fullSignal.id = `${signal.pair}-${Date.now()}`;
    }

    try {
        const inputData = { 
            ...fullSignal, 
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
        console.warn('[TradeTracker] DB Exception. Tracking in RAM only.', e);
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
             // VALIDAÇÃO: Verificar se a direção do sinal ainda é válida
             const isDirectionValid = await this.validateSignalDirection(signal, update.price);
             
             if (!isDirectionValid) {
                 console.log(`[TradeTracker] ⚠️  Signal ${signal.pair} CANCELADO: Direção mudou de ${signal.type.toUpperCase()}`);
                 signal.status = 'CANCELLED';
                 
                 try {
                    await db.activeSignal.update({ 
                        where: { id: signal.id }, 
                        data: { status: 'CANCELLED' } 
                    });
                    this.logEvent(signal.id, 'CANCELLED', `Order cancelled: Direction changed from ${signal.type.toUpperCase()}`, update.price).catch(()=>{});
                 } catch (e) { /* ignore pg error */ }
                 
                 // Notificar cancelamento
                 this.sendCancellationNotification(signal, 'Direção do mercado mudou').catch(e => console.error('TG error', e));
                 
                 // Remover da memória
                 this.removeSignalFromMemory(signal.id, signal.pair);
                 continue;
             }
             
             console.log(`[TradeTracker] Signal ${signal.pair} ACTIVATED at ${update.price}`);
             signal.status = 'ACTIVE';
             
             try {
                await db.activeSignal.update({ where: { id: signal.id }, data: { status: 'ACTIVE' } });
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
    const entryAvg = (signal.entry_range_low + signal.entry_range_high) / 2;
    const trailDistance = Math.abs(signal.take_profits[0].price - entryAvg); // e.g. 1R step
    
    let newSl = signal.stop_loss;
    const tradeDir = signal.type.toUpperCase();
    if (tradeDir === 'LONG') {
      const pendingSl = currentPrice - trailDistance;
      if (pendingSl > signal.stop_loss && currentPrice > signal.take_profits[0].price) {
          // SL lags behind the current price by the trailDistance
          newSl = pendingSl;
      }
    } else {
      const pendingSl = currentPrice + trailDistance;
      if (pendingSl < signal.stop_loss && currentPrice < signal.take_profits[0].price) {
          newSl = pendingSl;
      }
    }

    if (newSl !== signal.stop_loss) {
      const oldSl = signal.stop_loss;
      signal.stop_loss = newSl;
      
      // Update DB safely
      try {
          await db.activeSignal.update({ where: { id: signal.id }, data: { stop_loss: newSl } });
          this.logEvent(signal.id, 'TRAILING_STOP_UPDATED', `Trailing stop moved from ${oldSl} to ${newSl}`, currentPrice).catch(()=>{});
      } catch (e) { /* ignore pg error */ }
      
      // Notify Telegram async
      sendTrailingStopUpdate(signal, currentPrice, oldSl, newSl).catch(e => console.error('TG error', e));
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
      // Primeira vez que bate qualquer TP = WIN
      this.submitFeedbackToML(signal, 1, currentPrice).catch(e => console.error('[TradeTracker] Error saving ML Feedback', e));
      
      // Atualiza o histórico
      db.tradeSignal.update({ where: { id: signal.id }, data: { status: 'CLOSED_TP' } }).catch(({ error }: any) => {
        if (error) console.error('[TradeTracker] Error CLOSED_TP:', error.message);
      });
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

    console.log(`[TradeTracker] SL PnL: ${pnl.toFixed(2)}% - Outcome: ${isWin ? 'WIN' : 'LOSS'}`);

    // ML Feedback Loop
    this.submitFeedbackToML(signal, outcomeLabel, currentPrice).catch(e => console.error('[TradeTracker] Error ML Feedback', e.message));

    // Atualiza o histórico para o robô treinar
    const dbStatus = isWin ? 'CLOSED_TP' : 'CLOSED_SL';
    db.tradeSignal.update({ where: { id: signal.id }, data: { status: dbStatus } }).catch(({ error }: any) => {
      if (error) console.error('[TradeTracker] Error updating status:', error.message);
    });

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
    if (signals.length === 0) {
      this.activeSignals.delete(pair);
      priceStream.unsubscribe(pair);
    } else {
      this.activeSignals.set(pair, signals);
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
      
      // Since ml_data in standard DB schema might only hold predictions, 
      // we could store the actual metrics generated at predictSignal.
      // But for now, we pass score and basic metrics as feature placeholders if missing.
      // E.g., The best place to save full feature vectors is during Signal generation, 
      // but if we store them in `ml_data` we grab them here.
      if (originalSignal.ml_data && typeof originalSignal.ml_data === 'string') {
          try {
            features = JSON.parse(originalSignal.ml_data);
          } catch(e){}
      }

      // Merge base signal info into features 
      features.confidence = originalSignal.confidence;
      features.risk_reward = originalSignal.risk_reward;
      // You can add more features mapped from the original signal here (like indicators)
      
      const entryPrice = (activeSignal.entry_range_low + activeSignal.entry_range_high) / 2;
      const pnl = activeSignal.type === 'LONG' 
        ? ((finalPrice - entryPrice) / entryPrice) * 100 
        : ((entryPrice - finalPrice) / entryPrice) * 100;

      const rowToSave = {
        signal_id: activeSignal.id,
        symbol: activeSignal.pair,
        outcome_label: outcomeLabel,
        outcome_pnl: pnl,
        entry_time: originalSignal.created_at || new Date().toISOString(),
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

  /**
   * Valida se a direção do sinal ainda é válida antes de ativar
   * Retorna true se a direção ainda é válida, false se mudou
   */
  private async validateSignalDirection(signal: ActiveSignal, currentPrice: number): Promise<boolean> {
    try {
      // Buscar dados OHLC atuais para recalcular indicadores
      const { fetchOHLC } = await import('../services/binanceService.js');
      const ohlc = await fetchOHLC(signal.pair, '1h', 100);
      
      if (!ohlc || ohlc.length < 50) {
        console.warn(`[TradeTracker] Não foi possível validar direção de ${signal.pair}: dados insuficientes`);
        return true; // Se não conseguir validar, permite ativar
      }

      const closes = ohlc.map(c => c.close);
      
      // Importar funções de cálculo de indicadores
      const { calculateRSI, calculateEMA } = await import('../indicators/technicalIndicators.js');
      
      const rsi = calculateRSI(closes);
      const ema20 = calculateEMA(closes, 20);
      const ema50 = calculateEMA(closes, 50);
      const ema200 = calculateEMA(closes, 200);
      
      const lastEma20 = ema20[ema20.length - 1] || currentPrice;
      const lastEma50 = ema50[ema50.length - 1] || currentPrice;
      const lastEma200 = ema200[ema200.length - 1] || currentPrice;

      // Contar indicadores bullish e bearish
      let bullishCount = 0;
      let bearishCount = 0;

      if (rsi < 70 && rsi > 30) {
        if (rsi < 45) bearishCount++;
        if (rsi > 55) bullishCount++;
      }
      
      if (currentPrice > lastEma20) bullishCount++; else bearishCount++;
      if (currentPrice > lastEma50) bullishCount++; else bearishCount++;
      if (currentPrice > lastEma200) bullishCount++; else bearishCount++;

      // Determinar direção atual
      const currentDirection = bullishCount >= bearishCount ? 'LONG' : 'SHORT';
      const originalDirection = signal.type.toUpperCase();

      if (currentDirection !== originalDirection) {
        console.log(`[TradeTracker] 🔄 Direção mudou: ${originalDirection} → ${currentDirection} (bull:${bullishCount} bear:${bearishCount})`);
        return false;
      }

      console.log(`[TradeTracker] ✅ Direção validada: ${originalDirection} (bull:${bullishCount} bear:${bearishCount})`);
      return true;

    } catch (error: any) {
      console.error(`[TradeTracker] Erro ao validar direção:`, error.message);
      return true; // Em caso de erro, permite ativar
    }
  }

  /**
   * Envia notificação de cancelamento via Telegram
   */
  private async sendCancellationNotification(signal: ActiveSignal, reason: string) {
    try {
      const { sendTelegramMessage } = await import('../services/telegramService.js');
      
      const message = `
🚫 <b>ORDEM CANCELADA</b>

<b>Par:</b> ${signal.pair}
<b>Tipo:</b> ${signal.type.toUpperCase()}
<b>Motivo:</b> ${reason}

<i>A ordem pendente foi cancelada porque as condições de mercado mudaram.</i>
      `.trim();

      await sendTelegramMessage(message);
    } catch (error: any) {
      console.error('[TradeTracker] Erro ao enviar notificação de cancelamento:', error.message);
    }
  }
}

export const tradeTracker = new TradeTracker();
