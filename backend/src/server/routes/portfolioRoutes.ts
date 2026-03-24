import { Router, Request, Response } from 'express';
import { db } from '../../lib/dbClient.js';
import { logger } from '../../lib/logger.js';

const router = Router();
const ADMIN_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"; // Fallback to frontend's admin UUID

router.get('/assets', async (req: Request, res: Response) => {
    try {
        const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string) || ADMIN_USER_ID;
        const data = await db.portfolioAsset.findMany({
            where: { user_id: userId }
        });
        res.json(data);
    } catch (error: any) {
        logger.error('Error fetching portfolio assets', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.post('/assets', async (req: Request, res: Response) => {
    try {
        const userId = (req.headers['x-user-id'] as string) || req.body.userId || ADMIN_USER_ID;
        const { symbol, name, quantity, average_buy_price, total_fees } = req.body;

        const data = await db.portfolioAsset.upsert({
            where: {
                user_id_symbol: { user_id: userId, symbol: symbol }
            },
            update: {
                name, quantity, average_buy_price, total_fees, updated_at: new Date()
            },
            create: {
                user_id: userId, symbol, name, quantity, average_buy_price, total_fees
            }
        });
        res.json(data);
    } catch (error: any) {
        logger.error('Error updating portfolio asset', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.delete('/assets/:id', async (req: Request, res: Response) => {
    try {
        await db.portfolioAsset.delete({
            where: { id: req.params.id as string }
        });
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error deleting portfolio asset', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
