import { toast } from '@/components/ui/use-toast';

export const PUSH_NOTIFICATION_VAPID_URL = '/api/push/vapid-public-key';
export const PUSH_SUBSCRIBE_URL = '/api/push/subscribe';
export const PUSH_UNSUBSCRIBE_URL = '/api/push/unsubscribe';

const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

export const registerPushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push VAPID notifications are not supported by the browser.');
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            toast({
                title: 'Permissão Negada',
                description: 'Você precisa permitir notificações para receber alertas.',
                variant: 'destructive',
            });
            return false;
        }

        // Check if already subscribed
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
            console.log('Already subscribed to push notifications');
            return true;
        }

        // Fetch public key
        const response = await fetch(PUSH_NOTIFICATION_VAPID_URL);
        if (!response.ok) throw new Error('Não foi possível obter chave VAPID.');

        const { publicKey } = await response.json();
        const convertedVapidKey = urlBase64ToUint8Array(publicKey);

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey,
        });

        const saveResponse = await fetch(PUSH_SUBSCRIBE_URL, {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!saveResponse.ok) {
            throw new Error('Falha ao salvar a inscrição no servidor.');
        }

        toast({
            title: 'Notificações Ativadas',
            description: 'Você receberá os sinais ao vivo em seu dispositivo!',
        });

        return true;
    } catch (error: any) {
        console.error('Error during push registration:', error);
        toast({
            title: 'Erro ao assinar Push',
            description: error.message || 'Houve um erro conectando ao serviço de notificações.',
            variant: 'destructive',
        });
        return false;
    }
};

export const unsubscribePushNotifications = async () => {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await fetch(PUSH_UNSUBSCRIBE_URL, {
                method: 'POST',
                body: JSON.stringify({ endpoint: subscription.endpoint }),
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            await subscription.unsubscribe();

            toast({
                title: 'Notificações Desativadas',
                description: 'Inscrição removida com sucesso.',
            });
        }
        return true;
    } catch (error) {
        console.error('Error during push unregistration:', error);
        return false;
    }
};
