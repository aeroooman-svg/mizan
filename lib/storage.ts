import AsyncStorage from '@react-native-async-storage/async-storage';

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

export async function getWallets(): Promise<Wallet[]> {
  const data = await AsyncStorage.getItem(WALLETS_KEY);
  if (!data) return [];
  return JSON.parse(data);
}

export async function saveWallet(wallet: Wallet): Promise<void> {
  const existing = await getWallets();
  existing.push(wallet);
  await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(existing));
}

export async function deleteWallet(id: string): Promise<void> {
  const existing = await getWallets();
  const filtered = existing.filter(w => w.id !== id);
  await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(filtered));
  const txns = await getTransactions();
  const filteredTxns = txns.filter(t => t.walletId !== id);
  await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(filteredTxns));
}

export async function updateWallet(updated: Wallet): Promise<void> {
  const existing = await getWallets();
  const index = existing.findIndex(w => w.id === updated.id);
  if (index !== -1) {
    existing[index] = updated;
    await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(existing));
  }
}

export async function getSelectedWalletId(): Promise<string | null> {
  return AsyncStorage.getItem(SELECTED_WALLET_KEY);
}

export async function setSelectedWalletId(id: string): Promise<void> {
  await AsyncStorage.setItem(SELECTED_WALLET_KEY, id);
}
