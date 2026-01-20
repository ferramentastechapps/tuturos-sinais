import { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, TransactionSummary } from '@/types/transactions';

const STORAGE_KEY = 'crypto-transactions';

const loadFromStorage = (): Transaction[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((tx: Transaction) => ({
        ...tx,
        createdAt: new Date(tx.createdAt),
      }));
    }
  } catch (error) {
    console.error('Error loading transactions from storage:', error);
  }
  return [];
};

const saveToStorage = (transactions: Transaction[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (error) {
    console.error('Error saving transactions to storage:', error);
  }
};

export const useTransactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(transactions);
  }, [transactions]);

  const addTransaction = useCallback((
    assetId: string,
    symbol: string,
    name: string,
    type: Transaction['type'],
    quantity: number,
    price: number,
    fee: number = 0,
    feeAsset: string = 'USDT',
    notes?: string,
    exchange?: string
  ) => {
    const total = type === 'buy' || type === 'transfer_in'
      ? quantity * price + fee
      : quantity * price - fee;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      assetId,
      symbol,
      name,
      type,
      quantity,
      price,
      fee,
      feeAsset,
      total,
      notes,
      exchange,
      createdAt: new Date(),
    };

    setTransactions(prev => [newTransaction, ...prev]);
    return newTransaction;
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
  }, []);

  const getTransactionsByAsset = useCallback((assetId: string) => {
    return transactions.filter(tx => tx.assetId === assetId);
  }, [transactions]);

  const getTransactionsBySymbol = useCallback((symbol: string) => {
    return transactions.filter(tx => tx.symbol === symbol);
  }, [transactions]);

  const summary: TransactionSummary = useMemo(() => {
    const totalBought = transactions
      .filter(tx => tx.type === 'buy' || tx.type === 'transfer_in')
      .reduce((sum, tx) => sum + tx.total, 0);

    const totalSold = transactions
      .filter(tx => tx.type === 'sell' || tx.type === 'transfer_out')
      .reduce((sum, tx) => sum + tx.total, 0);

    const totalFees = transactions.reduce((sum, tx) => sum + tx.fee, 0);

    return {
      totalBought,
      totalSold,
      totalFees,
      netInvested: totalBought - totalSold,
      transactionCount: transactions.length,
    };
  }, [transactions]);

  const exportToCSV = useCallback(() => {
    const headers = ['Data', 'Ativo', 'Tipo', 'Quantidade', 'Preço', 'Taxa', 'Total', 'Exchange', 'Notas'];
    const rows = transactions.map(tx => [
      tx.createdAt.toISOString(),
      tx.symbol,
      tx.type,
      tx.quantity,
      tx.price,
      tx.fee,
      tx.total,
      tx.exchange || '',
      tx.notes || '',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transactions]);

  return {
    transactions,
    summary,
    addTransaction,
    deleteTransaction,
    getTransactionsByAsset,
    getTransactionsBySymbol,
    exportToCSV,
  };
};
