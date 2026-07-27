import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Jameya {
  id: string;
  name: string;
  monthlyAmount: number; // إجمالي القسط الشهري الخاص بالمستخدم
  totalMonths: number;
  payoutMonth: number; // For backward compatibility
  payoutMonths?: number[]; // قائمة شهور القبض (مثلاً [2, 7] لمن يشارك باسمين)
  receivedPayoutMonths?: number[]; // قائمة الشهور التي تم قبضها بالفعل (مثلاً [2])
  startMonth: string; // YYYY-MM
  paidMonthsCount: number;
  isPayoutReceived: boolean;
  walletId: string;
  createdAt: string;
  lastPaidMonth?: string; // YYYY-MM
  sharesCount?: number; // عدد الأسهم/الأسماء (مثلاً 1، 2، 0.5)
}

const JAMEYAS_KEY = '@masarif_jameyas';

export async function getJameyas(): Promise<Jameya[]> {
  try {
    const data = await AsyncStorage.getItem(JAMEYAS_KEY);
    if (!data) return [];
    const list: Jameya[] = JSON.parse(data);
    // Self-healing migration for existing data missing payoutMonths
    return list.map(j => ({
      ...j,
      payoutMonths: j.payoutMonths && j.payoutMonths.length > 0 ? j.payoutMonths : [j.payoutMonth || 1],
      receivedPayoutMonths: j.receivedPayoutMonths || (j.isPayoutReceived ? (j.payoutMonths || [j.payoutMonth || 1]) : []),
      sharesCount: j.sharesCount || 1,
    }));
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

    const payoutMonths = jameya.payoutMonths && jameya.payoutMonths.length > 0
      ? jameya.payoutMonths
      : [jameya.payoutMonth || 1];

    const newJameya: Jameya = {
      ...jameya,
      id,
      payoutMonth: payoutMonths[0] || 1,
      payoutMonths,
      receivedPayoutMonths: jameya.receivedPayoutMonths || [],
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
  addTransactionFn: (tx: any) => Promise<any>,
  specificMonth?: number
): Promise<boolean> {
  try {
    const list = await getJameyas();
    const index = list.findIndex(j => j.id === id);
    if (index === -1) return false;

    const item = list[index];
    const sharesCount = item.sharesCount || 1;
    const payoutMonths = item.payoutMonths || [item.payoutMonth || 1];
    const receivedPayoutMonths = item.receivedPayoutMonths || [];

    let potAmount = 0;
    let targetMonth = specificMonth;

    if (targetMonth !== undefined) {
      if (receivedPayoutMonths.includes(targetMonth)) return false;
      // Portion of pot for 1 share/turn
      const totalPotAllShares = item.monthlyAmount * item.totalMonths;
      potAmount = totalPotAllShares / sharesCount;
    } else {
      if (item.isPayoutReceived) return false;
      potAmount = item.monthlyAmount * item.totalMonths;
    }

    const now = new Date().toISOString();
    const descSuffix = targetMonth ? ` (دور الشهر الـ ${targetMonth})` : '';

    // Add Income transaction for the payout pot
    await addTransactionFn({
      id: `jam_payout_tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      amount: potAmount,
      type: 'income',
      category: 'other_income',
      description: `قبض جمعية: ${item.name}${descSuffix}`,
      date: now,
      createdAt: now,
      walletId: item.walletId,
    });

    const updatedReceivedMonths = targetMonth
      ? [...receivedPayoutMonths, targetMonth]
      : payoutMonths;

    const allReceived = payoutMonths.every(m => updatedReceivedMonths.includes(m));

    list[index] = {
      ...item,
      receivedPayoutMonths: updatedReceivedMonths,
      isPayoutReceived: allReceived,
    };

    await AsyncStorage.setItem(JAMEYAS_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error('Error receiving Jameya payout:', e);
    return false;
  }
}
