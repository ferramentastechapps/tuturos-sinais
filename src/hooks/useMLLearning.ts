import { useState, useEffect, useCallback } from 'react';

export interface MLLearningItem {
  id: string;
  symbol: string;
  result: 'WIN' | 'LOSS';
  profit_percent: number;
  ml_was_correct: boolean;
  key_indicators: string[];
}

export interface MLLearningStats {
  accuracy: string;
  total: number;
}

export function useMLLearning(limit = 5) {
  const [learnings, setLearnings] = useState<MLLearningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MLLearningStats>({ accuracy: '0.0', total: 0 });

  const fetchLearnings = useCallback(async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/ml/learning-history?limit=${limit}`
      );
      const data = await res.json();
      
      if (data.success) {
        setLearnings(data.learnings || []);
        setStats({
          accuracy: (data.summary.ml_accuracy * 100).toFixed(1),
          total: data.summary.total
        });
      }
    } catch (error) {
      console.error('Error fetching ML learnings:', error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchLearnings();
    
    // Auto-atualização a cada 30 segundos
    const interval = setInterval(() => {
      fetchLearnings();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchLearnings]);

  return { learnings, stats, loading, refresh: fetchLearnings };
}
