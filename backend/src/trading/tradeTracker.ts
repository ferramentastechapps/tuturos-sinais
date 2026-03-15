import { priceStream, PriceUpdate } from './priceStream';
import { supabase } from '../lib/supabaseClient';
import { sendTPNotification, sendSLNotification, sendTrailingStopUpdate } from '../notifications/telegramService';

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
      .eq('status', 'ACTIVE');

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
    // Inserts into DB then tracks
    const { data, error } = await supabase.from('active_signals').insert([signal]).select().single();
    if (error) {
      console.error('[TradeTracker] Error inserting new signal DB', error);
      return null;
    }
    const fullSignal = data as any as ActiveSignal;
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
      if (signal.status !== 'ACTIVE') continue;

      // Check Stop Loss
      const isSLHit = signal.type === 'LONG' 
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

        const isTPHit = signal.type === 'LONG'
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
         this.processTrailingStop(signal, update.price);
      }
    }
  }

  private async processTrailingStop(signal: ActiveSignal, currentPrice: number) {
    const entryAvg = (signal.entry_range_low + signal.entry_range_high) / 2;
    const trailDistance = Math.abs(signal.take_profits[0].price - entryAvg); // e.g. 1R step
    
    let newSl = signal.stop_loss;
    if (signal.type === 'LONG') {
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
      await supabase.from('active_signals').update({ stop_loss: newSl }).eq('id', signal.id);
      await this.logEvent(signal.id, 'TRAILING_STOP_UPDATED', `Trailing stop moved from ${oldSl} to ${newSl}`, currentPrice);
      
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
      signal.stop_loss = signal.type === 'LONG' 
        ? Math.max(signal.stop_loss, entryAvg)
        : Math.min(signal.stop_loss, entryAvg);
    }

    // Is it fully closed?
    const allHit = signal.take_profits.every(t => t.hit);
    if (allHit) {
      signal.status = 'CLOSED_TP';
      this.removeSignalFromMemory(signal.id, signal.pair);
    }

    // Save to DB
    await supabase.from('active_signals').update({
      take_profits: signal.take_profits as any,
      stop_loss: signal.stop_loss,
      status: signal.status
    }).eq('id', signal.id);

    await this.logEvent(signal.id, 'TP_HIT', `TP${tp.level} hit at ${currentPrice}`, currentPrice);

    // Notify
    sendTPNotification(signal, tp, currentPrice).catch(e => console.error('TG error', e));
  }

  private async handleStopLoss(signal: ActiveSignal, currentPrice: number) {
    console.log(`[TradeTracker] SL hit for ${signal.pair} at ${currentPrice}`);
    signal.status = 'CLOSED_SL';
    
    this.removeSignalFromMemory(signal.id, signal.pair);

    await supabase.from('active_signals').update({
      status: signal.status
    }).eq('id', signal.id);

    await this.logEvent(signal.id, 'SL_HIT', `Stop Loss hit at ${currentPrice}`, currentPrice);

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
}

export const tradeTracker = new TradeTracker();
