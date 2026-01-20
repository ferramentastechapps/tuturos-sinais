import { useCallback } from 'react';
import { useToast } from './use-toast';

interface BackupData {
  version: string;
  exportDate: string;
  portfolio: string | null;
  trades: string | null;
  transactions: string | null;
  settings: Record<string, any>;
}

export const useDataBackup = () => {
  const { toast } = useToast();

  const exportBackup = useCallback(() => {
    try {
      const backup: BackupData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        portfolio: localStorage.getItem('crypto-portfolio'),
        trades: localStorage.getItem('crypto-trades'),
        transactions: localStorage.getItem('crypto-transactions'),
        settings: {
          theme: localStorage.getItem('theme'),
        },
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cryptofutures_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Backup criado',
        description: 'Seus dados foram exportados com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao criar backup',
        description: 'Não foi possível exportar os dados.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const importBackup = useCallback((file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const backup: BackupData = JSON.parse(content);

        // Validate backup structure
        if (!backup.version || !backup.exportDate) {
          throw new Error('Arquivo de backup inválido');
        }

        // Restore data
        if (backup.portfolio) {
          localStorage.setItem('crypto-portfolio', backup.portfolio);
        }
        if (backup.trades) {
          localStorage.setItem('crypto-trades', backup.trades);
        }
        if (backup.transactions) {
          localStorage.setItem('crypto-transactions', backup.transactions);
        }
        if (backup.settings.theme) {
          localStorage.setItem('theme', backup.settings.theme);
        }

        toast({
          title: 'Backup restaurado',
          description: 'Seus dados foram importados. Recarregue a página para ver as mudanças.',
        });

        // Reload page after 2 seconds
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } catch (error) {
        toast({
          title: 'Erro ao restaurar backup',
          description: 'O arquivo não é um backup válido.',
          variant: 'destructive',
        });
      }
    };

    reader.readAsText(file);
  }, [toast]);

  const clearAllData = useCallback(() => {
    if (window.confirm('Tem certeza que deseja apagar TODOS os dados? Esta ação não pode ser desfeita!')) {
      localStorage.removeItem('crypto-portfolio');
      localStorage.removeItem('crypto-trades');
      localStorage.removeItem('crypto-transactions');
      
      toast({
        title: 'Dados apagados',
        description: 'Todos os dados foram removidos.',
      });

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }, [toast]);

  return {
    exportBackup,
    importBackup,
    clearAllData,
  };
};
