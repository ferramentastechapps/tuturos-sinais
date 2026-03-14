import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { indicatorPerformanceService } from '@/services/indicatorPerformanceService';
import { 
  computeSymbolSummary, 
  generateOptimizedProfile as utilGenerateOptimizedProfile 
} from '@/utils/indicatorEfficacy';
import { 
  TradePerformanceEntry, 
  SymbolPerformanceSummary,
  IndicatorPerformanceRecord
} from '@/types/indicatorPerformanceTypes';
import { useStrategyProfile } from '@/hooks/useStrategyProfile';
import { toast } from '@/hooks/use-toast';

export const useIndicatorPerformance = (symbol?: string) => {
  const queryClient = useQueryClient();
  const { createProfile } = useStrategyProfile();
  
  // ── 1. Fetch Data ──

  // Fetch logic dependent on whether a specific symbol was requested
  const fetchKey = symbol ? ['indicator-performance', symbol] : ['indicator-performance', 'all'];
  
  const { data: records = [], isLoading, error } = useQuery({
    queryKey: fetchKey,
    queryFn: async () => {
      if (symbol) {
        return await indicatorPerformanceService.loadPerformanceForSymbol(symbol);
      } else {
        return await indicatorPerformanceService.loadAllSymbolPerformance();
      }
    },
    // Keep data fresh
    refetchInterval: 30000 
  });

  // ── 2. Analysis Calculation ──

  const getSymbolAnalysis = useCallback((targetSymbol: string): SymbolPerformanceSummary | null => {
    // If we loaded specifically for this symbol, use `records`. 
    // If we loaded 'all', filter records.
    const relevantRecords = symbol === targetSymbol 
      ? records 
      : records.filter(r => r.symbol === targetSymbol);
      
    if (relevantRecords.length === 0) return null;
    
    return computeSymbolSummary(targetSymbol, relevantRecords);
  }, [records, symbol]);

  const analysis = symbol ? getSymbolAnalysis(symbol) : null;

  // ── 3. Mutations ──

  // Record trade mutation
  const recordTradeMutation = useMutation({
    mutationFn: (trade: TradePerformanceEntry) => indicatorPerformanceService.recordTradePerformance(trade),
    onSuccess: (data, variables) => {
      // Invalidate queries for this symbol and 'all'
      queryClient.invalidateQueries({ queryKey: ['indicator-performance', variables.symbol] });
      queryClient.invalidateQueries({ queryKey: ['indicator-performance', 'all'] });
    }
  });

  // Reset symbol data mutation
  const resetDataMutation = useMutation({
    mutationFn: (targetSymbol: string) => indicatorPerformanceService.resetSymbolData(targetSymbol),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['indicator-performance', variables] });
      queryClient.invalidateQueries({ queryKey: ['indicator-performance', 'all'] });
      toast({
        title: "Dados Apagados",
        description: `O histórico de performance para ${variables} foi zerado.`,
      });
    }
  });

  // ── 4. High Level Actions ──

  const recordClosedTrade = useCallback(async (trade: TradePerformanceEntry) => {
    return recordTradeMutation.mutateAsync(trade);
  }, [recordTradeMutation]);

  const resetSymbolData = useCallback(async (targetSymbol: string) => {
    return resetDataMutation.mutateAsync(targetSymbol);
  }, [resetDataMutation]);

  const generateOptimizedProfile = useCallback(async (targetSymbol: string) => {
    const summary = getSymbolAnalysis(targetSymbol);
    if (!summary) {
      toast({
        title: "Dados Insuficientes",
        description: `Não há dados suficientes de ${targetSymbol} para otimizar.`,
        variant: "destructive"
      });
      return null;
    }
    
    const newProfile = utilGenerateOptimizedProfile(summary);
    
    try {
      await createProfile(newProfile.name);
      
      toast({
        title: "Perfil Otimizado Gerado! 🎯",
        description: `O perfil "${newProfile.name}" foi salvo nas suas Configurações de Estratégia.`,
        className: "bg-success/10 text-success border-success/20",
      });
      
      return newProfile;
    } catch (e) {
      toast({
        title: "Erro ao salvar",
        description: "Houve um problema ao salvar o perfil otimizado.",
        variant: "destructive"
      });
      return null;
    }
  }, [getSymbolAnalysis, createProfile]);

  return {
    records,
    analysis,
    isLoading,
    error,
    recordClosedTrade,
    isRecording: recordTradeMutation.isPending,
    getSymbolAnalysis,
    resetSymbolData,
    generateOptimizedProfile,
  };
};
