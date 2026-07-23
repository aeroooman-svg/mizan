import AsyncStorage from '@react-native-async-storage/async-storage';

const BUDGETS_KEY = '@masarif_category_budgets';

type WalletBudgets = Record<string, number>; // categoryId -> limit amount
type AllBudgets = Record<string, WalletBudgets>; // walletId -> WalletBudgets

export async function getAllBudgets(): Promise<AllBudgets> {
  try {
    const data = await AsyncStorage.getItem(BUDGETS_KEY);
    if (!data) return {};
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

export async function getBudgetsForWallet(walletId: string): Promise<WalletBudgets> {
  const all = await getAllBudgets();
  return all[walletId] || {};
}

export async function setCategoryBudget(walletId: string, categoryId: string, limit: number): Promise<void> {
  const all = await getAllBudgets();
  if (!all[walletId]) {
    all[walletId] = {};
  }
  all[walletId][categoryId] = limit;
  await AsyncStorage.setItem(BUDGETS_KEY, JSON.stringify(all));
}

export async function removeCategoryBudget(walletId: string, categoryId: string): Promise<void> {
  const all = await getAllBudgets();
  if (all[walletId]) {
    delete all[walletId][categoryId];
    await AsyncStorage.setItem(BUDGETS_KEY, JSON.stringify(all));
  }
}

export async function deleteBudgetsForWallet(walletId: string): Promise<void> {
  const all = await getAllBudgets();
  if (all[walletId]) {
    delete all[walletId];
    await AsyncStorage.setItem(BUDGETS_KEY, JSON.stringify(all));
  }
}

