import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { PortfolioAsset, PortfolioSummary, PortfolioAssetWithMetrics } from '@/types/portfolio';
import { useCryptoPrices } from './useCryptoPrices';
import { apiClient } from '@/services/apiClient';

export const usePortfolio = () => {
  const queryClient = useQueryClient();
  const { data: livePrices } = useCryptoPrices();

  const { data: rawAssets = [] } = useQuery<any[]>({
    queryKey: ['portfolio-assets'],
    queryFn: async () => {
      const { data } = await apiClient.get('/portfolio/assets');
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5000,
  });

  // Map snake_case to camelCase
  const assets: PortfolioAsset[] = useMemo(() => rawAssets.map(a => ({
    id: a.id,
    symbol: a.symbol,
    name: a.name,
    quantity: Number(a.quantity),
    averageBuyPrice: Number(a.average_buy_price),
    totalFees: Number(a.total_fees),
    createdAt: new Date(a.created_at),
    updatedAt: new Date(a.updated_at),
  })), [rawAssets]);

  const addAssetMutation = useMutation({
    mutationFn: async (asset: Partial<PortfolioAsset> & { name?: string }) => {
      const { data } = await apiClient.post('/portfolio/assets', {
        symbol: asset.symbol,
        name: asset.name,
        quantity: asset.quantity,
        average_buy_price: asset.averageBuyPrice,
        total_fees: asset.totalFees
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-assets'] });
    }
  });

  const removeAssetMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/portfolio/assets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-assets'] });
    }
  });

  const addAsset = useCallback((symbol: string, quantity: number, buyPrice: number, fee: number = 0) => {
    const pair = livePrices?.find(p => p.symbol === symbol);
    if (!pair) return;

    // Check if it already exists to calculate new average price
    const existing = assets.find(a => a.symbol === symbol);
    if (existing) {
      const totalQuantity = existing.quantity + quantity;
      const existingTotalFees = existing.totalFees || 0;
      const totalValue = (existing.quantity * existing.averageBuyPrice) + (quantity * buyPrice) + fee;
      const newAvgPrice = totalValue / totalQuantity;

      addAssetMutation.mutate({
        symbol,
        name: pair.name,
        quantity: totalQuantity,
        averageBuyPrice: newAvgPrice,
        totalFees: existingTotalFees + fee
      });
    } else {
      addAssetMutation.mutate({
        symbol,
        name: pair.name,
        quantity,
        averageBuyPrice: buyPrice + (fee / quantity),
        totalFees: fee
      });
    }
  }, [livePrices, assets, addAssetMutation]);

  const removeAsset = useCallback((id: string) => {
    removeAssetMutation.mutate(id);
  }, [removeAssetMutation]);

  const updateAsset = useCallback((id: string, quantity: number, buyPrice: number) => {
    const assetToUpdate = assets.find(a => a.id === id);
    if (assetToUpdate) {
      addAssetMutation.mutate({
        symbol: assetToUpdate.symbol,
        name: assetToUpdate.name,
        quantity,
        averageBuyPrice: buyPrice,
        totalFees: assetToUpdate.totalFees
      });
    }
  }, [assets, addAssetMutation]);

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
