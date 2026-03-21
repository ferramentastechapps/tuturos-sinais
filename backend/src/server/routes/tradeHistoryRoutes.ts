import { Router, Request, Response } from 'express';
import { supabase } from '../../lib/supabaseClient.js';
import { logger } from '../../lib/logger.js';

const router = Router();
const ADMIN_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

router.get('/', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] || req.query.userId || ADMIN_USER_ID;
        const { data, error } = await supabase
            .from('user_trades')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        logger.error('Error fetching user trades', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] || req.body.userId || ADMIN_USER_ID;
        const trade = { ...req.body, user_id: userId };
        delete trade.id; // Let DB generate ID

        const { data, error } = await supabase
            .from('user_trades')
            .insert(trade)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        logger.error('Error creating user trade', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id/close', async (req: Request, res: Response) => {
    try {
        const { exit_price, exit_fee } = req.body;
        const { data, error } = await supabase
            .from('user_trades')
            .update({ 
                exit_price, 
                exit_fee, 
                status: 'closed', 
                closed_at: new Date().toISOString() 
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        logger.error('Error closing user trade', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { error } = await supabase
            .from('user_trades')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error deleting user trade', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
