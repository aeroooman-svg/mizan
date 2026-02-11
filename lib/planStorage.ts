import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FinancialPlan {
  id: string;
  goalName: string;
  durationMonths: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlySaving: number;
  savingsGoal: number;
  currency: string;
  currencySymbol: string;
  createdAt: string;
  walletId: string;
}

const PLANS_KEY = '@masarif_financial_plans';
const LEGACY_KEY = '@masarif_financial_plan';

async function getAllPlans(): Promise<Record<string, FinancialPlan>> {
  const data = await AsyncStorage.getItem(PLANS_KEY);
  if (data) return JSON.parse(data);

  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (legacy) {
    const plan: FinancialPlan = JSON.parse(legacy);
    if (plan.walletId) {
      const plans: Record<string, FinancialPlan> = { [plan.walletId]: plan };
      await AsyncStorage.setItem(PLANS_KEY, JSON.stringify(plans));
      await AsyncStorage.removeItem(LEGACY_KEY);
      return plans;
    }
  }

  return {};
}

async function setAllPlans(plans: Record<string, FinancialPlan>): Promise<void> {
  await AsyncStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

export async function getFinancialPlan(walletId?: string): Promise<FinancialPlan | null> {
  const plans = await getAllPlans();
  if (walletId) return plans[walletId] || null;
  const keys = Object.keys(plans);
  return keys.length > 0 ? plans[keys[0]] : null;
}

export async function saveFinancialPlan(plan: FinancialPlan): Promise<void> {
  const plans = await getAllPlans();
  plans[plan.walletId] = plan;
  await setAllPlans(plans);
}

export async function deleteFinancialPlan(walletId: string): Promise<void> {
  const plans = await getAllPlans();
  delete plans[walletId];
  await setAllPlans(plans);
}
