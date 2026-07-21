import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  getCustomCategories,
  saveCustomCategory,
  deleteCustomCategory as deleteCustomCatFromStorage,
  CustomCategory,
} from './customCategories';
import { getBudgetsForWallet, setCategoryBudget, removeCategoryBudget } from './budgetStorage';
import { setCustomCategoriesInMemory } from './categories';
import * as Crypto from 'expo-crypto';

interface BudgetContextValue {
  customCategories: CustomCategory[];
  budgets: Record<string, number>;
  isLoading: boolean;
  addCustomCategory: (
    nameAr: string,
    nameEn: string,
    icon: string,
    color: string,
    type: 'expense' | 'income'
  ) => Promise<CustomCategory>;
  removeCustomCategory: (id: string) => Promise<void>;
  loadBudgets: (walletId: string) => Promise<void>;
  setCategoryBudget: (walletId: string, categoryId: string, amount: number) => Promise<void>;
  removeCategoryBudget: (walletId: string, categoryId: string) => Promise<void>;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const cats = await getCustomCategories();
      setCustomCategories(cats);
      setCustomCategoriesInMemory(cats);
    } catch (e) {
      console.error('Error loading custom categories:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const loadBudgets = async (walletId: string) => {
    const data = await getBudgetsForWallet(walletId);
    setBudgets(data || {});
  };

  const handleSetCategoryBudget = async (walletId: string, categoryId: string, amount: number) => {
    await setCategoryBudget(walletId, categoryId, amount);
    await loadBudgets(walletId);
  };

  const handleRemoveCategoryBudget = async (walletId: string, categoryId: string) => {
    await removeCategoryBudget(walletId, categoryId);
    await loadBudgets(walletId);
  };

  const addCustomCategory = async (
    nameAr: string,
    nameEn: string,
    icon: string,
    color: string,
    type: 'expense' | 'income'
  ): Promise<CustomCategory> => {
    const newCat: CustomCategory = {
      id: `custom_${Crypto.randomUUID().slice(0, 8)}`,
      name: nameEn,
      nameAr,
      icon,
      iconFamily: 'Ionicons',
      color,
      type,
      isCustom: true,
    };
    await saveCustomCategory(newCat);
    await loadCategories();
    return newCat;
  };

  const removeCustomCategory = async (id: string) => {
    await deleteCustomCatFromStorage(id);
    await loadCategories();
  };

  return (
    <BudgetContext.Provider
      value={{
        customCategories,
        budgets,
        isLoading,
        addCustomCategory,
        removeCustomCategory,
        loadBudgets,
        setCategoryBudget: handleSetCategoryBudget,
        removeCategoryBudget: handleRemoveCategoryBudget,
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudgets() {
  const ctx = useContext(BudgetContext);
  if (!ctx) {
    throw new Error('useBudgets must be used within a BudgetProvider');
  }
  return ctx;
}
