import webpush from 'web-push';
import { db } from '../lib/dbClient.js';
import { logger } from '../lib/logger.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@ftech-apps.com.br';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        VAPID_SUBJECT,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
    logger.info('VAPID Web Push configured successfully.');
} else {
    logger.warn('VAPID keys not found. Web Push notifications will be disabled.');
}

/**
 * Sends a push notification to a specific subscription
 */
export const sendPushNotification = async (subscription: webpush.PushSubscription, payload: any) => {
    if (!VAPID_PUBLIC_KEY) return false;

    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        return true;
    } catch (error: any) {
        if (error.statusCode === 404 || error.statusCode === 410) {
            // Subscription has expired or is no longer valid
            logger.warn('Push subscription expired/invalid. Removing from database.', { endpoint: subscription.endpoint });
            await db.pushSubscription.delete({ where: { endpoint: subscription.endpoint } }).catch(()=>{});
        } else {
            logger.error('Error sending push notification', { error: error.message });
        }
        return false;
    }
};

/**
 * Broadcasts a push notification to all subscribed devices
 */
export const broadcastPushNotification = async (payload: { title: string; body: string; icon?: string; badge?: string; data?: any }) => {
    if (!VAPID_PUBLIC_KEY) return;

    try {
        let subscriptions: any[] = [];
        try {
            subscriptions = await db.pushSubscription.findMany();
        } catch (error: any) {
            // Table doesn't exist yet — silently skip, don't throw
            logger.warn('Push subscriptions table not available, skipping broadcast', { error: error.message });
            return;
        }

        if (!subscriptions || subscriptions.length === 0) {
            return;
        }

        const validPayload = {
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/icon.svg',
            badge: payload.badge || '/icon.svg',
            data: payload.data || { url: '/' }
        };

        const promises = subscriptions.map((sub) => {
            const pushSub: webpush.PushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };
            return sendPushNotification(pushSub, validPayload);
        });

        const results = await Promise.allSettled(promises);
        const successes = results.filter(r => r.status === 'fulfilled' && r.value).length;
        
        logger.info(`Broadcasted push notification to ${successes}/${subscriptions.length} devices.`);
    } catch (error: any) {
        logger.error('Failed to broadcast push notification', { error: error.message });
    }
};
