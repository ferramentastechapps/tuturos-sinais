// WebSocket Hook — Manages connection to Backend WebSocket

import { useEffect, useRef, useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

export type WsChannel = 'signals' | 'positions' | 'prices' | 'alerts' | 'portfolio';

export interface WsMessage {
    type: WsChannel | 'welcome' | 'subscribed' | 'unsubscribed' | 'pong';
    data?: any;
    timestamp?: number;
    clientId?: string;
}

type MessageHandler = (data: any) => void;

export const useWebSocket = (channels: WsChannel[] = []) => {
    const ws = useRef<WebSocket | null>(null);
    const { toast } = useToast();
    const [isConnected, setIsConnected] = useState(false);
    const handlers = useRef<Map<WsChannel, Set<MessageHandler>>>(new Map());
    const reconnectTimeout = useRef<NodeJS.Timeout>();

    const subscribe = useCallback((channel: WsChannel) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'subscribe', channel }));
        }
    }, []);

    const unsubscribe = useCallback((channel: WsChannel) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'unsubscribe', channel }));
        }
    }, []);

    const on = useCallback((channel: WsChannel, handler: MessageHandler) => {
        if (!handlers.current.has(channel)) {
            handlers.current.set(channel, new Set());
        }
        handlers.current.get(channel)?.add(handler);
    }, []);

    const off = useCallback((channel: WsChannel, handler: MessageHandler) => {
        handlers.current.get(channel)?.delete(handler);
    }, []);

    const connect = useCallback(() => {
        if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) return;

        // console.log('Connecting to WebSocket...', WS_URL);
        ws.current = new WebSocket(WS_URL);

        ws.current.onopen = () => {
            // console.log('WebSocket connected');
            setIsConnected(true);
            // Subscribe to requested channels
            channels.forEach(channel => subscribe(channel));
        };

        ws.current.onclose = () => {
            // console.log('WebSocket disconnected');
            setIsConnected(false);
            // Attempt reconnect after 3s
            reconnectTimeout.current = setTimeout(connect, 3000);
        };

        ws.current.onerror = (error) => {
            console.error('WebSocket error:', error);
            ws.current?.close();
        };

        ws.current.onmessage = (event) => {
            try {
                const msg: WsMessage = JSON.parse(event.data);

                if (msg.type === 'alerts') {
                    toast({
                        title: 'Alerta do Sistema',
                        description: msg.data.message || JSON.stringify(msg.data),
                        variant: 'default', // You might want 'destructive' for errors
                    });
                }

                if (msg.type && handlers.current.has(msg.type as WsChannel)) {
                    handlers.current.get(msg.type as WsChannel)?.forEach(handler => handler(msg.data));
                }
            } catch (err) {
                console.error('Failed to parse WS message:', err);
            }
        };
    }, [channels, subscribe, toast]);

    useEffect(() => {
        connect();
        return () => {
            if (ws.current) {
                ws.current.close();
            }
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }
        };
    }, [connect]);

    // Keep-alive/Ping (optional, backend handles most)
    useEffect(() => {
        const interval = setInterval(() => {
            if (ws.current?.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    return { isConnected, subscribe, unsubscribe, on, off };
};
