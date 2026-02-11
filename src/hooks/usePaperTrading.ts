import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { useWebSocket } from '@/hooks/useWebSocket';
import { PaperPortfolioState, PaperTradingConfig, PaperOrder, PaperTradingMode, PaperMetrics } from '@/types/paperTrading';
import { useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface PaperSignalInput {
    symbol: string;
    direction: 'long' | 'short';
    entry: number;
    stopLoss: number;
    takeProfit: number;
    takeProfit1?: number;
    takeProfit2?: number;
    takeProfit3?: number;
}

export const usePaperTrading = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { on, off, isConnected, subscribe } = useWebSocket();

    // 1. Initial State Fetch
    const { data: portfolio } = useQuery<any>({
        queryKey: ['paper-portfolio'],
        queryFn: async () => {
            const { data } = await apiClient.get('/portfolio');
            return data;
        },
        staleTime: Infinity, // WS updates this
    });

    const { data: positions = [] } = useQuery<any[]>({
        queryKey: ['paper-positions'],
        queryFn: async () => {
            const { data } = await apiClient.get('/positions');
            return data;
        },
        staleTime: Infinity,
    });

    const { data: history = [] } = useQuery<PaperOrder[]>({
        queryKey: ['paper-history'],
        queryFn: async () => {
            const { data } = await apiClient.get('/history?limit=100');
            return data;
        },
        staleTime: Infinity,
    });

    // 2. WebSocket Updates
    useEffect(() => {
        if (isConnected) {
            subscribe('portfolio');
            subscribe('positions');
        }

        const handlePortfolioUpdate = (data: any) => {
            queryClient.setQueryData(['paper-portfolio'], (old: any) => ({ ...old, ...data }));
        };

        const handlePositionsUpdate = (data: any[]) => {
            queryClient.setQueryData(['paper-positions'], data);
        };

        if (isConnected) {
            on('portfolio', handlePortfolioUpdate);
            on('positions', handlePositionsUpdate);
        }

        return () => {
            off('portfolio', handlePortfolioUpdate);
            off('positions', handlePositionsUpdate);
        };
    }, [isConnected, on, off, queryClient, subscribe]);


    // 3. Actions (Mutations)
    const openPositionMutation = useMutation({
        mutationFn: async (signal: any) => {
            return apiClient.post('/paper/open', {
                symbol: signal.symbol || signal.pair,
                direction: signal.type || signal.direction,
                currentPrice: signal.entry || signal.currentPrice || signal.price,
                stopLoss: signal.stopLoss,
                takeProfit1: signal.takeProfit1 || signal.takeProfit,
                takeProfit2: signal.takeProfit2,
                takeProfit3: signal.takeProfit3,
                leverage: 10,
            });
        },
        onSuccess: () => {
            toast({ title: 'Ordem enviada', description: 'Posição aberta com sucesso' });
            queryClient.invalidateQueries({ queryKey: ['paper-positions'] });
            queryClient.invalidateQueries({ queryKey: ['paper-portfolio'] });
        },
        onError: (err: any) => {
            toast({ title: 'Erro ao abrir posição', description: err.response?.data?.error || err.message, variant: 'destructive' });
        }
    });

    const closePositionMutation = useMutation({
        mutationFn: async (positionId: string) => {
            return apiClient.post('/paper/close', { positionId });
        },
        onSuccess: () => {
            toast({ title: 'Posição fechada' });
            queryClient.invalidateQueries({ queryKey: ['paper-positions'] });
            queryClient.invalidateQueries({ queryKey: ['paper-portfolio'] });
            queryClient.invalidateQueries({ queryKey: ['paper-history'] });
        },
        onError: (err: any) => {
            toast({ title: 'Erro ao fechar posição', description: err.response?.data?.error || err.message, variant: 'destructive' });
        }
    });

    const toggleModeMutation = useMutation({
        mutationFn: async () => apiClient.post('/paper/toggle'),
        onSuccess: (data: any) => {
            toast({ title: 'Modo alterado', description: `Novo modo: ${data.data.mode}` });
            queryClient.invalidateQueries({ queryKey: ['paper-portfolio'] });
        }
    });

    const updateConfig = useCallback((config: Partial<PaperTradingConfig>) => {
        apiClient.post('/settings', { paperTrading: config })
            .then(() => {
                queryClient.invalidateQueries({ queryKey: ['paper-portfolio'] });
                toast({ title: 'Configuração atualizada' });
            })
            .catch((err: any) => {
                toast({ title: 'Erro ao atualizar config', description: err.message, variant: 'destructive' });
            });
    }, [queryClient, toast]);

    const resetPortfolio = useCallback(() => {
        toast({ title: 'Reset não implementado na API ainda' });
    }, [toast]);

    const shouldAutoTrade = useCallback((signalScore: number, _mlProbability?: number): boolean => {
        // Mock client-side check for UI feedback
        if (!portfolio?.config) return false;
        return portfolio.config.autoTrade && signalScore >= portfolio.config.minScore;
    }, [portfolio?.config]);

    // Construct state that matches PaperPortfolioState + has metrics separate
    const state = portfolio ? {
        ...portfolio,
        positions: positions || [],
        history: history || [],
    } : null;

    return {
        state,
        metrics: portfolio?.metrics, // API returns metrics in portfolio object
        lastClosedOrders: history?.slice(0, 5) || [],
        openPosition: openPositionMutation.mutate,
        closePosition: closePositionMutation.mutate,
        setMode: () => toggleModeMutation.mutate(),
        updateConfig,
        resetPortfolio,
        updatePrices: () => { },
        applyFunding: () => { },
        shouldAutoTrade,
    };
};
