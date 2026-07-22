import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import {
  Transaction,
  Wallet,
  CurrencyCode,
  getTransactions,
  saveTransaction,
  deleteTransaction as deleteFromStorage,
  updateTransaction as updateInStorage,
  getWallets,
  saveWallet as saveWalletToStorage,
  deleteWallet as deleteWalletFromStorage,
  getSelectedWalletId,
  setSelectedWalletId as setSelectedWalletIdStorage,
  getCurrencyInfo,
} from './storage';
import * as Crypto from 'expo-crypto';
import { Alert } from 'react-native';
import { deleteFinancialPlan } from './planStorage';
import { getCustomCategories, saveCustomCategory, deleteCustomCategory as deleteCustomCatFromStorage, CustomCategory } from './customCategories';
import { getRecurringTransactions, updateRecurringTransaction, deleteRecurringTransaction, RecurringTransaction } from './recurringStorage';
import { getGoals, deleteGoal, getRules, deleteRule } from './goalStorage';
import { getDebts, deleteDebt } from './debtStorage';
import { useLanguage, globalAppLanguage } from './LanguageContext';
import { setCustomCategoriesInMemory, getCategoryById } from './categories';
import { sendImmediateNotification } from './NotificationService';
import * as Haptics from 'expo-haptics';
import { getLoggedInUser, syncWithCloud } from './syncService';

interface TransactionContextValue {
  transactions: Transaction[];
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  isLoading: boolean;
  isInitialLoading: boolean;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  allTimeIncome: number;
  allTimeExpense: number;
  currencySymbol: string;
  currencyCode: CurrencyCode;
  addTransaction: (transaction: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  addWallet: (name: string, currency: CurrencyCode, icon: string, color: string, cardStyle?: 'classic' | 'glass' | 'futuristic' | 'minimal', sharedWith?: string) => Promise<Wallet>;
  removeWallet: (id: string) => Promise<void>;
  selectWallet: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  getMonthlyTransactions: (month: number, year: number) => Transaction[];
  walletTransactions: Transaction[];
  // Custom categories
  customCategories: CustomCategory[];
  addCustomCategory: (nameAr: string, nameEn: string, icon: string, color: string, type: 'expense' | 'income') => Promise<CustomCategory>;
  removeCustomCategory: (id: string) => Promise<void>;
  // Pending recurring transactions (variable)
  pendingRecurring: RecurringTransaction[];
  approveRecurringTransaction: (rec: RecurringTransaction, customAmount?: number, skip?: boolean) => Promise<void>;
}

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [pendingRecurring, setPendingRecurring] = useState<RecurringTransaction[]>([]);
  const [selectedWalletId, setSelectedWalletIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    let [txns, wlts, selId, customCats] = await Promise.all([
      getTransactions(),
      getWallets(),
      getSelectedWalletId(),
      getCustomCategories(),
    ]);

    // Process recurring transactions
    try {
      const now = new Date();
      const recurringList = await getRecurringTransactions();
      const generatedTxns: Transaction[] = [];
      const pending: RecurringTransaction[] = [];

      for (const rec of recurringList) {
        if (!rec.isActive) continue;
        
        let nextDue = new Date(rec.nextDueDate);
        
        if (rec.isVariable) {
          if (nextDue <= now) {
            pending.push(rec);
          }
          continue;
        }

        let timesProcessed = 0;
        while (nextDue <= now) {
          if (timesProcessed > 50) break; // Infinite loop safety
          
          const newTx: Transaction = {
            id: Crypto.randomUUID(),
            walletId: rec.walletId,
            type: rec.type,
            amount: rec.amount,
            category: rec.category,
            description: rec.description || '',
            date: nextDue.toISOString(),
            createdAt: new Date().toISOString(),
          };
          
          generatedTxns.push(newTx);
          timesProcessed++;
          
          // Advance next due date
          if (rec.frequency === 'daily') {
            nextDue.setDate(nextDue.getDate() + 1);
          } else if (rec.frequency === 'weekly') {
            nextDue.setDate(nextDue.getDate() + 7);
          } else if (rec.frequency === 'monthly') {
            nextDue.setMonth(nextDue.getMonth() + 1);
          } else if (rec.frequency === 'yearly') {
            nextDue.setFullYear(nextDue.getFullYear() + 1);
          }
        }
        
        if (timesProcessed > 0) {
          rec.nextDueDate = nextDue.toISOString();
          await updateRecurringTransaction(rec);
        }
      }

      setPendingRecurring(pending);

      if (generatedTxns.length > 0) {
        // Save generated transactions
        for (const tx of generatedTxns) {
          await saveTransaction(tx);
        }
        // Prepended generated ones to state list
        txns = [...generatedTxns, ...txns];

        // Notify user
        setTimeout(() => {
          const lang = language || 'ar';
          const msg = lang === 'ar'
            ? `تمت معالجة ${generatedTxns.length} معاملات مجدولة (مكررة) بنجاح!`
            : `Processed ${generatedTxns.length} recurring transactions successfully!`;
          Alert.alert(lang === 'ar' ? 'المعاملات المتكررة' : 'Recurring Transactions', msg);
        }, 600);
      }
    } catch (e) {
    }

    if (wlts.length > 0) {
      setSelectedWalletIdState(selId || wlts[0].id);
    }

    setTransactions(txns);
    setWallets(wlts);
    setCustomCategories(customCats);
    setCustomCategoriesInMemory(customCats);
    setIsLoading(false);
    setIsInitialLoading(false);
  }, [language]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const triggerLiveSync = useCallback(async () => {
    try {
      const user = await getLoggedInUser();
      if (!user) return; // Not logged in

      const syncResult = await syncWithCloud();
      if (syncResult) {
        setTransactions(syncResult.transactions);
        setWallets(syncResult.wallets);
      }
    } catch (e) {
      console.warn('Live sync failed:', e);
    }
  }, []);

