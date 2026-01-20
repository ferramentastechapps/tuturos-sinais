import { useState, useEffect, useCallback, useMemo } from 'react';
import { PortfolioAsset, PortfolioSummary, PortfolioAssetWithMetrics } from '@/types/portfolio';
import { CryptoPair } from '@/types/trading';
import { useCryptoPrices } from './useCryptoPrices';

const STORAGE_KEY = 'crypto-portfolio';

const loadFromStorage = (): PortfolioAsset[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((asset: PortfolioAsset) => ({
        ...asset,
        createdAt: new Date(asset.createdAt),
        updatedAt: new Date(asset.updatedAt),
      }));
    }
  } catch (error) {
    console.error('Error loading portfolio from storage:', error);
  }
  return [];
};

const saveToStorage = (assets: PortfolioAsset[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
  } catch (error) {
    console.error('Error saving portfolio to storage:', error);
  }
};

export const usePortfolio = () => {
  const [assets, setAssets] = useState<PortfolioAsset[]>(() => loadFromStorage());
  const { data: livePrices } = useCryptoPrices();

  // Persist to localStorage whenever assets change
  useEffect(() => {
    saveToStorage(assets);
  }, [assets]);

  const addAsset = useCallback((symbol: string, quantity: number, buyPrice: number, fee: number = 0) => {
    const pair = livePrices?.find(p => p.symbol === symbol);
    if (!pair) return;

    setAssets(prev => {
      const existing = prev.find(a => a.symbol === symbol);
      const now = new Date();

      if (existing) {
        // Update existing: calculate new average price including fees
        const totalQuantity = existing.quantity + quantity;
        const existingTotalFees = existing.totalFees || 0;
        const totalValue = (existing.quantity * existing.averageBuyPrice) + (quantity * buyPrice) + fee;
        const newAvgPrice = totalValue / totalQuantity;

        return prev.map(a =>
          a.symbol === symbol
            ? { 
                ...a, 
                quantity: totalQuantity, 
                averageBuyPrice: newAvgPrice, 
                totalFees: existingTotalFees + fee,
                updatedAt: now 
              }
            : a
        );
      }

      // Add new asset
      const newAsset: PortfolioAsset = {
        id: crypto.randomUUID(),
        symbol,
        name: pair.name,
        quantity,
        averageBuyPrice: buyPrice + (fee / quantity), // Include fee in average price
        createdAt: now,
        updatedAt: now,
        totalFees: fee,
      };

      return [...prev, newAsset];
    });
  }, [livePrices]);

  const removeAsset = useCallback((id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  }, []);

  const updateAsset = useCallback((id: string, quantity: number, buyPrice: number) => {
    setAssets(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, quantity, averageBuyPrice: buyPrice, updatedAt: new Date() }
          : a
      )
    );
  }, []);

  const getAssetWithMetrics = useCallback((asset: PortfolioAsset): PortfolioAssetWithMetrics => {
    const pair = livePrices?.find(p => p.symbol === asset.symbol);
    const currentPrice = pair?.price ?? asset.averageBuyPrice;
    const change24h = pair?.change24h ?? 0;
    const currentValue = asset.quantity * currentPrice;
    const invested = asset.quantity * asset.averageBuyPrice;
    const pnl = currentValue - invested;
    const pnlPercentage = invested > 0 ? (pnl / invested) * 100 : 0;

    return {
      ...asset,
      currentPrice,
      currentValue,
      pnl,
      pnlPercentage,
      change24h,
    };
  }, [livePrices]);

  const summary: PortfolioSummary = useMemo(() => {
    const assetsWithMetrics = assets.map(getAssetWithMetrics);
    
    const totalValue = assetsWithMetrics.reduce((sum, a) => sum + a.currentValue, 0);
    const totalInvested = assetsWithMetrics.reduce((sum, a) => sum + (a.quantity * a.averageBuyPrice), 0);
    const totalPnL = totalValue - totalInvested;
    const totalPnLPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    return {
      totalValue,
      totalInvested,
      totalPnL,
      totalPnLPercentage,
      assets: assetsWithMetrics,
    };
  }, [assets, getAssetWithMetrics]);

  return {
    assets,
    summary,
    addAsset,
    removeAsset,
    updateAsset,
    livePrices,
  };
};
