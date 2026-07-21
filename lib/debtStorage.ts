import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Debt {
  id: string;
  type: 'debt_to_me' | 'debt_to_others';
  personName: string;
  amount: number;
  paidAmount: number;
  description: string;
  dueDate: string;
  createdAt: string;
  walletId: string;
  status: 'pending' | 'partially_paid' | 'paid';
}

const DEBTS_KEY = '@masarif_debts';

export async function getDebts(): Promise<Debt[]> {
  try {
    const data = await AsyncStorage.getItem(DEBTS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    console.error('Error loading debts:', e);
    return [];
  }
}

export async function saveDebt(debt: Debt): Promise<void> {
  try {
    const list = await getDebts();
    const existingIndex = list.findIndex(d => d.id === debt.id);
    if (existingIndex !== -1) {
      list[existingIndex] = debt;
    } else {
      list.unshift(debt);
    }
    await AsyncStorage.setItem(DEBTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error saving debt:', e);
  }
}

export async function deleteDebt(id: string): Promise<void> {
  try {
    const list = await getDebts();
    const filtered = list.filter(d => d.id !== id);
    await AsyncStorage.setItem(DEBTS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error deleting debt:', e);
  }
}

export async function recordDebtPayment(debtId: string, paymentAmount: number): Promise<Debt | null> {
  try {
    const list = await getDebts();
    const index = list.findIndex(d => d.id === debtId);
    if (index === -1) return null;

    const debt = list[index];
    debt.paidAmount += paymentAmount;

    if (debt.paidAmount >= debt.amount) {
      debt.paidAmount = debt.amount;
      debt.status = 'paid';
    } else if (debt.paidAmount > 0) {
      debt.status = 'partially_paid';
    } else {
      debt.status = 'pending';
    }

    list[index] = debt;
    await AsyncStorage.setItem(DEBTS_KEY, JSON.stringify(list));
    return debt;
  } catch (e) {
    console.error('Error recording debt payment:', e);
    return null;
  }
}