  const selectedWallet = useMemo(() => {
    return wallets.find(w => w.id === selectedWalletId) || wallets[0] || null;
  }, [wallets, selectedWalletId]);

  const walletTransactions = useMemo(() => {
    if (!selectedWallet) return [];
    return transactions.filter(t => 
      t.walletId === selectedWallet.id || 
      (t.type === 'transfer' && t.toWalletId === selectedWallet.id)
    );
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
    if (!selectedWallet) return 0;
    return monthlyTransactions
      .filter(t => t.type === 'income' || (t.type === 'transfer' && t.toWalletId === selectedWallet.id))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyTransactions, selectedWallet]);

  const totalExpense = useMemo(() => {
    if (!selectedWallet) return 0;
    return monthlyTransactions
      .filter(t => t.type === 'expense' || (t.type === 'transfer' && t.walletId === selectedWallet.id))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyTransactions, selectedWallet]);

  const balance = useMemo(() => totalIncome - totalExpense, [totalIncome, totalExpense]);

  const allTimeIncome = useMemo(() => {
    if (!selectedWallet) return 0;
    return walletTransactions
      .filter(t => t.type === 'income' || (t.type === 'transfer' && t.toWalletId === selectedWallet.id))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [walletTransactions, selectedWallet]);

  const allTimeExpense = useMemo(() => {
    if (!selectedWallet) return 0;
    return walletTransactions
      .filter(t => t.type === 'expense' || (t.type === 'transfer' && t.walletId === selectedWallet.id))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [walletTransactions, selectedWallet]);

  const currencySymbol = useMemo(() => {
    if (!selectedWallet) return globalAppLanguage === 'ar' ? 'ج.م' : 'EGP';
    const code = selectedWallet.currency;
    if (globalAppLanguage === 'ar') {
      return getCurrencyInfo(code).symbol;
    } else {
      // Use standard symbols for well-known currencies in English
      const symbolMap: Record<string, string> = {
        USD: '$', EUR: '€', GBP: '£',
      };
      return symbolMap[code] || code;
    }
  }, [selectedWallet, globalAppLanguage]);

  const currencyCode = useMemo((): CurrencyCode => {
    if (!selectedWallet) return 'EGP';
    return selectedWallet.currency;
  }, [selectedWallet]);

  const addTransaction = useCallback(async (transaction: Transaction) => {
    // 1. Save the main transaction
    await saveTransaction(transaction);
    setTransactions(prev => [transaction, ...prev]);

    // 2. Process Auto-Savings Rules for Expenses
    if (transaction.type === 'expense') {
      try {
        const [activeRules, budgetsData] = await Promise.all([
          import('./goalStorage').then(m => m.getRules()),
          import('./budgetStorage').then(m => m.getBudgetsForWallet(transaction.walletId))
        ]);

        // 3. Process Budget Alert Notifications
        const limit = budgetsData[transaction.category] || 0;
        if (limit > 0) {
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          
          const spentBefore = transactions
            .filter(t => {
              const d = new Date(t.date);
              return t.walletId === transaction.walletId &&
                     t.category === transaction.category &&
                     t.type === 'expense' &&
                     d.getMonth() === currentMonth &&
                     d.getFullYear() === currentYear;
            })
            .reduce((sum, t) => sum + t.amount, 0);

          const spentAfter = spentBefore + transaction.amount;
          const pctBefore = (spentBefore / limit) * 100;
          const pctAfter = (spentAfter / limit) * 100;

          if (pctBefore < 80 && pctAfter >= 80 && pctAfter < 100) {
            const cat = getCategoryById(transaction.category);
            const categoryName = language === 'ar' ? (cat?.nameAr || transaction.category) : (cat?.name || transaction.category);
            const remaining = limit - spentAfter;
            const title = language === 'ar' ? 'تنبيه الميزانية ⚠️' : 'Budget Warning ⚠️';
            const body = language === 'ar'
              ? `لقد استهلكت ${Math.round(pctAfter)}% من ميزانية فئة (${categoryName}). المتبقي: ${remaining.toFixed(2)}`
              : `You have spent ${Math.round(pctAfter)}% of your (${categoryName}) budget. Remaining: ${remaining.toFixed(2)}`;
            
            await sendImmediateNotification(title, body);
          } else if (pctBefore < 100 && pctAfter >= 100) {
            const cat = getCategoryById(transaction.category);
            const categoryName = language === 'ar' ? (cat?.nameAr || transaction.category) : (cat?.name || transaction.category);
            const overrun = spentAfter - limit;
            const title = language === 'ar' ? 'تنبيه تجاوز الميزانية 🚨' : 'Budget Exceeded 🚨';
            const body = language === 'ar'
              ? `لقد تجاوزت ميزانية فئة (${categoryName}) بمقدار ${overrun.toFixed(2)}. إجمالي الصرف: ${spentAfter.toFixed(2)} (الميزانية: ${limit.toFixed(2)})`
              : `You have exceeded your (${categoryName}) budget by ${overrun.toFixed(2)}. Total spent: ${spentAfter.toFixed(2)} (Budget: ${limit.toFixed(2)})`;
            
            await sendImmediateNotification(title, body);
          }
        }

        const walletRules = activeRules.filter(r => r.walletId === transaction.walletId && r.isActive);

        for (const rule of walletRules) {
          if (rule.type === 'round_up') {
            const nextTen = Math.ceil(transaction.amount / 10) * 10;
            const diff = nextTen - transaction.amount;
            if (diff > 0) {
              const savingsTx: Transaction = {
                id: Crypto.randomUUID(),
                walletId: transaction.walletId,
                type: 'expense',
                amount: diff,
                category: 'investment',
                description: language === 'ar' ? 'حصالة الفكة - Round-up' : 'Round-up savings',
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
              };
              
              await saveTransaction(savingsTx);
              setTransactions(prev => [savingsTx, ...prev]);
              await import('./goalStorage').then(m => m.addFundsToGoal(rule.targetGoalId, diff));
            }
          }

          if (rule.type === 'penalty' && rule.amount && rule.amount > 0) {
            const limit = budgetsData[transaction.category] || 0;
            if (limit > 0) {
              const currentMonth = new Date().getMonth();
              const currentYear = new Date().getFullYear();
              
              const spent = transactions
                .filter(t => {
                  const d = new Date(t.date);
                  return t.walletId === transaction.walletId &&
                         t.category === transaction.category &&
                         t.type === 'expense' &&
                         d.getMonth() === currentMonth &&
                         d.getFullYear() === currentYear;
                })
                .reduce((sum, t) => sum + t.amount, 0) + transaction.amount;

              if (spent > limit) {
                const penaltyAmount = rule.amount || 0;
                const penaltyTx: Transaction = {
                  id: Crypto.randomUUID(),
                  walletId: transaction.walletId,
                  type: 'expense',
                  amount: penaltyAmount,
                  category: 'investment',
                  description: language === 'ar' ? 'عقوبة تجاوز الميزانية - Penalty' : 'Budget overrun penalty',
                  date: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                };

                await saveTransaction(penaltyTx);
                setTransactions(prev => [penaltyTx, ...prev]);
                await import('./goalStorage').then(m => m.addFundsToGoal(rule.targetGoalId, penaltyAmount));
              }
            }
          }
        }
      } catch (err) {
        console.error('Error running savings rules:', err);
      }
    }
    triggerLiveSync();
  }, [transactions, language, triggerLiveSync]);

  const removeTransaction = useCallback(async (id: string) => {
    await deleteFromStorage(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
    triggerLiveSync();
  }, [triggerLiveSync]);

  const updateTransaction = useCallback(async (transaction: Transaction) => {
    await updateInStorage(transaction);
    setTransactions(prev => prev.map(t => t.id === transaction.id ? transaction : t));
    triggerLiveSync();
  }, [triggerLiveSync]);

  const addWallet = useCallback(async (name: string, currency: CurrencyCode, icon: string, color: string, cardStyle?: 'classic' | 'glass' | 'futuristic' | 'minimal', sharedWith?: string): Promise<Wallet> => {
    let userId: string | undefined = undefined;
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const stored = await AsyncStorage.getItem('@masarif_user_id');
      if (stored) userId = stored;
    } catch (e) {}

    const wallet: Wallet = {
      id: Crypto.randomUUID(),
      name,
      currency,
      icon,
      color,
      cardStyle: cardStyle || 'classic',
      createdAt: new Date().toISOString(),
      userId,
      sharedWith,
    };
    await saveWalletToStorage(wallet);
    setWallets(prev => [...prev, wallet]);
    triggerLiveSync();
    return wallet;
  }, [triggerLiveSync]);

  const removeWallet = useCallback(async (id: string) => {
    await deleteWalletFromStorage(id);
    await deleteFinancialPlan(id);

    // Clean up Goals & Rules associated with this wallet
    try {
      const allGoals = await getGoals();
      const walletGoals = allGoals.filter(g => g.walletId === id);
      for (const goal of walletGoals) {
        await deleteGoal(goal.id); // This also deletes associated rules
      }
      // Delete any remaining rules tied to this wallet
      const allRules = await getRules();
      const walletRules = allRules.filter(r => r.walletId === id);
      for (const rule of walletRules) {
        await deleteRule(rule.id);
      }
    } catch (e) {
      console.error('Error cleaning up goals/rules for wallet:', e);
    }

    // Clean up Debts associated with this wallet
    try {
      const allDebts = await getDebts();
      const walletDebts = allDebts.filter(d => d.walletId === id);
      for (const debt of walletDebts) {
        await deleteDebt(debt.id);
      }
    } catch (e) {
      console.error('Error cleaning up debts for wallet:', e);
    }

    // Clean up Recurring Transactions associated with this wallet
    try {
      const allRecurring = await getRecurringTransactions();
      const walletRecurring = allRecurring.filter(r => r.walletId === id);
      for (const rec of walletRecurring) {
        await deleteRecurringTransaction(rec.id);
      }
    } catch (e) {
      console.error('Error cleaning up recurring for wallet:', e);
    }

    setWallets(prev => prev.filter(w => w.id !== id));
    setTransactions(prev => prev.filter(t => t.walletId !== id));
    if (selectedWalletId === id) {
      const remaining = wallets.filter(w => w.id !== id);
      if (remaining.length > 0) {
        setSelectedWalletIdState(remaining[0].id);
        await setSelectedWalletIdStorage(remaining[0].id);
      } else {
        setSelectedWalletIdState(null);
      }
    }
    triggerLiveSync();
  }, [selectedWalletId, wallets, triggerLiveSync]);

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

  const addCustomCategory = useCallback(async (nameAr: string, nameEn: string, icon: string, color: string, type: 'expense' | 'income') => {
    const catId = `custom_${Date.now()}`;
    const newCat: CustomCategory = {
      id: catId,
      name: nameEn,
      nameAr,
      icon,
      iconFamily: 'MaterialIcons',
      color,
      isCustom: true,
      type,
    };
    await saveCustomCategory(newCat);
    setCustomCategories(prev => {
      const next = [...prev, newCat];
      setCustomCategoriesInMemory(next);
      return next;
    });
    return newCat;
  }, []);

  const removeCustomCategory = useCallback(async (id: string) => {
    await deleteCustomCatFromStorage(id);
    setCustomCategories(prev => {
      const next = prev.filter(c => c.id !== id);
      setCustomCategoriesInMemory(next);
      return next;
    });
  }, []);

  const approveRecurringTransaction = useCallback(async (rec: RecurringTransaction, customAmount?: number, skip?: boolean) => {
    const now = new Date();
    let nextDue = new Date(rec.nextDueDate);
    
    if (!skip) {
      const finalAmount = customAmount !== undefined ? customAmount : rec.amount;
      const newTx: Transaction = {
        id: Crypto.randomUUID(),
        walletId: rec.walletId,
        type: rec.type,
        amount: finalAmount,
        category: rec.category,
        description: rec.description || '',
        date: now.toISOString(),
        createdAt: now.toISOString(),
      };
      
      await saveTransaction(newTx);
      setTransactions(prev => [newTx, ...prev]);
    }
    
    // Advance next due date
    if (rec.frequency === 'daily') {
      nextDue.setDate(nextDue.getDate() + 1);
    } else if (rec.frequency === 'weekly') {
      nextDue.setDate(nextDue.getDate() + 7);
    } else if (rec.frequency === 'monthly') {
      nextDue.setMonth(nextDue.getMonth() + 1);
    } else if (rec.frequency === 'yearly') {
      nextDue.setFullYear(nextDue.getFullYear() + 1);
    }
    
    rec.nextDueDate = nextDue.toISOString();
    await updateRecurringTransaction(rec);
    
    // Refresh pending list
    setPendingRecurring(prev => {
      const filtered = prev.filter(p => p.id !== rec.id);
      // If the next due date is STILL in the past (e.g. multiple periods missed), keep it in pending
      if (nextDue <= now) {
        return [...filtered, rec];
      }
      return filtered;
    });
    
    triggerLiveSync();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [triggerLiveSync]);

  const value = useMemo(() => ({
    transactions,
    wallets,
    selectedWallet,
    isLoading,
    isInitialLoading,
    totalIncome,
    totalExpense,
    balance,
    allTimeIncome,
    allTimeExpense,
    currencySymbol,
    currencyCode,
    addTransaction,
    removeTransaction,
    updateTransaction,
    addWallet,
    removeWallet,
    selectWallet,
    refresh: loadData,
    getMonthlyTransactions,
    walletTransactions,
    customCategories,
    addCustomCategory,
    removeCustomCategory,
    pendingRecurring,
    approveRecurringTransaction,
  }), [transactions, wallets, selectedWallet, isLoading, isInitialLoading, totalIncome, totalExpense, balance, allTimeIncome, allTimeExpense, currencySymbol, currencyCode, addTransaction, removeTransaction, updateTransaction, addWallet, removeWallet, selectWallet, loadData, getMonthlyTransactions, walletTransactions, customCategories, addCustomCategory, removeCustomCategory, pendingRecurring, approveRecurringTransaction]);

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
