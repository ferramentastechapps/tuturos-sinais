// WebSocket Server — Real-time data channels for the dashboard

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { logger } from '../lib/logger.js';

export type WsChannel = 'signals' | 'positions' | 'prices' | 'alerts' | 'portfolio';

interface WsClient {
    ws: WebSocket;
    channels: Set<WsChannel>;
    id: string;
}

let wss: WebSocketServer | null = null;
const clients: Map<string, WsClient> = new Map();
let clientIdCounter = 0;

export function initWebSocketServer(server: Server): WebSocketServer {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws: WebSocket) => {
        const id = `client-${++clientIdCounter}`;
        const client: WsClient = { ws, channels: new Set(['signals', 'prices', 'alerts']), id };
        clients.set(id, client);

        logger.info(`WebSocket client connected: ${id}`);

        ws.on('message', (data: Buffer) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'subscribe' && msg.channel) {
                    client.channels.add(msg.channel as WsChannel);
                    ws.send(JSON.stringify({ type: 'subscribed', channel: msg.channel }));
                }
                if (msg.type === 'unsubscribe' && msg.channel) {
                    client.channels.delete(msg.channel as WsChannel);
                    ws.send(JSON.stringify({ type: 'unsubscribed', channel: msg.channel }));
                }
                if (msg.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                }
            } catch {
                // Ignore invalid messages
            }
        });

        ws.on('close', () => {
            clients.delete(id);
            logger.info(`WebSocket client disconnected: ${id}`);
        });

        ws.on('error', (err) => {
            logger.error(`WebSocket client error: ${id}`, { error: err.message });
            clients.delete(id);
        });

        // Send welcome message
        ws.send(JSON.stringify({
            type: 'welcome',
            clientId: id,
            channels: Array.from(client.channels),
        }));
    });

    logger.info('WebSocket server initialized on /ws');
    return wss;
}

export function broadcast(channel: WsChannel, data: any): void {
    const payload = JSON.stringify({ type: channel, data, timestamp: Date.now() });

    for (const [, client] of clients) {
        if (client.channels.has(channel) && client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(payload);
            } catch {
                // Client disconnected
            }
        }
    }
}

export function broadcastSignal(signal: any): void {
    broadcast('signals', signal);
}

export function broadcastPositions(positions: any[]): void {
    broadcast('positions', positions);
}

export function broadcastPrices(prices: Record<string, number>): void {
    broadcast('prices', prices);
}

export function broadcastAlert(alert: { type: string; message: string; severity: string }): void {
    broadcast('alerts', alert);
}

export function broadcastPortfolio(portfolio: any): void {
    broadcast('portfolio', portfolio);
}

export function getConnectedClients(): number {
    return clients.size;
}
