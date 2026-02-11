import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './query-client';

export type CurrencyCode = 'EGP' | 'KWD' | 'USD';

export interface CurrencyInfo {
  code: CurrencyCode;
  nameAr: string;
  symbol: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'EGP', nameAr: 'جنيه مصري', symbol: 'ج.م' },
  { code: 'KWD', nameAr: 'دينار كويتي', symbol: 'د.ك' },
  { code: 'USD', nameAr: 'دولار أمريكي', symbol: '$' },
];

export function getCurrencyInfo(code: CurrencyCode): CurrencyInfo {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}

export interface Wallet {
  id: string;
  name: string;
  currency: CurrencyCode;
  icon: string;
  color: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  createdAt: string;
  walletId: string;
}

const TRANSACTIONS_KEY = '@masarif_transactions';
const WALLETS_KEY = '@masarif_wallets';
const SELECTED_WALLET_KEY = '@masarif_selected_wallet';

async function tryApi<T>(fn: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    return await fallback();
  }
}

export async function getTransactions(): Promise<Transaction[]> {
  return tryApi(
    async () => {
      const res = await apiRequest('GET', '/api/transactions');
      const data = await res.json();
      await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(data));
      return data;
    },
    async () => {
      const data = await AsyncStorage.getItem(TRANSACTIONS_KEY);
      if (!data) return [];
      return JSON.parse(data);
    }
  );
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  const existing = await AsyncStorage.getItem(TRANSACTIONS_KEY);
  const list: Transaction[] = existing ? JSON.parse(existing) : [];
  list.unshift(transaction);
  await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(list));

  try {
    await apiRequest('POST', '/api/transactions', transaction);
  } catch (e) {
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  const existing = await AsyncStorage.getItem(TRANSACTIONS_KEY);
  const list: Transaction[] = existing ? JSON.parse(existing) : [];
  const filtered = list.filter(t => t.id !== id);
  await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(filtered));

  try {
    await apiRequest('DELETE', `/api/transactions/${id}`);
  } catch (e) {
  }
}

export async function updateTransaction(updated: Transaction): Promise<void> {
  const existing = await AsyncStorage.getItem(TRANSACTIONS_KEY);
  const list: Transaction[] = existing ? JSON.parse(existing) : [];
  const index = list.findIndex(t => t.id === updated.id);
  if (index !== -1) {
    list[index] = updated;
    await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(list));
  }

  try {
    await apiRequest('POST', '/api/transactions', updated);
  } catch (e) {
  }
}

export async function getWallets(): Promise<Wallet[]> {
  return tryApi(
    async () => {
      const res = await apiRequest('GET', '/api/wallets');
      const data = await res.json();
      await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(data));
      return data;
    },
    async () => {
      const data = await AsyncStorage.getItem(WALLETS_KEY);
      if (!data) return [];
      return JSON.parse(data);
    }
  );
}

export async function saveWallet(wallet: Wallet): Promise<void> {
  const existing = await AsyncStorage.getItem(WALLETS_KEY);
  const list: Wallet[] = existing ? JSON.parse(existing) : [];
  list.push(wallet);
  await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(list));

  try {
    await apiRequest('POST', '/api/wallets', wallet);
  } catch (e) {
  }
}

export async function deleteWallet(id: string): Promise<void> {
  const existing = await AsyncStorage.getItem(WALLETS_KEY);
  const list: Wallet[] = existing ? JSON.parse(existing) : [];
  const filtered = list.filter(w => w.id !== id);
  await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(filtered));

  const txns = await AsyncStorage.getItem(TRANSACTIONS_KEY);
  const txnList: Transaction[] = txns ? JSON.parse(txns) : [];
  const filteredTxns = txnList.filter(t => t.walletId !== id);
  await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(filteredTxns));

  try {
    await apiRequest('DELETE', `/api/wallets/${id}`);
  } catch (e) {
  }
}

export async function updateWallet(updated: Wallet): Promise<void> {
  const existing = await AsyncStorage.getItem(WALLETS_KEY);
  const list: Wallet[] = existing ? JSON.parse(existing) : [];
  const index = list.findIndex(w => w.id === updated.id);
  if (index !== -1) {
    list[index] = updated;
    await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(list));
  }

  try {
    await apiRequest('POST', '/api/wallets', updated);
  } catch (e) {
  }
}

export async function getSelectedWalletId(): Promise<string | null> {
  return AsyncStorage.getItem(SELECTED_WALLET_KEY);
}

export async function setSelectedWalletId(id: string): Promise<void> {
  await AsyncStorage.setItem(SELECTED_WALLET_KEY, id);
}
