import { useEffect, useState } from 'react';

export interface MLStats {
  enabled: boolean;
  loaded: boolean;
  totalSignals: number;
  wins: number;
  losses: number;
  winRate: number;
  tp1Hits: number;
  tp2Hits: number;
  tp3Hits: number;
  avgPnl: number;
}

export function useMLStats(refreshInterval = 30000) {
  const [stats, setStats] = useState<MLStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/ml/stats');
        if (!response.ok) {
          throw new Error('Falha ao buscar estatísticas ML');
        }
        const data = await response.json();
        setStats(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
        console.error('Erro ao buscar ML stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { stats, loading, error };
}
