import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import {
  Transaction,
  Wallet,
  CurrencyCode,
  getTransactions,
  saveTransaction,
  deleteTransaction as deleteFromStorage,
  getWallets,
  saveWallet as saveWalletToStorage,
  deleteWallet as deleteWalletFromStorage,
  getSelectedWalletId,
  setSelectedWalletId as setSelectedWalletIdStorage,
  getCurrencyInfo,
} from './storage';
import * as Crypto from 'expo-crypto';

interface TransactionContextValue {
  transactions: Transaction[];
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  isLoading: boolean;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  currencySymbol: string;
  currencyCode: CurrencyCode;
  addTransaction: (transaction: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  addWallet: (name: string, currency: CurrencyCode, icon: string, color: string) => Promise<Wallet>;
  removeWallet: (id: string) => Promise<void>;
  selectWallet: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  getMonthlyTransactions: (month: number, year: number) => Transaction[];
  walletTransactions: Transaction[];
}

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [txns, wlts, selId] = await Promise.all([
      getTransactions(),
      getWallets(),
      getSelectedWalletId(),
    ]);

    if (wlts.length > 0) {
      setSelectedWalletIdState(selId || wlts[0].id);
    }

    setTransactions(txns);
    setWallets(wlts);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedWallet = useMemo(() => {
    return wallets.find(w => w.id === selectedWalletId) || wallets[0] || null;
  }, [wallets, selectedWalletId]);

  const walletTransactions = useMemo(() => {
    if (!selectedWallet) return [];
    return transactions.filter(t => t.walletId === selectedWallet.id);
  }, [transactions, selectedWallet]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyTransactions = useMemo(() => {
    return walletTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [walletTransactions, currentMonth, currentYear]);

  const totalIncome = useMemo(() => {
    return monthlyTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyTransactions]);

  const totalExpense = useMemo(() => {
    return monthlyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyTransactions]);

  const balance = useMemo(() => totalIncome - totalExpense, [totalIncome, totalExpense]);

  const currencySymbol = useMemo(() => {
    if (!selectedWallet) return 'ج.م';
    return getCurrencyInfo(selectedWallet.currency).symbol;
  }, [selectedWallet]);

  const currencyCode = useMemo((): CurrencyCode => {
    if (!selectedWallet) return 'EGP';
    return selectedWallet.currency;
  }, [selectedWallet]);

  const addTransaction = useCallback(async (transaction: Transaction) => {
    await saveTransaction(transaction);
    setTransactions(prev => [transaction, ...prev]);
  }, []);

  const removeTransaction = useCallback(async (id: string) => {
    await deleteFromStorage(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  const addWallet = useCallback(async (name: string, currency: CurrencyCode, icon: string, color: string): Promise<Wallet> => {
    const wallet: Wallet = {
      id: Crypto.randomUUID(),
      name,
      currency,
      icon,
      color,
      createdAt: new Date().toISOString(),
    };
    await saveWalletToStorage(wallet);
    setWallets(prev => [...prev, wallet]);
    return wallet;
  }, []);

  const removeWallet = useCallback(async (id: string) => {
    await deleteWalletFromStorage(id);
    setWallets(prev => prev.filter(w => w.id !== id));
    setTransactions(prev => prev.filter(t => t.walletId !== id));
    if (selectedWalletId === id) {
      const remaining = wallets.filter(w => w.id !== id);
      if (remaining.length > 0) {
        setSelectedWalletIdState(remaining[0].id);
        await setSelectedWalletIdStorage(remaining[0].id);
      }
    }
  }, [selectedWalletId, wallets]);

  const selectWallet = useCallback(async (id: string) => {
    setSelectedWalletIdState(id);
    await setSelectedWalletIdStorage(id);
  }, []);

  const getMonthlyTransactions = useCallback((month: number, year: number) => {
    return walletTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [walletTransactions]);

  const value = useMemo(() => ({
    transactions,
    wallets,
    selectedWallet,
    isLoading,
    totalIncome,
    totalExpense,
    balance,
    currencySymbol,
    currencyCode,
    addTransaction,
    removeTransaction,
    addWallet,
    removeWallet,
    selectWallet,
    refresh: loadData,
    getMonthlyTransactions,
    walletTransactions,
  }), [transactions, wallets, selectedWallet, isLoading, totalIncome, totalExpense, balance, currencySymbol, currencyCode, addTransaction, removeTransaction, addWallet, removeWallet, selectWallet, loadData, getMonthlyTransactions, walletTransactions]);

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
