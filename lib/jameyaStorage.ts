import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Jameya {
  id: string;
  name: string;
  monthlyAmount: number; // إجمالي القسط الشهري الخاص بالمستخدم (مثلاً 200)
  singleShareAmount?: number; // قيمة الاسم/السهم الواحد في الجمعية (مثلاً 100)
  totalMonths: number; // إجمالي عدد أسماء/أشهر الجمعية (مثلاً 8)
  payoutMonth: number; // For backward compatibility
  payoutMonths?: number[]; // قائمة شهور القبض (مثلاً [5, 8] لمن يشارك باسمين)
  receivedPayoutMonths?: number[]; // قائمة الشهور التي تم قبضها بالفعل (مثلاً [5])
  startMonth: string; // YYYY-MM
  paidMonthsCount: number;
  isPayoutReceived: boolean;
  walletId: string;
  createdAt: string;
  lastPaidMonth?: string; // YYYY-MM
  sharesCount?: number; // عدد الأسهم/الأسماء التي يشارك بها المستخدم (مثلاً 2، 1، 0.5)
}

const JAMEYAS_KEY = '@mizan_jameyas';
const LEGACY_JAMEYAS_KEY = '@masarif_jameyas';

export async function getJameyas(): Promise<Jameya[]> {
  try {
    let data = await AsyncStorage.getItem(JAMEYAS_KEY);
    if (!data) {
      data = await AsyncStorage.getItem(LEGACY_JAMEYAS_KEY);
      if (data) {
        await AsyncStorage.setItem(JAMEYAS_KEY, data);
      }
    }
    if (!data) return [];
    const list: Jameya[] = JSON.parse(data);
    // Self-healing migration for existing data
    return list.map(j => {
      const sharesCount = j.sharesCount || 1;
      const singleShareAmount = j.singleShareAmount || (j.monthlyAmount / sharesCount);
      return {
        ...j,
        sharesCount,
        singleShareAmount,
        payoutMonths: j.payoutMonths && j.payoutMonths.length > 0 ? j.payoutMonths : [j.payoutMonth || 1],
        receivedPayoutMonths: j.receivedPayoutMonths || (j.isPayoutReceived ? (j.payoutMonths || [j.payoutMonth || 1]) : []),
      };
    });
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

    const sharesCount = jameya.sharesCount || 1;
    const singleShareAmount = jameya.singleShareAmount || (jameya.monthlyAmount / sharesCount);
    // Ensure monthlyAmount aligns: monthlyAmount = singleShareAmount * sharesCount
    const monthlyAmount = jameya.singleShareAmount ? (jameya.singleShareAmount * sharesCount) : jameya.monthlyAmount;

    const newJameya: Jameya = {
      ...jameya,
      id,
      monthlyAmount,
      singleShareAmount,
      sharesCount,
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

    const jsonStr = JSON.stringify(list);
    await AsyncStorage.setItem(JAMEYAS_KEY, jsonStr);
    await AsyncStorage.setItem(LEGACY_JAMEYAS_KEY, jsonStr);
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

    // Add savings transaction for this month's installment
    await addTransactionFn({
      id: `jam_tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      amount: item.monthlyAmount,
      type: 'expense',
      category: 'jameya_savings',
      description: `ادخار قسط جمعية: ${item.name} (${newPaidCount}/${item.totalMonths})`,
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
  specificMonth?: number,
  deductCurrentInstallment: boolean = false
): Promise<boolean> {
  try {
    const list = await getJameyas();
    const index = list.findIndex(j => j.id === id);
    if (index === -1) return false;

    const item = list[index];
    const sharesCount = item.sharesCount || 1;
    const singleShareAmount = item.singleShareAmount || (item.monthlyAmount / sharesCount);
    const payoutMonths = item.payoutMonths || [item.payoutMonth || 1];
    const receivedPayoutMonths = item.receivedPayoutMonths || [];

    // Full pot value for 1 share = singleShareAmount * totalMonths (e.g. 100 * 8 = 800)
    let potAmountForOneShare = singleShareAmount * item.totalMonths;
    let targetMonth = specificMonth;

    if (targetMonth !== undefined) {
      if (receivedPayoutMonths.includes(targetMonth)) return false;
    } else {
      if (item.isPayoutReceived) return false;
      potAmountForOneShare = item.monthlyAmount * item.totalMonths;
    }

    // If user selected net payout (deducting current month's installment share of 100)
    const finalAmountToRecord = deductCurrentInstallment
      ? Math.max(0, potAmountForOneShare - singleShareAmount)
      : potAmountForOneShare;

    const now = new Date().toISOString();
    const descSuffix = targetMonth ? ` (دور الشهر الـ ${targetMonth})` : '';

    // Add Income transaction for the payout pot
    await addTransactionFn({
      id: `jam_payout_tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      amount: finalAmountToRecord,
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
