import { Router, Request, Response } from 'express';
import { exchangeService } from '../../trading/exchangeService.js';
import { logger } from '../../lib/logger.js';

const router = Router();

// GET /api/trade/status
router.get('/status', (_req: Request, res: Response) => {
    res.json({
        enabled: exchangeService.isConfigured(),
        testnet: exchangeService.isTestnet(),
        mode: exchangeService.isTestnet() ? 'testnet' : 'live',
    });
});

// GET /api/trade/account
router.get('/account', async (_req: Request, res: Response) => {
    try {
        const summary = await exchangeService.getAccountSummary();
        res.json(summary);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/trade/positions/live
router.get('/positions/live', async (_req: Request, res: Response) => {
    try {
        const positions = await exchangeService.getLivePositions();
        res.json(positions);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/trade/execute
router.post('/execute', async (req: Request, res: Response) => {
    try {
        const { symbol, direction, entryPrice, stopLoss, takeProfit1, takeProfit2, leverage, riskPercent, signalScore } = req.body;

        if (!symbol || !direction || !entryPrice || !stopLoss || !takeProfit1) {
            res.status(400).json({ error: 'Missing required fields: symbol, direction, entryPrice, stopLoss, takeProfit1' });
            return;
        }

        logger.info('Live trade execution requested', { symbol, direction, signalScore });

        const result = await exchangeService.placeMarketOrder({
            symbol,
            direction,
            entryPrice: parseFloat(entryPrice),
            stopLoss: parseFloat(stopLoss),
            takeProfit1: parseFloat(takeProfit1),
            takeProfit2: takeProfit2 ? parseFloat(takeProfit2) : undefined,
            leverage: parseInt(leverage) || 5,
            riskPercent: parseFloat(riskPercent) || 2,
            signalScore: parseInt(signalScore) || 70,
        });

        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error: any) {
        logger.error('Error in /trade/execute', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// POST /api/trade/close
router.post('/close', async (req: Request, res: Response) => {
    try {
        const { symbol } = req.body;
        if (!symbol) {
            res.status(400).json({ error: 'symbol is required' });
            return;
        }

        const result = await exchangeService.closePosition(symbol);
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
