import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './query-client';

import { z } from 'zod';

export type CurrencyCode = 'EGP' | 'KWD' | 'USD' | 'SAR' | 'AED' | 'EUR' | 'GBP' | 'QAR' | 'BHD' | 'OMR';

export const currencyCodeSchema = z.enum([
  'EGP', 'KWD', 'USD', 'SAR', 'AED', 'EUR', 'GBP', 'QAR', 'BHD', 'OMR'
]);

export interface CurrencyInfo {
  code: CurrencyCode;
  nameAr: string;
  symbol: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'EGP', nameAr: 'جنيه مصري', symbol: 'ج.م' },
  { code: 'KWD', nameAr: 'دينار كويتي', symbol: 'د.ك' },
  { code: 'USD', nameAr: 'دولار أمريكي', symbol: '$' },
  { code: 'SAR', nameAr: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'AED', nameAr: 'درهم إماراتي', symbol: 'د.إ' },
  { code: 'EUR', nameAr: 'يورو', symbol: '€' },
  { code: 'GBP', nameAr: 'جنيه إسترليني', symbol: '£' },
  { code: 'QAR', nameAr: 'ريال قطري', symbol: 'ر.ق' },
  { code: 'BHD', nameAr: 'دينار بحريني', symbol: 'د.ب' },
  { code: 'OMR', nameAr: 'ريال عماني', symbol: 'ر.ع' },
];

export function getCurrencyInfo(code: CurrencyCode): CurrencyInfo {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}

export const walletSchema = z.object({
  id: z.string(),
  name: z.string(),
  currency: currencyCodeSchema,
  icon: z.string(),
  color: z.string(),
  cardStyle: z.enum(['classic', 'glass', 'futuristic', 'minimal']).optional(),
  createdAt: z.string(),
  sharedWith: z.string().optional(),
  shareCode: z.string().optional(),
});

export interface Wallet {
  id: string;
  name: string;
  currency: CurrencyCode;
  icon: string;
  color: string;
  cardStyle?: 'classic' | 'glass' | 'futuristic' | 'minimal';
  createdAt: string;
  userId?: string;
  sharedWith?: string;
  shareCode?: string;
}

export const transactionSchema = z.object({
  id: z.string(),
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().or(z.string().transform((v) => parseFloat(v))),
  category: z.string(),
  description: z.string().catch(''),
  date: z.string(),
  createdAt: z.string(),
  walletId: z.string(),
  toWalletId: z.string().optional(),
  tags: z.string().optional(),
  receiptUri: z.string().optional(),
  userId: z.string().optional(),
  addedBy: z.string().optional(),
  note: z.string().optional(),
});

export interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  category: string;
  description: string;
  date: string;
  createdAt: string;
  walletId: string;
  toWalletId?: string;
  tags?: string;
  receiptUri?: string;
  userId?: string;
  addedBy?: string;
  note?: string;
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
  const userId = await AsyncStorage.getItem('@masarif_user_id');
  if (!userId) {
    const data = await AsyncStorage.getItem(TRANSACTIONS_KEY);
    if (!data) return [];
    try {
      const raw = JSON.parse(data);
      const parsed = z.array(transactionSchema).safeParse(raw);
      if (parsed.success) return parsed.data;
      if (Array.isArray(raw)) {
        return raw.filter((item: any) => transactionSchema.safeParse(item).success);
      }
    } catch (e) {
      console.error('Error parsing transactions:', e);
    }
    return [];
  }

  return tryApi(
    async () => {
      const res = await apiRequest('GET', '/api/transactions');
      const data = await res.json();
      const parsed = z.array(transactionSchema).safeParse(data);
      if (parsed.success) {
        await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(parsed.data));
        return parsed.data;
      }
      console.warn('API transaction validation failed:', parsed.error);
      return data;
    },
    async () => {
      const data = await AsyncStorage.getItem(TRANSACTIONS_KEY);
      if (!data) return [];
      try {
        const raw = JSON.parse(data);
        const parsed = z.array(transactionSchema).safeParse(raw);
        if (parsed.success) return parsed.data;
        if (Array.isArray(raw)) {
          return raw.filter((item: any) => transactionSchema.safeParse(item).success);
        }
      } catch (e) {
        console.error('Error parsing transactions:', e);
      }
      return [];
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
  const userId = await AsyncStorage.getItem('@masarif_user_id');
  if (!userId) {
    const data = await AsyncStorage.getItem(WALLETS_KEY);
    if (!data) return [];
    try {
      const raw = JSON.parse(data);
      const parsed = z.array(walletSchema).safeParse(raw);
      if (parsed.success) return parsed.data;
      if (Array.isArray(raw)) {
        return raw.filter((item: any) => walletSchema.safeParse(item).success);
      }
    } catch (e) {
      console.error('Error parsing wallets:', e);
    }
    return [];
  }

  return tryApi(
    async () => {
      const res = await apiRequest('GET', '/api/wallets');
      const data = await res.json();
      const parsed = z.array(walletSchema).safeParse(data);
      if (parsed.success) {
        await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(parsed.data));
        return parsed.data;
      }
      console.warn('API wallet validation failed:', parsed.error);
      return data;
    },
    async () => {
      const data = await AsyncStorage.getItem(WALLETS_KEY);
      if (!data) return [];
      try {
        const raw = JSON.parse(data);
        const parsed = z.array(walletSchema).safeParse(raw);
        if (parsed.success) return parsed.data;
        if (Array.isArray(raw)) {
          return raw.filter((item: any) => walletSchema.safeParse(item).success);
        }
      } catch (e) {
        console.error('Error parsing wallets:', e);
      }
      return [];
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
