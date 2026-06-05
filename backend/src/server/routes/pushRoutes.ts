import { Router, Request, Response } from 'express';
import { db } from '../../lib/dbClient.js';
import { logger } from '../../lib/logger.js';
import { sendPushNotification } from '../../notifications/pushService.js';

const router = Router();

// Retrieve public tracking key for frontend
router.get('/vapid-public-key', (req: Request, res: Response) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

// Subscribe device endpoint
router.post('/subscribe', async (req: Request, res: Response) => {
    try {
        const subscription = req.body;
        
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            res.status(400).json({ error: 'Invalid subscription object' });
            return;
        }

        // Check if subscription already exists
        const existing = await db.pushSubscription.findUnique({
            where: { endpoint: subscription.endpoint },
            select: { id: true }
        });

        if (!existing) {
            // Register new subscription in DB
            try {
                await db.pushSubscription.create({
                    data: {
                        endpoint: subscription.endpoint,
                        p256dh: subscription.keys.p256dh,
                        auth: subscription.keys.auth,
                        created_at: new Date()
                    }
                });
            } catch (error) {
                logger.error('Error saving subscription to DB', { error });
                res.status(500).json({ error: 'Database error' });
                return;
            }
            logger.info('New push subscription registered.');
        }

        res.status(201).json({ success: true, message: 'Subscription saved' });
        
        // Send a welcome notification
        if (!existing) {
            await sendPushNotification(subscription, {
                title: 'Certeiro TA Sinais Cripto Pro',
                body: 'Notificações ativadas com sucesso. Você receberá os trades em tempo real!',
                icon: '/icon.svg',
                data: { url: '/' }
            });
        }
    } catch (error) {
        logger.error('Error handling subscription', { error });
        res.status(500).json({ error: 'Server error' });
    }
});

// Unsubscribe device
router.post('/unsubscribe', async (req: Request, res: Response) => {
    try {
        const { endpoint } = req.body;
        
        if (!endpoint) {
            res.status(400).json({ error: 'Endpoint is required' });
            return;
        }

        await db.pushSubscription.delete({
            where: { endpoint: endpoint }
        });

        logger.info('Push subscription removed.');
        res.status(200).json({ success: true, message: 'Unsubscribed' });
    } catch (error) {
        logger.error('Error removing subscription', { error });
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
