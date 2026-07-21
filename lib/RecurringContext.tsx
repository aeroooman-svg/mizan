import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  getRecurringTransactions,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  RecurringTransaction,
} from './recurringStorage';

interface RecurringContextValue {
  pendingRecurring: RecurringTransaction[];
  allRecurring: RecurringTransaction[];
  isLoading: boolean;
  refreshRecurring: () => Promise<void>;
  approveTransaction: (
    rec: RecurringTransaction,
    customAmount?: number,
    skip?: boolean
  ) => Promise<void>;
}

const RecurringContext = createContext<RecurringContextValue | null>(null);

export function RecurringProvider({ children }: { children: ReactNode }) {
  const [allRecurring, setAllRecurring] = useState<RecurringTransaction[]>([]);
  const [pendingRecurring, setPendingRecurring] = useState<RecurringTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRecurring = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getRecurringTransactions();
      setAllRecurring(list);

      const now = new Date();
      const pending = list.filter((r) => {
        if (!r.isActive) return false;
        const due = new Date(r.nextDueDate);
        return due <= now;
      });
      setPendingRecurring(pending);
    } catch (e) {
      console.error('Error loading recurring transactions:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecurring();
  }, [loadRecurring]);

  const approveTransaction = async (
    rec: RecurringTransaction,
    customAmount?: number,
    skip?: boolean
  ) => {
    const nextDate = new Date(rec.nextDueDate);
    if (rec.frequency === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (rec.frequency === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (rec.frequency === 'yearly') {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    }

    const updated: RecurringTransaction = {
      ...rec,
      nextDueDate: nextDate.toISOString(),
    };

    await updateRecurringTransaction(updated);
    await loadRecurring();
  };

  return (
    <RecurringContext.Provider
      value={{
        pendingRecurring,
        allRecurring,
        isLoading,
        refreshRecurring: loadRecurring,
        approveTransaction,
      }}
    >
      {children}
    </RecurringContext.Provider>
  );
}

export function useRecurring() {
  const ctx = useContext(RecurringContext);
  if (!ctx) {
    throw new Error('useRecurring must be used within a RecurringProvider');
  }
  return ctx;
}
