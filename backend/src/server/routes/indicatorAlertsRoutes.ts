import { Router, Request, Response } from 'express';
import { db } from '../../lib/dbClient.js';
import { logger } from '../../lib/logger.js';

const router = Router();
const ADMIN_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

router.get('/', async (req: Request, res: Response) => {
    try {
        const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string) || ADMIN_USER_ID;
        const data = await db.indicatorAlert.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            take: 100
        });
        res.json(data);
    } catch (error: any) {
        logger.error('Error fetching alerts', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req: Request, res: Response) => {
    try {
        const userId = (req.headers['x-user-id'] as string) || req.body.userId || ADMIN_USER_ID;
        const alert = { ...req.body, user_id: userId };
        delete alert.id; 

        const data = await db.indicatorAlert.create({
            data: alert
        });
        res.json(data);
    } catch (error: any) {
        logger.error('Error creating indicator alert', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id/read', async (req: Request, res: Response) => {
    try {
        await db.indicatorAlert.update({
            where: { id: req.params.id as string },
            data: { read: true }
        });
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error marking alert as read', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.put('/read-all', async (req: Request, res: Response) => {
    try {
        const userId = (req.headers['x-user-id'] as string) || req.body.userId || ADMIN_USER_ID;
        await db.indicatorAlert.updateMany({
            where: { user_id: userId, read: false },
            data: { read: true }
        });
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error marking all alerts as read', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await db.indicatorAlert.delete({
            where: { id: req.params.id as string }
        });
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error deleting alert', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.delete('/', async (req: Request, res: Response) => {
    try {
        const userId = (req.headers['x-user-id'] as string) || req.body.userId || ADMIN_USER_ID;
        await db.indicatorAlert.deleteMany({
            where: { user_id: userId }
        });
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Error clearing alerts', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Config endpoints
router.get('/config', async (req: Request, res: Response) => {
    try {
        const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string) || ADMIN_USER_ID;
        // First try to fetch
        let data = await db.indicatorAlertConfig.findUnique({
            where: { user_id: userId }
        });

        if (!data) {
            data = await db.indicatorAlertConfig.create({
                data: { user_id: userId }
            });
        }

        res.json(data);
    } catch (error: any) {
        logger.error('Error fetching indicator config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

router.put('/config', async (req: Request, res: Response) => {
    try {
        const userId = (req.headers['x-user-id'] as string) || req.body.userId || ADMIN_USER_ID;
        
        let updateData = { ...req.body };
        delete updateData.id;
        delete updateData.user_id;
        delete updateData.created_at;
        updateData.updated_at = new Date().toISOString();

        const data = await db.indicatorAlertConfig.update({
            where: { user_id: userId },
            data: updateData
        });
        res.json(data);
    } catch (error: any) {
        logger.error('Error updating indicator config', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
