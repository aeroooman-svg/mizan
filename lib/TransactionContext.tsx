import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { Transaction, getTransactions, saveTransaction, deleteTransaction as deleteFromStorage } from './storage';

interface TransactionContextValue {
  transactions: Transaction[];
  isLoading: boolean;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  addTransaction: (transaction: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  getMonthlyTransactions: (month: number, year: number) => Transaction[];
}

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    const data = await getTransactions();
    setTransactions(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const addTransaction = useCallback(async (transaction: Transaction) => {
    await saveTransaction(transaction);
    setTransactions(prev => [transaction, ...prev]);
  }, []);

  const removeTransaction = useCallback(async (id: string) => {
    await deleteFromStorage(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  const getMonthlyTransactions = useCallback((month: number, year: number) => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [transactions]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [transactions, currentMonth, currentYear]);

  const totalIncome = useMemo(() => {
    return monthlyTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyTransactions]);

  const totalExpense = useMemo(() => {
    return monthlyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyTransactions]);

  const balance = useMemo(() => totalIncome - totalExpense, [totalIncome, totalExpense]);

  const value = useMemo(() => ({
    transactions,
    isLoading,
    totalIncome,
    totalExpense,
    balance,
    addTransaction,
    removeTransaction,
    refresh: loadTransactions,
    getMonthlyTransactions,
  }), [transactions, isLoading, totalIncome, totalExpense, balance, addTransaction, removeTransaction, loadTransactions, getMonthlyTransactions]);

  return (
    <TransactionContext.Provider value={value}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error('useTransactions must be used within a TransactionProvider');
  }
  return context;
}
