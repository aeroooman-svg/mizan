import AsyncStorage from '@react-native-async-storage/async-storage';

const INSTALLMENTS_KEY = '@masarif_installment_plans';

export interface InstallmentPlan {
  id: string;
  title: string;
  totalAmount: number;
  monthlyAmount: number;
  remainingMonths: number;
  totalMonths: number;
  provider: 'valu' | 'tabby' | 'tamara' | 'bank_card' | 'other';
  walletId: string;
  category: string;
  dueDay: number;
  createdAt: string;
  lastPaidMonth?: string; // YYYY-MM
}

export async function getInstallmentPlans(): Promise<InstallmentPlan[]> {
  try {
    const json = await AsyncStorage.getItem(INSTALLMENTS_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error('Error reading installment plans:', e);
    return [];
  }
}

export async function saveInstallmentPlan(plan: Omit<InstallmentPlan, 'id' | 'createdAt'>): Promise<InstallmentPlan> {
  const plans = await getInstallmentPlans();
  const newPlan: InstallmentPlan = {
    ...plan,
    id: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  const updated = [newPlan, ...plans];
  await AsyncStorage.setItem(INSTALLMENTS_KEY, JSON.stringify(updated));
  return newPlan;
}

export async function deleteInstallmentPlan(id: string): Promise<void> {
  const plans = await getInstallmentPlans();
  const filtered = plans.filter(p => p.id !== id);
  await AsyncStorage.setItem(INSTALLMENTS_KEY, JSON.stringify(filtered));
}

export async function payInstallmentMonth(
  id: string,
  addTransactionFn: (tx: any) => Promise<any>
): Promise<{ success: boolean; completed: boolean }> {
  const plans = await getInstallmentPlans();
  const planIndex = plans.findIndex(p => p.id === id);
  if (planIndex === -1) return { success: false, completed: false };

  const plan = plans[planIndex];
  if (plan.remainingMonths <= 0) return { success: false, completed: true };

  const currentMonthKey = new Date().toISOString().substring(0, 7);

  // Add expense transaction to the target wallet
  await addTransactionFn({
    amount: plan.monthlyAmount,
    type: 'expense',
    category: plan.category || 'other',
    description: `قسط: ${plan.title} (${plan.totalMonths - plan.remainingMonths + 1}/${plan.totalMonths})`,
    date: new Date().toISOString().split('T')[0],
    walletId: plan.walletId,
  });

  const updatedRemaining = plan.remainingMonths - 1;
  plans[planIndex] = {
    ...plan,
    remainingMonths: updatedRemaining,
    lastPaidMonth: currentMonthKey,
  };

  await AsyncStorage.setItem(INSTALLMENTS_KEY, JSON.stringify(plans));
  return { success: true, completed: updatedRemaining === 0 };
}
