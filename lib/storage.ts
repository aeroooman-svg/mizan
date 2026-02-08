import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  createdAt: string;
}

const TRANSACTIONS_KEY = '@masarif_transactions';

export async function getTransactions(): Promise<Transaction[]> {
  const data = await AsyncStorage.getItem(TRANSACTIONS_KEY);
  if (!data) return [];
  return JSON.parse(data);
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  const existing = await getTransactions();
  existing.unshift(transaction);
  await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(existing));
}

export async function deleteTransaction(id: string): Promise<void> {
  const existing = await getTransactions();
  const filtered = existing.filter(t => t.id !== id);
  await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(filtered));
}

export async function updateTransaction(updated: Transaction): Promise<void> {
  const existing = await getTransactions();
  const index = existing.findIndex(t => t.id === updated.id);
  if (index !== -1) {
    existing[index] = updated;
    await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(existing));
  }
}
