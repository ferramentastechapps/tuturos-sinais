import { supabase } from '@/integrations/supabase/client';
import { MLModelArtifact, MLTrainingSample } from '@/types/mlTypes';

// ---- Models ----

export const saveModel = async (model: MLModelArtifact): Promise<{ error: any }> => {
    const { error } = await supabase
        .from('ml_models')
        .insert({
            id: model.id,
            version: model.version,
            type: model.type,
            data: model.data,
            metrics: model.metrics as any, // Cast to JSON
            is_active: model.isActive,
        });

    return { error };
};

export const getActiveModel = async (): Promise<{ model: MLModelArtifact | null, error: any }> => {
    const { data, error } = await supabase
        .from('ml_models')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) return { model: null, error };

    const model: MLModelArtifact = {
        id: data.id,
        version: data.version,
        type: data.type as any,
        metrics: data.metrics as any,
        isActive: data.is_active,
        data: data.data,
        createdAt: new Date(data.created_at).getTime(),
    };

    return { model, error: null };
};

// ---- Training Data ----

export const saveTrainingData = async (samples: MLTrainingSample[]): Promise<{ count: number, error: any }> => {
    if (!samples.length) return { count: 0, error: null };

    // Transform to DB format
    const rows = samples.map(s => ({
        signal_id: s.signalId,
        symbol: s.symbol,
        features: s.features as any,
        outcome_label: s.label,
        outcome_pnl: s.pnl || 0,
        entry_time: new Date(s.timestamp).toISOString(),
        // user_id is handled by RLS defaults usually but strict requires it on insert if not auth context?
        // Supabase client handles auth context automatically.
    }));

    const { error, count } = await supabase
        .from('ml_training_data')
        .insert(rows)
        .select('id', { count: 'exact' });

    return { count: count || 0, error };
};

export const fetchTrainingData = async (limit = 1000): Promise<{ samples: MLTrainingSample[], error: any }> => {
    const { data, error } = await supabase
        .from('ml_training_data')
        .select('*')
        .order('entry_time', { ascending: false })
        .limit(limit);

    if (error || !data) return { samples: [], error };

    const samples: MLTrainingSample[] = data.map(row => ({
        id: row.id,
        signalId: row.signal_id,
        symbol: row.symbol,
        features: row.features as any,
        label: row.outcome_label as 0 | 1,
        pnl: Number(row.outcome_pnl),
        timestamp: new Date(row.entry_time).getTime(),
    }));

    return { samples, error: null };
};
