import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { priceStream, PriceUpdate } from './priceStream.js';
import { supabase } from '../lib/supabaseClient.js';
import { sendTPNotification, sendSLNotification, sendTrailingStopUpdate, sendActivationNotification } from '../notifications/telegramService.js';

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
    const { data, error } = await supabase
      .from('active_signals')
      .select('*')
      .in('status', ['ACTIVE', 'PENDING']);

    if (error) {
      console.error('[TradeTracker] Failed to load signals', error);
      return;
    }

    this.activeSignals.clear();
    for (const signal of (data || [])) {
      this.addSignalToMemory(signal as any as ActiveSignal);
    }
    console.log(`[TradeTracker] Loaded ${data?.length || 0} active signals.`);
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
        const { data, error } = await supabase.from('active_signals').insert([signal]).select().single();
        if (error) {
            console.warn('[TradeTracker] Supabase warn (Table missing?). Tracking in RAM only.', error.message);
        } else if (data) {
            fullSignal = data as any as ActiveSignal;
        }
    } catch (e) {
        console.warn('[TradeTracker] Supabase Exception. Tracking in RAM only.');
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
         // Check if price reached the entry zone or crossed it
         const isEntered = update.price >= signal.entry_range_low && update.price <= signal.entry_range_high;
         const tradeDir = signal.type.toUpperCase();
         const isCrossedLong = tradeDir === 'LONG' && update.price < signal.entry_range_low;
         const isCrossedShort = tradeDir === 'SHORT' && update.price > signal.entry_range_high;

         if (isEntered || isCrossedLong || isCrossedShort) {
             console.log(`[TradeTracker] Signal ${signal.pair} ACTIVATED at ${update.price}`);
             signal.status = 'ACTIVE';
             
             try {
                await supabase.from('active_signals').update({ status: 'ACTIVE' }).eq('id', signal.id);
                this.logEvent(signal.id, 'ACTIVATED', `Order activated at ${update.price}`, update.price).catch(()=>{});
             } catch (e) { /* ignore pg error */ }
             
             sendActivationNotification(signal, update.price).catch(e => console.error('TG error', e));
             
             // Fall through to allow immediate initial TP/SL check if necessary
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
          await supabase.from('active_signals').update({ stop_loss: newSl }).eq('id', signal.id);
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
      // Move to breakeven
      signal.stop_loss = signal.type.toUpperCase() === 'LONG' 
        ? Math.max(signal.stop_loss, entryAvg)
        : Math.min(signal.stop_loss, entryAvg);
    }

    // Is it fully closed?
    const allHit = signal.take_profits.every(t => t.hit);
    if (allHit) {
      signal.status = 'CLOSED_TP';
      this.removeSignalFromMemory(signal.id, signal.pair);
      
      // ML Feedback Loop - Win
      this.submitFeedbackToML(signal, 1, currentPrice).catch(e => console.error('[TradeTracker] Error saving ML Feedback', e));

      // Atualiza o histórico para o robô treinar
      supabase.from('trade_signals').update({ status: 'hit_tp' }).eq('id', signal.id).then(({ error }) => {
        if (error) console.error('[TradeTracker] Error hit_tp:', error.message);
      });
    }

    // Save to DB Safely
    try {
        await supabase.from('active_signals').update({
        take_profits: signal.take_profits as any,
        stop_loss: signal.stop_loss,
        status: signal.status
        }).eq('id', signal.id);
        this.logEvent(signal.id, 'TP_HIT', `TP${tp.level} hit at ${currentPrice}`, currentPrice).catch(()=>{});
    } catch (e) { /* ignore */ }

    // Notify
    sendTPNotification(signal, tp, currentPrice).catch(e => console.error('TG error', e));
  }

  private async handleStopLoss(signal: ActiveSignal, currentPrice: number) {
    console.log(`[TradeTracker] SL hit for ${signal.pair} at ${currentPrice}`);
    signal.status = 'CLOSED_SL';
    
    this.removeSignalFromMemory(signal.id, signal.pair);

    // ML Feedback Loop - Loss
    this.submitFeedbackToML(signal, 0, currentPrice).catch(e => console.error('[TradeTracker] Error ML Feedback', e.message));

    // Atualiza o histórico para o robô treinar
    supabase.from('trade_signals').update({ status: 'hit_sl' }).eq('id', signal.id).then(({ error }) => {
      if (error) console.error('[TradeTracker] Error hit_sl:', error.message);
    });

    try {
        await supabase.from('active_signals').update({
            status: signal.status
        }).eq('id', signal.id);
        this.logEvent(signal.id, 'SL_HIT', `Stop Loss hit at ${currentPrice}`, currentPrice).catch(()=>{});
    } catch (e) { /* skip */ }

    sendSLNotification(signal, currentPrice).catch(e => console.error('TG error', e));
  }

  private async logEvent(signalId: string, eventType: string, message: string, price: number) {
    await supabase.from('signal_events').insert({
      signal_id: signalId,
      event_type: eventType,
      message,
      price_at_event: price
    });
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
      const { data: originalSignal, error: fetchErr } = await supabase
        .from('trade_signals')
        .select('*')
        .eq('id', activeSignal.id)
        .single();

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
      if (originalSignal.ml_data && typeof originalSignal.ml_data === 'object') {
          features = { ...originalSignal.ml_data };
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
      const { error: insertErr } = await supabase.from('ml_training_data').insert(rowToSave);

      // 3. Keep local JSONL updated for VPS local training
      try {
        const dataPath = path.join(__dirname, '../../../../ml_engine/data/historical_ml_data.jsonl');
        fs.appendFileSync(dataPath, JSON.stringify(rowToSave) + '\n', 'utf-8');
      } catch (err) {
        console.error(`[TradeTracker] Failed to append ML data locally:`, err);
      }

      if (insertErr) {
        console.error(`[TradeTracker] Failed to insert ML Feedback:`, insertErr);
      } else {
        console.log(`[TradeTracker] ML Feedback Saved Successfully (Supabase + Local JSONL)!`);
      }
    } catch (err) {
      console.error(`[TradeTracker] Unhandled error submitting ML feedback:`, err);
    }
  }
}

export const tradeTracker = new TradeTracker();
