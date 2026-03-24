import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

dotenv.config({ path: '.env.production' }); // Certifique-se de que a url do supabase está lá

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('⚠️ CREDENCIAIS SUPABASE NÃO ENCONTRADAS NO .ENV');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const prisma = new PrismaClient({ log: ['warn', 'error'] });

async function migrateData() {
    console.log('🚀 Iniciando Migração: Supabase -> SQLite Local');
    
    // --- 1. Daily Summaries ---
    console.log('\n[1/7] Migrando DailySummaries...');
    const { data: summaries } = await supabase.from('daily_summaries').select('*');
    if (summaries) {
        let count = 0;
        for (const row of summaries) {
            try {
                await prisma.dailySummary.create({
                    data: {
                        id: row.id,
                        summary_date: row.summary_date,
                        total_signals: row.total_signals,
                        winners: row.winners,
                        losers: row.losers,
                        pnl: row.pnl ?? 0,
                        full_report_text: row.full_report_text || '{}',
                        created_at: new Date(row.created_at || Date.now())
                    }
                });
                count++;
            } catch(e) { /* ignore uniqueness constraint errors if running twice */ }
        }
        console.log(`✅ ${count} resumos importados.`);
    }

    // --- 2. Active Signals ---
    console.log('\n[2/7] Migrando ActiveSignals...');
    const { data: activeSigs } = await supabase.from('active_signals').select('*');
    if (activeSigs) {
        let count = 0;
        for (const row of activeSigs) {
            try {
                await prisma.activeSignal.create({
                    data: {
                        id: row.id,
                        pair: row.pair || 'UNKNOWN',
                        type: row.type || 'LONG',
                        trade_type: row.trade_type || 'SWING',
                        entry_range_low: row.entry_range_low ?? 0,
                        entry_range_high: row.entry_range_high ?? 0,
                        stop_loss: row.stop_loss ?? 0,
                        initial_stop_loss: row.initial_stop_loss ?? 0,
                        take_profits: typeof row.take_profits === 'string' ? row.take_profits : JSON.stringify(row.take_profits || []),
                        status: row.status || 'PENDING',
                        telegram_message_id: row.telegram_message_id,
                        expected_duration: row.expected_duration,
                        context: typeof row.context === 'string' ? row.context : JSON.stringify(row.context || {}),
                        score: row.score,
                        created_at: new Date(row.created_at || Date.now()),
                        updated_at: new Date(row.updated_at || Date.now())
                    }
                });
                count++;
            } catch(e) { }
        }
        console.log(`✅ ${count} Active Signals importados.`);
    }

    // --- 3. Trade Signals ---
    console.log('\n[3/7] Migrando TradeSignals...');
    let tradeCount = 0;
    let offset = 0;
    while(true) {
        const { data: tradeSigs } = await supabase.from('trade_signals').select('*').range(offset, offset + 999);
        if (!tradeSigs || tradeSigs.length === 0) break;
        
        for (const row of tradeSigs) {
            try {
                await prisma.tradeSignal.create({
                    data: {
                        id: row.id,
                        pair: row.pair || 'UNKNOWN',
                        type: row.type || 'LONG',
                        trade_type: row.trade_type || 'SWING',
                        entry_range_low: row.entry_range_low ?? 0,
                        entry_range_high: row.entry_range_high ?? 0,
                        stop_loss: row.stop_loss ?? 0,
                        initial_stop_loss: row.initial_stop_loss ?? 0,
                        take_profits: typeof row.take_profits === 'string' ? row.take_profits : JSON.stringify(row.take_profits || []),
                        status: row.status || 'PENDING',
                        confidence: row.confidence,
                        risk_reward: row.risk_reward,
                        indicators: typeof row.indicators === 'string' ? row.indicators : JSON.stringify(row.indicators || {}),
                        ml_data: typeof row.ml_data === 'string' ? row.ml_data : JSON.stringify(row.ml_data || {}),
                        created_at: new Date(row.created_at || Date.now()),
                        updated_at: new Date(row.updated_at || Date.now())
                    }
                });
                tradeCount++;
            } catch(e) { }
        }
        offset += 1000;
    }
    console.log(`✅ ${tradeCount} Trade Signals importados.`);

    // --- 4. Signal Events ---
    console.log('\n[4/7] Migrando SignalEvents...');
    let eventCount = 0;
    offset = 0;
    while(true) {
        const { data: events } = await supabase.from('signal_events').select('*').range(offset, offset + 999);
        if (!events || events.length === 0) break;
        
        for (const row of events) {
            try {
                await prisma.signalEvent.create({
                    data: {
                        id: row.id,
                        signal_id: row.signal_id || 'UNKNOWN',
                        event_type: row.event_type || 'UNKNOWN',
                        message: row.message || '',
                        price_at_event: row.price_at_event ?? 0,
                        created_at: new Date(row.created_at || Date.now()),
                    }
                });
                eventCount++;
            } catch(e) { }
        }
        offset += 1000;
    }
    console.log(`✅ ${eventCount} Signal Events importados.`);

    // --- 5. Push Subscriptions ---
    console.log('\n[5/7] Migrando PushSubscriptions...');
    const { data: subs } = await supabase.from('push_subscriptions').select('*');
    if (subs) {
        let count = 0;
        for (const row of subs) {
            try {
                await prisma.pushSubscription.create({
                    data: {
                        id: row.id,
                        endpoint: row.endpoint,
                        p256dh: row.p256dh,
                        auth: row.auth,
                        created_at: new Date(row.created_at || Date.now())
                    }
                });
                count++;
            } catch(e) { }
        }
        console.log(`✅ ${count} Subs importadas.`);
    }

    // --- 6. ML Training Data ---
    console.log('\n[6/7] Migrando MLTrainingData...');
    let mlCount = 0;
    offset = 0;
    while(true) {
        const { data: mls } = await supabase.from('ml_training_data').select('*').range(offset, offset + 999);
        if (!mls || mls.length === 0) break;
        
        for (const row of mls) {
            try {
                await prisma.mLTrainingData.create({
                    data: {
                        id: row.id,
                        signal_id: row.signal_id || 'UNKNOWN',
                        symbol: row.symbol || 'UNKNOWN',
                        outcome_label: row.outcome_label ?? 0,
                        outcome_pnl: row.outcome_pnl ?? 0,
                        entry_time: row.entry_time || new Date().toISOString(),
                        features: typeof row.features === 'string' ? row.features : JSON.stringify(row.features || {}),
                        created_at: new Date(row.created_at || Date.now())
                    }
                });
                mlCount++;
            } catch(e) { }
        }
        offset += 1000;
    }
    console.log(`✅ ${mlCount} Linhas de ML importadas.`);

    console.log('\n🎉 MIGRAÇÃO CONCLUÍDA! Seu SQLite já possui os dados de nuvem.');
    console.log('Você já pode iniciar a Fase 2 (refatoração dos códigos para ler e escrever pelo Prisma).');
}

migrateData().catch(console.error);
