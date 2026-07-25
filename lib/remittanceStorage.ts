import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Remittance {
  id: string;
  fromWalletId: string;
  toWalletId: string;
  fromAmount: number;
  fromCurrency: string;
  toAmount: number;
  toCurrency: string;
  exchangeRate: number;
  note: string;
  date: string; // ISO String
  createdBy?: string;
}

const REMITTANCES_KEY = '@masarif_remittances_v1';

export async function getRemittances(): Promise<Remittance[]> {
  try {
    const json = await AsyncStorage.getItem(REMITTANCES_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.warn('Error reading remittances from storage:', e);
    return [];
  }
}

export async function saveRemittance(remittance: Remittance): Promise<Remittance[]> {
  try {
    const list = await getRemittances();
    const updated = [remittance, ...list];
    await AsyncStorage.setItem(REMITTANCES_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Error saving remittance to storage:', e);
    return [];
  }
}

export async function getRemittancesForWallet(walletId: string): Promise<Remittance[]> {
  const all = await getRemittances();
  return all.filter((r) => r.fromWalletId === walletId || r.toWalletId === walletId);
}

export interface RemittanceStats {
  latestRemittance: Remittance | null;
  totalReceived: number;
  totalSpentSinceRemittance: number;
  remainingBalance: number;
  spentPercentage: number;
  estimatedDaysRunway: number;
}

export function calculateRemittanceStats(
  remittances: Remittance[],
  targetWalletId: string,
  walletTransactions: any[]
): RemittanceStats {
  const targetRemittances = remittances.filter((r) => r.toWalletId === targetWalletId);

  if (targetRemittances.length === 0) {
    return {
      latestRemittance: null,
      totalReceived: 0,
      totalSpentSinceRemittance: 0,
      remainingBalance: 0,
      spentPercentage: 0,
      estimatedDaysRunway: 0,
    };
  }

  // Sort by date descending
  const sorted = [...targetRemittances].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const latest = sorted[0];
  const latestDate = new Date(latest.date);

  // Filter transactions in target wallet after latest remittance date
  const txnsAfterRemittance = walletTransactions.filter((t) => {
    const tDate = new Date(t.date);
    return t.walletId === targetWalletId && tDate >= latestDate && t.type === 'expense';
  });

  const totalSpentSinceRemittance = txnsAfterRemittance.reduce((sum, t) => sum + t.amount, 0);
  const totalReceived = latest.toAmount;
  const remainingBalance = Math.max(0, totalReceived - totalSpentSinceRemittance);
  const spentPercentage = totalReceived > 0 ? Math.min(100, Math.round((totalSpentSinceRemittance / totalReceived) * 100)) : 0;

  // Calculate daily burn rate
  const now = new Date();
  const daysPassed = Math.max(1, Math.ceil((now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24)));
  const avgDailyBurn = totalSpentSinceRemittance > 0 ? totalSpentSinceRemittance / daysPassed : 0;

  const estimatedDaysRunway = avgDailyBurn > 0 ? Math.round(remainingBalance / avgDailyBurn) : 30;

  return {
    latestRemittance: latest,
    totalReceived,
    totalSpentSinceRemittance,
    remainingBalance,
    spentPercentage,
    estimatedDaysRunway,
  };
}
