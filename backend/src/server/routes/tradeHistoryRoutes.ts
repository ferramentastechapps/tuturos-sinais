import { Router, Request, Response } from 'express';
import { db } from '../../lib/dbClient.js';
import { logger } from '../../lib/logger.js';

const router = Router();
const ADMIN_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

router.get('/', async (req: Request, res: Response) => {
    try {
        const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string) || ADMIN_USER_ID;
        const data = await db.userTrade.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' }
        });

        res.json(data);
    } catch (error: any) {
        logger.error('Error fetching user trades', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req: Request, res: Response) => {
    try {
        const userId = (req.headers['x-user-id'] as string) || req.body.userId || ADMIN_USER_ID;
        const trade = { ...req.body, user_id: userId };
        delete trade.id; // Let DB generate ID

        const data = await db.userTrade.create({
            data: trade
        });

        res.json(data);
    } catch (error: any) {
        logger.error('Error creating user trade', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id/close', async (req: Request, res: Response) => {
    try {
        const { exit_price, exit_fee } = req.body;
        const data = await db.userTrade.update({
            where: { id: req.params.id as string },
            data: { 
                exit_price, 
                exit_fee, 
                status: 'closed', 
                closed_at: new Date()
            }
        });

        res.json(data);
        res.json(data);
    } catch (error: any) {
        logger.error('Error closing user trade', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await db.userTrade.delete({
            where: { id: req.params.id as string }
        });
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error deleting user trade', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
