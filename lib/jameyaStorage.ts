import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Jameya {
  id: string;
  name: string;
  monthlyAmount: number;
  totalMonths: number;
  payoutMonth: number; // e.g. 1 to totalMonths (which month the user gets the pot)
  startMonth: string; // YYYY-MM
  paidMonthsCount: number;
  isPayoutReceived: boolean;
  walletId: string;
  createdAt: string;
  lastPaidMonth?: string; // YYYY-MM
  sharesCount?: number; // عدد الأسهم/الأسماء (مثلاً 1، 2، 0.5، 1.5)
}

const JAMEYAS_KEY = '@masarif_jameyas';

export async function getJameyas(): Promise<Jameya[]> {
  try {
    const data = await AsyncStorage.getItem(JAMEYAS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    console.error('Error loading Jameyas:', e);
    return [];
  }
}

export async function saveJameya(jameya: Omit<Jameya, 'id' | 'createdAt'> & { id?: string }): Promise<Jameya> {
  try {
    const list = await getJameyas();
    const id = jameya.id || `jameya_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowStr = new Date().toISOString();

    const newJameya: Jameya = {
      ...jameya,
      id,
      createdAt: jameya.id ? (list.find(j => j.id === jameya.id)?.createdAt || nowStr) : nowStr,
    };

    const existingIndex = list.findIndex(j => j.id === id);
    if (existingIndex !== -1) {
      list[existingIndex] = newJameya;
    } else {
      list.unshift(newJameya);
    }

    await AsyncStorage.setItem(JAMEYAS_KEY, JSON.stringify(list));
    return newJameya;
  } catch (e) {
    console.error('Error saving Jameya:', e);
    throw e;
  }
}

export async function deleteJameya(id: string): Promise<void> {
  try {
    const list = await getJameyas();
    const filtered = list.filter(j => j.id !== id);
    await AsyncStorage.setItem(JAMEYAS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error deleting Jameya:', e);
  }
}

export async function deleteJameyasForWallet(walletId: string): Promise<void> {
  try {
    const list = await getJameyas();
    const filtered = list.filter(j => j.walletId !== walletId);
    await AsyncStorage.setItem(JAMEYAS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error deleting Jameyas for wallet:', e);
  }
}

export async function payJameyaMonth(
  id: string,
  addTransactionFn: (tx: any) => Promise<any>
): Promise<{ success: boolean; completed: boolean }> {
  try {
    const list = await getJameyas();
    const index = list.findIndex(j => j.id === id);
    if (index === -1) return { success: false, completed: false };

    const item = list[index];
    if (item.paidMonthsCount >= item.totalMonths) {
      return { success: false, completed: true };
    }

    const currentMonthKey = new Date().toISOString().substring(0, 7);
    const now = new Date().toISOString();

    const newPaidCount = item.paidMonthsCount + 1;

    // Add expense transaction for this month's installment
    await addTransactionFn({
      id: `jam_tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      amount: item.monthlyAmount,
      type: 'expense',
      category: 'other_expense',
      description: `قسط جمعية: ${item.name} (${newPaidCount}/${item.totalMonths})`,
      date: now,
      createdAt: now,
      walletId: item.walletId,
    });

    list[index] = {
      ...item,
      paidMonthsCount: newPaidCount,
      lastPaidMonth: currentMonthKey,
    };

    await AsyncStorage.setItem(JAMEYAS_KEY, JSON.stringify(list));
    return { success: true, completed: newPaidCount === item.totalMonths };
  } catch (e) {
    console.error('Error paying Jameya month:', e);
    return { success: false, completed: false };
  }
}

export async function receiveJameyaPayout(
  id: string,
  addTransactionFn: (tx: any) => Promise<any>
): Promise<boolean> {
  try {
    const list = await getJameyas();
    const index = list.findIndex(j => j.id === id);
    if (index === -1) return false;

    const item = list[index];
    if (item.isPayoutReceived) return false;

    const potAmount = item.monthlyAmount * item.totalMonths;
    const now = new Date().toISOString();

    // Add Income transaction for the payout pot
    await addTransactionFn({
      id: `jam_payout_tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      amount: potAmount,
      type: 'income',
      category: 'other_income',
      description: `قبض جمعية: ${item.name}`,
      date: now,
      createdAt: now,
      walletId: item.walletId,
    });

    list[index] = {
      ...item,
      isPayoutReceived: true,
    };

    await AsyncStorage.setItem(JAMEYAS_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error('Error receiving Jameya payout:', e);
    return false;
  }
}
