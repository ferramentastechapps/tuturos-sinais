import { Router, Request, Response } from 'express';
import { supabase } from '../../lib/supabaseClient.js';
import { logger } from '../../lib/logger.js';

const router = Router();
const ADMIN_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"; // Fallback to frontend's admin UUID

router.get('/assets', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] || req.query.userId || ADMIN_USER_ID;
        const { data, error } = await supabase
            .from('portfolio_assets')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        logger.error('Error fetching portfolio assets', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.post('/assets', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] || req.body.userId || ADMIN_USER_ID;
        const { symbol, name, quantity, average_buy_price, total_fees } = req.body;

        const { data, error } = await supabase
            .from('portfolio_assets')
            .upsert({ 
                user_id: userId,
                symbol,
                name,
                quantity,
                average_buy_price,
                total_fees,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, symbol' })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        logger.error('Error updating portfolio asset', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.delete('/assets/:id', async (req: Request, res: Response) => {
    try {
        const { error } = await supabase
            .from('portfolio_assets')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error deleting portfolio asset', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
