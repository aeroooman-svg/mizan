import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RecurringTransaction {
  id: string;
  walletId: string;
  type: 'expense' | 'income';
  amount: number;
  category: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDueDate: string; // ISO date string
  isActive: boolean;
  isVariable?: boolean;
  createdAt: string;
}

const RECURRING_KEY = '@masarif_recurring_transactions';

export async function getRecurringTransactions(): Promise<RecurringTransaction[]> {
  try {
    const data = await AsyncStorage.getItem(RECURRING_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export async function saveRecurringTransaction(item: RecurringTransaction): Promise<void> {
  const existing = await getRecurringTransactions();
  existing.unshift(item);
  await AsyncStorage.setItem(RECURRING_KEY, JSON.stringify(existing));
}

export async function deleteRecurringTransaction(id: string): Promise<void> {
  const existing = await getRecurringTransactions();
  const filtered = existing.filter(item => item.id !== id);
  await AsyncStorage.setItem(RECURRING_KEY, JSON.stringify(filtered));
}

export async function updateRecurringTransaction(updated: RecurringTransaction): Promise<void> {
  const existing = await getRecurringTransactions();
  const index = existing.findIndex(item => item.id === updated.id);
  if (index !== -1) {
    existing[index] = updated;
    await AsyncStorage.setItem(RECURRING_KEY, JSON.stringify(existing));
  }
}
