import { Router, Request, Response } from 'express';
import { supabase } from '../../lib/supabaseClient.js';
import { logger } from '../../lib/logger.js';

const router = Router();
const ADMIN_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

router.get('/', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] || req.query.userId || ADMIN_USER_ID;
        const { data, error } = await supabase
            .from('indicator_alerts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        logger.error('Error fetching alerts', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] || req.body.userId || ADMIN_USER_ID;
        const alert = { ...req.body, user_id: userId };
        delete alert.id; 

        const { data, error } = await supabase
            .from('indicator_alerts')
            .insert(alert)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        logger.error('Error creating indicator alert', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id/read', async (req: Request, res: Response) => {
    try {
        const { error } = await supabase
            .from('indicator_alerts')
            .update({ read: true })
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error marking alert as read', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.put('/read-all', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] || req.body.userId || ADMIN_USER_ID;
        const { error } = await supabase
            .from('indicator_alerts')
            .update({ read: true })
            .eq('user_id', userId)
            .eq('read', false);

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error marking all alerts as read', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { error } = await supabase
            .from('indicator_alerts')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error deleting alert', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.delete('/', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] || req.body.userId || ADMIN_USER_ID;
        const { error } = await supabase
            .from('indicator_alerts')
            .delete()
            .eq('user_id', userId);

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error clearing alerts', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Config endpoints
router.get('/config', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] || req.query.userId || ADMIN_USER_ID;
        // First try to fetch
        let { data, error } = await supabase
            .from('indicator_alert_config')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // Allow Not Found

        if (!data) {
            // Need to insert default
            const { data: newData, error: insertError } = await supabase
                .from('indicator_alert_config')
                .insert({ user_id: userId })
                .select()
                .single();
                
            if (insertError) throw insertError;
            data = newData;
        }

        res.json(data);
    } catch (error: any) {
        logger.error('Error fetching indicator config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.put('/config', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] || req.body.userId || ADMIN_USER_ID;
        
        let updateData = { ...req.body };
        delete updateData.id;
        delete updateData.user_id;
        delete updateData.created_at;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('indicator_alert_config')
            .update(updateData)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        logger.error('Error updating indicator config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
